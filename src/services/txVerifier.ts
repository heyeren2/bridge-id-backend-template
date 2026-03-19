import { createPublicClient, http } from "viem";
import { CHAINS } from "../chains/config";

export interface VerificationResult {
    valid: boolean;
    reason?: string;
}

// ----------------------------------------------------------------
// Verifies a burn tx is real before storing it
// Checks: tx exists, succeeded, sender matches wallet
// No contract address checks — bridge ID handles filtering
// ----------------------------------------------------------------
export async function verifyBurnTx(params: {
    txHash: string;
    wallet: string;
    chain: string;
}): Promise<VerificationResult> {

    const { txHash, wallet, chain } = params;

    const chainConfig = CHAINS[chain.toLowerCase()];
    if (!chainConfig) {
        return { valid: false, reason: `Unknown chain: ${chain}` };
    }

    if (!chainConfig.rpcUrl) {
        return { valid: false, reason: `No RPC configured for chain: ${chain}` };
    }

    try {
        const client = createPublicClient({
            transport: http(chainConfig.rpcUrl),
        });

        // Step 1 — check tx exists and succeeded
        const receipt = await client.getTransactionReceipt({
            hash: txHash as `0x${string}`,
        });

        if (!receipt) {
            return { valid: false, reason: "Transaction not found" };
        }

        if (receipt.status !== "success") {
            return { valid: false, reason: "Transaction failed on-chain" };
        }

        // Step 2 — check sender matches claimed wallet
        const tx = await client.getTransaction({
            hash: txHash as `0x${string}`,
        });

        if (tx.from.toLowerCase() !== wallet.toLowerCase()) {
            return { valid: false, reason: "Wallet mismatch" };
        }

        return { valid: true };

    } catch (err: any) {
        console.error("Verification error:", err.message);
        return { valid: false, reason: "RPC error during verification" };
    }
}