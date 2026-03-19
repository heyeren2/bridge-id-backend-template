import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions } from "../db/schema";
import { eq } from "drizzle-orm";

export const trackAttestationRoute = Router();

trackAttestationRoute.post("/attestation", async (req: Request, res: Response) => {

    const { burnTxHash, bridgeId, success } = req.body;

    if (!burnTxHash || !bridgeId) {
        return res.status(400).json({ error: "Missing required fields (burnTxHash, bridgeId)" });
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

        const newStatus = success ? "attested" : "attestation_failed";

        await db
            .update(transactions)
            .set({ status: newStatus })
            .where(eq(transactions.burnTxHash, burnTxHash));

        console.log(`[Attestation] ${burnTxHash} → ${newStatus}`);
        return res.json({ success: true, status: newStatus });

    } catch (err: any) {
        console.error("Failed to update attestation status:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});
