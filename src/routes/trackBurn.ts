import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions, users, bridges } from "../db/schema";
import { verifyBurnTx } from "../services/txVerifier";
import { eq } from "drizzle-orm";

export const trackBurnRoute = Router();

trackBurnRoute.post("/burn", async (req: Request, res: Response) => {

    const {
        burnTxHash,
        wallet,
        amount,
        sourceChain,
        destinationChain,
        bridgeId,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────
    if (!burnTxHash || !wallet || !amount || !sourceChain || !destinationChain || !bridgeId) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // ── Verify bridge is registered ──────────────────────────────
    const bridgeExists = await db
        .select()
        .from(bridges)
        .where(eq(bridges.bridgeId, bridgeId))
        .limit(1);

    if (bridgeExists.length === 0) {
        return res.status(403).json({ 
            error: "Unauthorized Bridge ID. Please register this ID in the backend first." 
        });
    }

    // ── Verify tx is real on-chain ────────────────────────────────
    const verification = await verifyBurnTx({
        txHash: burnTxHash,
        wallet,
        chain: sourceChain,
    });

    if (!verification.valid) {
        return res.status(400).json({ error: `Invalid burn tx: ${verification.reason}` });
    }

    // ── Store transaction ─────────────────────────────────────────
    try {

        await db
            .insert(transactions)
            .values({
                bridgeId,
                wallet: wallet.toLowerCase(),
                amount,
                sourceChain: sourceChain.toLowerCase(),
                destinationChain: destinationChain.toLowerCase(),
                burnTxHash,
                mintTxHash: null,
                status: "burned",
            })
            .onConflictDoNothing();

        // Upsert user — create if new, increment count if existing
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.wallet, wallet.toLowerCase()))
            .limit(1);

        if (existingUser.length === 0) {
            await db.insert(users).values({
                wallet: wallet.toLowerCase(),
                totalBridges: 1,
            });
        } else {
            await db
                .update(users)
                .set({ totalBridges: (existingUser[0].totalBridges || 0) + 1 })
                .where(eq(users.wallet, wallet.toLowerCase()));
        }

        return res.json({ success: true });

    } catch (err: any) {
        console.error("Failed to store burn tx:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});