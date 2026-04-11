import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { transactions } from "../db/schema";
import { eq } from "drizzle-orm";

export const trackStatusRoute = Router();

// ----------------------------------------------------------------
// POST /track/status
//
// Direct status override for recovery scenarios:
//   - Cancelled mint  → status: "mint_failed"
//   - Cancelled attest → status: "attestation_failed"
//
// This is a RELIABLE fallback that bypasses the Circle SDK tracking
// calls, which can fail silently due to network errors or SDK bugs.
//
// SAFETY RULES:
//   - Only allows setting "recovery" statuses (not minted/completed).
//   - Never downgrades a completed/minted transaction.
//   - Requires a valid bridgeId for basic auth.
// ----------------------------------------------------------------

const ALLOWED_STATUSES = new Set([
    "mint_failed",
    "attestation_failed",
    "attested",      // Allow upgrading burned → attested if attestation succeeded
]);

const PROTECTED_STATUSES = new Set([
    "minted",
    "completed",
]);

trackStatusRoute.post("/status", async (req: Request, res: Response) => {
    const { burnTxHash, bridgeId, status, mintTxHash } = req.body;

    if (!burnTxHash || !bridgeId || !status) {
        return res.status(400).json({ error: "Missing required fields: burnTxHash, bridgeId, status" });
    }

    if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({
            error: `Invalid status. Allowed values: ${[...ALLOWED_STATUSES].join(", ")}`
        });
    }

    try {
        const existing = await db
            .select()
            .from(transactions)
            .where(eq(transactions.burnTxHash, burnTxHash))
            .limit(1);

        if (existing.length === 0) {
            return res.status(404).json({ error: "Transaction not found" });
        }

        if (existing[0].bridgeId !== bridgeId) {
            return res.status(403).json({ error: "Bridge ID mismatch" });
        }

        // Never downgrade a completed or minted transaction
        const currentStatus = existing[0].status;
        if (PROTECTED_STATUSES.has(currentStatus)) {
            console.log(`[Status] Skipping — tx ${burnTxHash} already ${currentStatus}`);
            return res.json({ success: true, status: currentStatus, skipped: true });
        }

        const updateData: Record<string, string | null> = { status };
        if (mintTxHash) {
            updateData.mintTxHash = mintTxHash;
        }

        await db
            .update(transactions)
            .set(updateData)
            .where(eq(transactions.burnTxHash, burnTxHash));

        console.log(`[Status] ${burnTxHash}: ${currentStatus} → ${status}`);
        return res.json({ success: true, status });

    } catch (err: any) {
        console.error("Failed to update transaction status:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});
