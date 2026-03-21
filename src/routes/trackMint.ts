import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions, bridgeStats } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export const trackMintRoute = Router();

trackMintRoute.post("/mint", async (req: Request, res: Response) => {

    const { burnTxHash, mintTxHash, bridgeId, success, amountReceived } = req.body;

    if (!burnTxHash || !bridgeId) {
        return res.status(400).json({ error: "Missing required fields (burnTxHash, bridgeId)" });
    }

    if (success && !mintTxHash) {
        return res.status(400).json({ error: "mintTxHash is required when mint succeeded" });
    }

    try {
        // Find the transaction by burnTxHash
        const existing = await db
            .select()
            .from(transactions)
            .where(eq(transactions.burnTxHash, burnTxHash))
            .limit(1);

        if (existing.length === 0) {
            return res.status(404).json({ error: "Transaction not found — track burn first" });
        }

        // Verify the bridgeId matches
        if (existing[0].bridgeId !== bridgeId) {
            return res.status(403).json({ error: "Bridge ID mismatch" });
        }

        const newStatus = success ? "completed" : "mint_failed";
        
        // Truncate amountReceived to 2 decimal places if present
        let finalAmountReceived = amountReceived || null;
        if (finalAmountReceived) {
            const [int, frac] = String(finalAmountReceived).split('.');
            finalAmountReceived = `${int}.${(frac || '').padEnd(2, '0').slice(0, 2)}`;
        }

        await db
            .update(transactions)
            .set({
                status: newStatus,
                mintTxHash: mintTxHash || null,
                amountReceived: finalAmountReceived,
            })
            .where(eq(transactions.burnTxHash, burnTxHash));

        // If mint succeeded, update bridge stats
        if (success) {
            const tx = existing[0];
            await db
                .insert(bridgeStats)
                .values({
                    bridgeId,
                    totalVolume: tx.amount,
                    totalTransactions: 1,
                    totalUsers: 1,
                })
                .onConflictDoUpdate({
                    target: bridgeStats.bridgeId,
                    set: {
                        totalVolume: sql`${bridgeStats.totalVolume} + ${tx.amount}`,
                        totalTransactions: sql`${bridgeStats.totalTransactions} + 1`,
                        totalUsers: sql`${bridgeStats.totalUsers} + 1`,
                        updatedAt: sql`now()`,
                    },
                });
        }

        console.log(`[Mint] ${burnTxHash} → ${newStatus}${mintTxHash ? ` (mint: ${mintTxHash})` : ""}`);
        return res.json({ success: true, status: newStatus });

    } catch (err: any) {
        console.error("Failed to update mint status:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});
