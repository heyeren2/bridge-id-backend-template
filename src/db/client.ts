import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

// ----------------------------------------------------------------
// PostgreSQL connection pool
// Reads DATABASE_URL from your .env file
// ----------------------------------------------------------------
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });

// Test connection on startup
pool.connect((err, client, release) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Database connected successfully");
        
        // --- Self-healing: Ensure amount_received column exists ---
        client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_received numeric;', (qErr) => {
            if (qErr) console.warn("Could not auto-add amount_received:", qErr.message);
            else console.log("✓ amount_received column check passed");
            release();
        });
    }
});