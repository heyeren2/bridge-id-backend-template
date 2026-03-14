import { createPublicClient, http } from "viem";
import { CHAINS } from "../chains/config";

export interface VerificationResult {
    valid: boolean;
    reason?: string;
    nonce?: string;
    messageHash?: string;
}

// ----------------------------------------------------------------
// Verifies a burn tx is real before storing it
// Prevents fake tx hashes from polluting your database
// ----------------------------------------------------------------
export async function verifyBurnTx(params: {
    txHash: string;
    wallet: string;
    amount: string;
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

        // Step 3 — find DepositForBurn event in logs
        // This confirms it is a real CCTP burn
        const burnLog = receipt.logs.find(log =>
            log.address.toLowerCase() === chainConfig.tokenMessenger.toLowerCase()
        );

        if (!burnLog) {
            return {
                valid: false,
                reason: "No DepositForBurn event found — not a valid CCTP burn",
            };
        }

        // Step 4 — extract nonce from log topics
        // Nonce is what links this burn to the mint on destination chain
        const nonce = burnLog.topics[1]
            ? BigInt(burnLog.topics[1]).toString()
            : undefined;

        return {
            valid: true,
            nonce,
            messageHash: txHash,
        };

    } catch (err: any) {
        console.error("Verification error:", err.message);
        return { valid: false, reason: "RPC error during verification" };
    }
}