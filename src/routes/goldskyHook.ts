import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions, bridgeStats } from "../db/schema";
import { eq } from "drizzle-orm";

export const goldskyHookRoute = Router();

goldskyHookRoute.post("/goldsky", async (req: Request, res: Response) => {

    // Verify request is from Goldsky
    const webhookSecret = req.headers["goldsky-webhook-secret"];
    const validSecrets = [
        process.env.GOLDSKY_SECRET_SEPOLIA,
        process.env.GOLDSKY_SECRET_BASE,
        process.env.GOLDSKY_SECRET_ARC,
    ];

    if (!webhookSecret || !validSecrets.includes(webhookSecret as string)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Goldsky sends { entity, payload } format
    const { entity, payload } = req.body;

    // Handle BridgeInitiated event from your router
    if (entity === "bridge_event") {

        const {
            transaction_hash,
            bridge_id,
            user,
            amount,
            destination_domain,
            nonce,
        } = payload;

        if (!transaction_hash || !bridge_id || !nonce) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        try {

            // Check if this burn is already tracked
            const existing = await db
                .select()
                .from(transactions)
                .where(eq(transactions.burnTxHash, transaction_hash))
                .limit(1);

            if (existing.length > 0) {
                // Already tracked by sdk.trackBurn() — skip
                return res.json({ received: true, matched: false, reason: "already tracked" });
            }

            // Insert burn record if not already tracked
            // This handles cases where sdk.trackBurn() was not called
            await db.insert(transactions).values({
                burnTxHash: transaction_hash,
                bridgeId: bridge_id,
                wallet: user,
                amount: (Number(amount) / 1e6).toString(),
                sourceChain: "unknown",
                destinationChain: destination_domain.toString(),
                nonce: nonce.toString(),
                status: "burned",
            });

            console.log(`BridgeInitiated tracked via Goldsky — tx: ${transaction_hash}`);
            return res.json({ received: true, matched: true });

        } catch (err: any) {
            console.error("Goldsky hook error:", err.message);
            return res.status(500).json({ error: "Internal server error" });
        }
    }

    return res.json({ received: true });
});