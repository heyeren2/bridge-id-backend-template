import { db } from "../db/client";
import { transactions, bridgeStats } from "../db/schema";
import { eq, inArray, sql } from "drizzle-orm";

const IRIS_API = "https://iris-api-sandbox.circle.com/v2/messages";
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

// ----------------------------------------------------------------
// Interfaces for Iris API response
// ----------------------------------------------------------------
interface IrisMessage {
    status: string;
    destinationTransaction?: {
        transactionHash: string;
    };
}

interface IrisResponse {
    messages?: IrisMessage[];
}

// ----------------------------------------------------------------
// Polls Circle's Iris API for ALL unfinished transactions:
// - burned: waiting for attestation
// - attested: waiting for mint
// - mint_failed: mint failed, check if it actually went through
// - attestation_failed: check if Circle actually attested it
// Updates DB when the Iris API shows a destination tx exists.
// This acts as a safety net when the frontend SDK tracking fails.
// ----------------------------------------------------------------

async function pollPendingTransactions(): Promise<void> {
    try {
        // Include ALL stuck states — not just burned/attested
        const pending = await db
            .select()
            .from(transactions)
            .where(inArray(transactions.status, [
                "burned",
                "attested",
                "mint_failed",
                "attestation_failed",
            ]));

        if (pending.length === 0) return;

        console.log(`[Poller] Checking ${pending.length} pending transactions...`);

        for (const tx of pending) {
            try {
                // Query Iris API by burn tx hash
                const irisRes = await fetch(
                    `${IRIS_API}?sourceTxHash=${tx.burnTxHash}`
                );

                if (!irisRes.ok) {
                    console.warn(`[Poller] Iris API error for ${tx.burnTxHash}: ${irisRes.status}`);
                    continue;
                }

                const irisData = (await irisRes.json()) as IrisResponse;
                const messages = irisData?.messages || [];

                if (messages.length === 0) continue;

                const message = messages[0];
                const irisStatus = message.status;
                const destTxHash = message.destinationTransaction?.transactionHash;

                // ── Case 1: Mint already happened on-chain (Iris has destination tx) ──
                // This catches mint_failed/attestation_failed that were actually minted
                if (destTxHash) {
                    // Skip if already marked as minted — avoid double-counting stats
                    if (tx.status === "minted" || tx.mintTxHash === destTxHash) {
                        continue;
                    }

                    await db
                        .update(transactions)
                        .set({
                            status: "minted",
                            mintTxHash: destTxHash,
                        })
                        .where(eq(transactions.burnTxHash, tx.burnTxHash));

                    // Update bridge stats (only if not previously counted)
                    if (tx.status !== "minted" && !tx.mintTxHash) {
                        await db
                            .insert(bridgeStats)
                            .values({
                                bridgeId: tx.bridgeId,
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

                    console.log(`[Poller] ✅ ${tx.burnTxHash} → minted (dest: ${destTxHash})`);
                    continue;
                }

                // ── Case 2: Attestation is ready but we haven't minted yet ──
                if (irisStatus === "complete" && tx.status === "burned") {
                    await db
                        .update(transactions)
                        .set({ status: "attested" })
                        .where(eq(transactions.burnTxHash, tx.burnTxHash));
                    console.log(`[Poller] 🔄 ${tx.burnTxHash} → attested`);
                }

                // ── Case 3: Iris shows attestation failed ──
                if (irisStatus === "failed" && tx.status !== "attestation_failed") {
                    await db
                        .update(transactions)
                        .set({ status: "attestation_failed" })
                        .where(eq(transactions.burnTxHash, tx.burnTxHash));
                    console.log(`[Poller] ❌ ${tx.burnTxHash} → attestation_failed`);
                }

            } catch (err: any) {
                console.error(`[Poller] Error checking ${tx.burnTxHash}:`, err.message);
            }
        }
    } catch (err: any) {
        console.error("[Poller] Poll cycle failed:", err.message);
    }
}

export function startStatusPoller(): void {
    console.log(`[Poller] Starting — checking every ${POLL_INTERVAL_MS / 1000}s`);

    // Run immediately on startup, then every 2 minutes
    pollPendingTransactions();
    setInterval(pollPendingTransactions, POLL_INTERVAL_MS);
}
