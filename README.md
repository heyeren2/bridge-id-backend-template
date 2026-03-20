# bridge-id-backend-template

Analytics and tracking backend for [bridge-id-sdk](https://www.npmjs.com/package/bridge-id-sdk).

Tracks the full burn→attestation→mint lifecycle for any CCTP bridge using the SDK.
Includes a 2-minute backup poller that checks Circle's Iris API for missed updates.

---

## Source Code

- **SDK Repository**: [github.com/heyeren2/bridge-id-sdk](https://github.com/heyeren2/bridge-id-sdk)

---

## What This Backend Does

```
Your Bridge Frontend              This Backend
──────────────────              ────────────────
User burns USDC
        │
        ├─ sdk.trackBurn()  ──►  POST /track/burn
        │                        stores burn (status: "burned")
        │
        ├─ sdk.trackAttestation() ──►  POST /track/attestation
        │                              updates to "attested" or "attestation_failed"
        │
        └─ sdk.trackMint()  ──►  POST /track/mint
                                 updates to "completed" or "mint_failed"
                                         │
                                         ▼
                                 GET /activity/:wallet
                                 GET /transactions
                                 GET /analytics/stats
                                         ▲
                                         │
                                 Your frontend queries these
```

**Backup:** A poller checks Circle's Iris API every 2 minutes for any stuck
`"burned"` or `"attested"` transactions and auto-updates them if the mint is detected.

---

## Tech Stack

| Layer       | Tool                         |
|-------------|------------------------------|
| Server      | Express + TypeScript         |
| Database    | Neon (serverless PostgreSQL) |
| ORM         | Drizzle ORM                  |
| Backup      | Circle Iris API poller       |
| Deployment  | Render                       |

---

## Prerequisites

Before starting, make sure you have accounts on:
- [Neon](https://neon.tech) - free tier is enough
- [Render](https://render.com) - free tier is enough
- [GitHub](https://github.com) - to connect with Render

---

## Part 1 — Clone and Set Up Locally

```bash
git clone https://github.com/heyeren2/bridge-id-backend-template.git
cd bridge-id-backend-template
npm install
```

Copy the example env file:
```bash
cp .env.example .env
```

Your `.env` file needs these values:

```env
PORT=3001
DATABASE_URL=

SEPOLIA_RPC_URL=
BASE_RPC_URL=
ARC_RPC_URL=
```

---

## Part 2 — Connect Neon Database

### 2.1 Create a Neon project

1. Go to [neon.tech](https://neon.tech) and sign in
2. Click **New Project**
3. Name it `bridge-id-backend`
4. Select region closest to your users (Frankfurt or US East recommended)
5. Click **Create Project**

### 2.2 Get your connection string

1. On your Neon dashboard, click **Connection Details**
2. Select **Node.js** from the dropdown
3. Copy the connection string — it looks like:
```
postgresql://neondb_owner:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```
4. Paste it as `DATABASE_URL` in your `.env`

### 2.3 Run database migrations

This creates the 4 required tables in your Neon database:

```bash
npm run db:push
```

You should see:
```
✓ bridges table created
✓ transactions table created
✓ users table created
✓ bridge_stats table created

### 2.4 Register your Bridge ID
Your backend only processes tracking for "Registered" IDs. Run this script once to whitelist yours:

```bash
node scripts/register-bridge.js --id "your_bridge_id" --name "Project Name"
```

```

---

## Part 3 — Deploy to Render

### 3.1 Push your repo to GitHub

Make sure your backend code is in a GitHub repository (private is fine):

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bridge-id-backend.git
git branch -M main
git push -u origin main
```

### 3.2 Create a Render web service

1. Go to [render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect your GitHub account and select your backend repo
4. Configure the service:

| Setting        | Value                          |
|----------------|--------------------------------|
| Name           | `bridge-id-backend`            |
| Region         | Frankfurt (EU) or Ohio         |
| Branch         | `main`                         |
| Runtime        | Node                           |
| Build Command  | `npm install && npm run build` |
| Start Command  | `npm start`                    |
| Instance Type  | Free                           |

### 3.3 Add environment variables on Render

In your Render service go to **Environment** and add all variables
from your `.env` file. Do NOT commit your `.env` to GitHub.

```
DATABASE_URL           → your Neon connection string
SEPOLIA_RPC_URL        → your Alchemy/Infura Sepolia RPC
BASE_RPC_URL           → your Alchemy/Infura Base Sepolia RPC
ARC_RPC_URL            → https://rpc.testnet.arc.network
```

### 3.4 Deploy

Click **Deploy**. Once done your backend will be live at:
```
https://YOURBACKENDNAME.onrender.com
```

Verify it's running:
```bash
curl https://YOURBACKENDNAME.onrender.com/health
# → { "status": "ok" }
```

> **Note:** Render free tier spins down after 15 minutes of inactivity.
> The first request after idle takes ~50 seconds. Upgrade to a paid
> instance to avoid cold starts in production.

---

## Part 4 — Integrate the SDK Into Your Bridge Frontend

### 4.1 Install the SDK

```bash
npm install bridge-id-sdk
```

### 4.2 Generate your Bridge ID

Run this once. This ID permanently links all your transactions in the backend.

```bash
node scripts/generate-bridge-id.js --name "MyBridge" --address "0xYOUR_FEE_RECIPIENT_ADDRESS"
```

Add the output to your frontend `.env`:
```env
VITE_BRIDGE_ID=mybridge_a3f9c2
VITE_ANALYTICS_URL=https://your-backend.onrender.com
VITE_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_BASE_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
VITE_ARC_RPC=https://rpc.testnet.arc.network
```

### 4.3 Initialize the SDK

```typescript
import { BridgeAnalytics } from "bridge-id-sdk"

const sdk = new BridgeAnalytics({
  bridgeId: import.meta.env.VITE_BRIDGE_ID,
  apiUrl:   import.meta.env.VITE_ANALYTICS_URL,
  rpcUrls: {
    sepolia: import.meta.env.VITE_SEPOLIA_RPC,
    base:    import.meta.env.VITE_BASE_RPC,
    arc:     import.meta.env.VITE_ARC_RPC,
  }
})
```

### 4.4 Track bridge lifecycle

Call these in your frontend's bridge status callbacks:

```typescript
// After burn tx confirms on source chain
await sdk.trackBurn({
  burnTxHash: "0x...",
  wallet: userAddress,
  amount: "100.00",
  sourceChain: "sepolia",
  destinationChain: "base",
})

// When attestation completes (or fails)
await sdk.trackAttestation({
  burnTxHash: "0x...",
  success: true, // or false if attestation failed
})

// When mint completes on destination chain
await sdk.trackMint({
  burnTxHash: "0x...",
  mintTxHash: "0x...",
  success: true,
})
```

### 4.5 Show transaction status

```typescript
const status = await sdk.getStatus(burnTxHash)
// "burned" | "attested" | "attestation_failed" | "mint_failed" | "completed" | "not_found"

if (status.status === "attested") {
  // Show Remint button in your UI
  // Pass status.messageBytes + status.attestation
  // to receiveMessage() on the destination MessageTransmitter
}
```

### 4.6 Render the activity tab

```typescript
const activity = await sdk.getUserActivity(walletAddress)

activity.transactions.forEach(tx => {
  console.log(tx.sourceChain, "→", tx.destinationChain)
  console.log(tx.amount, "USDC")
  console.log(tx.status)
})
```

---

## API Reference

Base URL: `https://your-backend.onrender.com`

---

### `POST /track/burn`

Records a burn transaction. Called by `sdk.trackBurn()`.

**Request body:**
```json
{
  "burnTxHash": "0x...",
  "wallet": "0x...",
  "amount": "100.00",
  "sourceChain": "sepolia",
  "destinationChain": "base",
  "bridgeId": "mybridge_a3f9c2"
}
```

**Response:** `{ "success": true }`

---

### `POST /track/attestation`

Updates attestation status. Called by `sdk.trackAttestation()`.

**Request body:**
```json
{
  "burnTxHash": "0x...",
  "bridgeId": "mybridge_a3f9c2",
  "success": true
}
```

**Response:** `{ "success": true, "status": "attested" }`

---

### `POST /track/mint`

Completes the bridge and updates stats. Called by `sdk.trackMint()`.

**Request body:**
```json
{
  "burnTxHash": "0x...",
  "mintTxHash": "0x...",
  "bridgeId": "mybridge_a3f9c2",
  "success": true
}
```

**Response:** `{ "success": true, "status": "completed" }`

---

### `GET /transactions`

Returns paginated transaction list for a wallet.

**Query params:**

| Param    | Required | Default | Description            |
|----------|----------|---------|------------------------|
| `wallet` | Yes      | —       | Wallet address (0x...) |
| `limit`  | No       | 20      | Number of results      |
| `offset` | No       | 0       | Pagination offset      |

---

### `GET /activity/:wallet`

Returns full activity for a wallet address.

**Example:** `GET /activity/0xabc123...`

---

### `GET /analytics/stats`

Returns aggregate stats for your bridge.

**Query params:** `bridgeId` (required)

---

### `GET /health`

Health check. Returns `{ "status": "ok" }`

---

## Project Structure

```
src/
  server.ts              — Express app, route registration, starts poller
  db/
    client.ts            — Neon database connection
    schema.ts            — Drizzle table definitions
  routes/
    trackBurn.ts         — POST /track/burn
    trackAttestation.ts  — POST /track/attestation
    trackMint.ts         — POST /track/mint
    transactions.ts      — GET /transactions
    activity.ts          — GET /activity/:wallet
    stats.ts             — GET /analytics/stats
  services/
    txVerifier.ts        — On-chain transaction verification
    statusPoller.ts      — Iris API backup poller (every 2 min)
  chains/
    config.ts            — Chain names, IDs, and RPC URLs
drizzle.config.ts
.env.example
```

---

## Transaction Statuses

| Status | Meaning | Activity Tab Action |
|---|---|---|
| `burned` | Burn confirmed, waiting for attestation | — (in progress) |
| `attested` | Attestation complete, waiting for mint | — (in progress) |
| `attestation_failed` | Attestation timed out / Circle down | **Submit Burn Hash** button |
| `mint_failed` | Mint tx reverted | **Remint** button |
| `completed` | Mint confirmed, bridge done | ✅ Done |

---

## Related

- [bridge-id-sdk on npm](https://www.npmjs.com/package/bridge-id-sdk)
- [bridge-id-sdk on GitHub](https://github.com/heyeren2/bridge-id-sdk)
- [Circle CCTP Docs](https://developers.circle.com/stablecoins/cctp-getting-started)

---

## License

MIT