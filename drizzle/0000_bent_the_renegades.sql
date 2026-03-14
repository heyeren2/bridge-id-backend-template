CREATE TABLE IF NOT EXISTS "bridge_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"bridge_id" text NOT NULL,
	"total_volume" numeric DEFAULT '0',
	"total_transactions" integer DEFAULT 0,
	"total_users" integer DEFAULT 0,
	"daily_volume" numeric DEFAULT '0',
	"weekly_volume" numeric DEFAULT '0',
	"monthly_volume" numeric DEFAULT '0',
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bridge_stats_bridge_id_unique" UNIQUE("bridge_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bridges" (
	"id" serial PRIMARY KEY NOT NULL,
	"bridge_id" text NOT NULL,
	"name" text NOT NULL,
	"router_address" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "bridges_bridge_id_unique" UNIQUE("bridge_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bridge_id" text NOT NULL,
	"wallet" text NOT NULL,
	"amount" numeric NOT NULL,
	"source_chain" text NOT NULL,
	"destination_chain" text NOT NULL,
	"burn_tx_hash" text NOT NULL,
	"mint_tx_hash" text,
	"nonce" text,
	"message_hash" text,
	"status" text DEFAULT 'burned' NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	CONSTRAINT "transactions_burn_tx_hash_unique" UNIQUE("burn_tx_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"first_seen" timestamp DEFAULT now(),
	"total_bridges" integer DEFAULT 0,
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_idx" ON "transactions" ("wallet");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bridge_id_idx" ON "transactions" ("bridge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nonce_idx" ON "transactions" ("nonce");