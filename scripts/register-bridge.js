require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

// Inline schema for script simplicity
const { pgTable, serial, text, timestamp } = require('drizzle-orm/pg-core');

const bridges = pgTable("bridges", {
    id: serial("id").primaryKey(),
    bridgeId: text("bridge_id").notNull().unique(),
    name: text("name").notNull(),
});

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function registerBridge() {
    const args = process.argv.slice(2);
    const idArg = args.indexOf('--id');
    const nameArg = args.indexOf('--name');

    if (idArg === -1 || nameArg === -1 || !args[idArg + 1] || !args[nameArg + 1]) {
        console.log('Usage: node scripts/register-bridge.js --id "your_id" --name "Project Name"');
        process.exit(1);
    }

    const bridgeId = args[idArg + 1];
    const name = args[nameArg + 1];

    console.log(`Registering bridge: ${name} (${bridgeId})...`);

    try {
        await db.insert(bridges).values({
            bridgeId,
            name,
        }).onConflictDoNothing();

        console.log('✅ Bridge registered successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to register bridge:', err.message);
        process.exit(1);
    }
}

registerBridge();
