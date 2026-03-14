export interface ChainConfig {
    chainId: number;
    name: string;
    cctpDomain: number;
    usdcAddress: string;
    tokenMessenger: string;
    messageTransmitter: string;
    routerAddress: string;
    rpcUrl: string;
}

export const CHAINS: Record<string, ChainConfig> = {

    sepolia: {
        chainId: 11155111,
        name: "Sepolia",
        cctpDomain: 0,
        usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
        messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
        routerAddress: "0xf7552791170732E634F4fB5CD38958eA0B57e193",    // fill after deployment
        rpcUrl: process.env.SEPOLIA_RPC_URL || "",
    },

    base: {
        chainId: 84532,
        name: "Base",
        cctpDomain: 6,
        usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
        messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
        routerAddress: "0x9E4bC829967Ef095053f0E8b339690E49ab3aEB4",    // fill after deployment
        rpcUrl: process.env.BASE_RPC_URL || "",
    },

    arc: {
        chainId: 5042002,           // fill in Arc chainId
        name: "Arc",
        cctpDomain: 26,        // fill in Arc CCTP domain
        usdcAddress: "0x3600000000000000000000000000000000000000",      // fill in
        tokenMessenger: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",   // fill in
        messageTransmitter: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275", // fill in
        routerAddress: "0x6FC36fD3396310D755A27FD67a0f90A4b7b58A40",    // fill after deployment
        rpcUrl: process.env.ARC_RPC_URL || "",
    },

};

export function getChainByName(name: string): ChainConfig {
    const chain = CHAINS[name.toLowerCase()];
    if (!chain) throw new Error(`Unknown chain: ${name}`);
    return chain;
}