import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const transactionsRoute = Router();

// GET /transactions?wallet=0xabc&limit=20&offset=0
// GET /transactions?wallet=all&burnTxHash=0x...
transactionsRoute.get("/", async (req: Request, res: Response) => {

    const { wallet, burnTxHash, limit = "20", offset = "0" } = req.query;

    if (!wallet) {
        return res.status(400).json({ error: "wallet is required" });
    }

    try {

        // If burnTxHash is provided, filter by that instead of wallet
        const filter = burnTxHash
            ? eq(transactions.burnTxHash, burnTxHash as string)
            : eq(transactions.wallet, (wallet as string).toLowerCase());

        const txs = await db
            .select()
            .from(transactions)
            .where(filter)
            .orderBy(desc(transactions.timestamp))
            .limit(parseInt(limit as string))
            .offset(parseInt(offset as string));

        return res.json({ transactions: txs });

    } catch (err: any) {
        console.error("Failed to fetch transactions:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});