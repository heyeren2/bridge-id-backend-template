import { pgTable, serial, text, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";

// ----------------------------------------------------------------
// bridges
// One row per registered bridge integrator
// ----------------------------------------------------------------
export const bridges = pgTable("bridges", {
    id: serial("id").primaryKey(),
    bridgeId: text("bridge_id").notNull().unique(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
});

// ----------------------------------------------------------------
// transactions
// One row per bridge attempt
// burnTxHash is unique per burn
// ----------------------------------------------------------------
export const transactions = pgTable("transactions", {
    id: serial("id").primaryKey(),
    bridgeId: text("bridge_id").notNull(),
    wallet: text("wallet").notNull(),
    amount: numeric("amount").notNull(),
    sourceChain: text("source_chain").notNull(),
    destinationChain: text("destination_chain").notNull(),
    burnTxHash: text("burn_tx_hash").notNull().unique(),
    mintTxHash: text("mint_tx_hash"),
    status: text("status").notNull().default("burned"),
    timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
    walletIdx: index("wallet_idx").on(table.wallet),
    bridgeIdIdx: index("bridge_id_idx").on(table.bridgeId),
}));

// ----------------------------------------------------------------
// users
// Tracks unique wallets
// ----------------------------------------------------------------
export const users = pgTable("users", {
    id: serial("id").primaryKey(),
    wallet: text("wallet").notNull().unique(),
    firstSeen: timestamp("first_seen").defaultNow(),
    totalBridges: integer("total_bridges").default(0),
});

// ----------------------------------------------------------------
// bridge_stats
// Precomputed analytics per bridge
// Updated after every confirmed mint
// ----------------------------------------------------------------
export const bridgeStats = pgTable("bridge_stats", {
    id: serial("id").primaryKey(),
    bridgeId: text("bridge_id").notNull().unique(),
    totalVolume: numeric("total_volume").default("0"),
    totalTransactions: integer("total_transactions").default(0),
    totalUsers: integer("total_users").default(0),
    dailyVolume: numeric("daily_volume").default("0"),
    weeklyVolume: numeric("weekly_volume").default("0"),
    monthlyVolume: numeric("monthly_volume").default("0"),
    updatedAt: timestamp("updated_at").defaultNow(),
});