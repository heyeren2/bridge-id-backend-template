import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const activityRoute = Router();

// GET /activity/:wallet
activityRoute.get("/:wallet", async (req: Request, res: Response) => {

    const { wallet } = req.params;

    if (!wallet) {
        return res.status(400).json({ error: "wallet is required" });
    }

    try {
        let txs;
        if (wallet.toLowerCase() === "all") {
            txs = await db
                .select()
                .from(transactions)
                .orderBy(desc(transactions.timestamp))
                .limit(100);
        } else {
            txs = await db
                .select()
                .from(transactions)
                .where(eq(transactions.wallet, wallet.toLowerCase()))
                .orderBy(desc(transactions.timestamp));
        }

        return res.json({
            wallet: wallet.toLowerCase(),
            transactions: txs.map(tx => {
                const truncate = (val: string | null) => {
                    if (!val) return null;
                    const [int, frac] = String(val).split('.');
                    return `${int}.${(frac || '').padEnd(2, '0').slice(0, 2)}`;
                };

                return {
                    wallet: tx.wallet,
                    burnTxHash: tx.burnTxHash,
                    mintTxHash: tx.mintTxHash,
                    amount: truncate(tx.amount)!,
                    amountReceived: truncate(tx.amountReceived),
                    sourceChain: tx.sourceChain,
                    destinationChain: tx.destinationChain,
                    status: tx.status,
                    timestamp: tx.timestamp,
                };
            }),
            // status "attested" + mintTxHash null = show Remint button in frontend
        });

    } catch (err: any) {
        console.error("Failed to fetch activity:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});