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
// Polls Circle's Iris API for unfinished burn transactions
// Updates status to "completed" if mint is detected
// This is a backup — the frontend normally sends updates directly
// ----------------------------------------------------------------

async function pollPendingTransactions(): Promise<void> {
    try {
        // Get all transactions that are still pending (burned or attested)
        const pending = await db
            .select()
            .from(transactions)
            .where(inArray(transactions.status, ["burned", "attested"]));

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

                // Check if attestation is complete
                if (irisStatus === "complete" && tx.status === "burned") {
                    await db
                        .update(transactions)
                        .set({ status: "attested" })
                        .where(eq(transactions.burnTxHash, tx.burnTxHash));
                    console.log(`[Poller] ${tx.burnTxHash} → attested`);
                }

                // Check if mint tx exists (destination tx hash)
                const destTxHash = message.destinationTransaction?.transactionHash;

                if (destTxHash) {
                    await db
                        .update(transactions)
                        .set({
                            status: "completed",
                            mintTxHash: destTxHash,
                        })
                        .where(eq(transactions.burnTxHash, tx.burnTxHash));

                    // Update bridge stats
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
                                updatedAt: sql`now()`,
                            },
                        });

                    console.log(`[Poller] ${tx.burnTxHash} → completed (mint: ${destTxHash})`);
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
