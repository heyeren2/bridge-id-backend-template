export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
}

export const CHAINS: Record<string, ChainConfig> = {

    "ethereum sepolia": {
        chainId: 11155111,
        name: "Sepolia",
        rpcUrl: process.env.SEPOLIA_RPC_URL || "",
    },

    "base sepolia": {
        chainId: 84532,
        name: "Base",
        rpcUrl: process.env.BASE_RPC_URL || "",
    },

    "arc testnet": {
        chainId: 5042002,
        name: "Arc",
        rpcUrl: process.env.ARC_RPC_URL || "",
    },

};

export function getChainByName(name: string): ChainConfig {
    const chain = CHAINS[name.toLowerCase()];
    if (!chain) throw new Error(`Unknown chain: ${name}`);
    return chain;
}