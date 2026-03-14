# bridge-id-backend-template

A ready-to-deploy analytics backend for Circle CCTP bridge integrators using
[bridge-id-sdk](https://www.npmjs.com/package/bridge-id-sdk).

Tracks burn→mint lifecycle, stores transaction history, and exposes analytics
endpoints for your bridge frontend — powered by Express, Neon (PostgreSQL),
and Goldsky webhooks.

---

## What This Backend Does

```
On-chain (Goldsky)                    Off-chain (This Backend)
──────────────────                    ────────────────────────
BridgeRouter emits                    POST /track/burn
BridgeInitiated event         ──►     saves burn metadata
        │
        ▼
Goldsky subgraph indexes it
        │
        ▼
Goldsky webhook fires         ──►     POST /hooks/goldsky
                                      updates transaction record
                                              │
                                              ▼
                                      GET /activity/:wallet
                                      GET /transactions
                                      GET /analytics/stats
                                              ▲
                                              │
                                      Bridge frontend queries these
```

---

## Tech Stack

| Layer       | Tool                         |
|-------------|------------------------------|
| Server      | Express + TypeScript         |
| Database    | Neon (serverless PostgreSQL) |
| ORM         | Drizzle ORM                  |
| Indexer     | Goldsky subgraphs + webhooks |
| Deployment  | Render                       |

---

## Prerequisites

Before starting, make sure you have accounts on:
- [Neon](https://neon.tech) — free tier is enough
- [Render](https://render.com) — free tier is enough
- [Goldsky](https://goldsky.com) — free tier is enough
- [GitHub](https://github.com) — to connect with Render

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

Your `.env` file needs these values — instructions for each are in the
sections below:

```env
PORT=3001
DATABASE_URL=

SEPOLIA_RPC_URL=
BASE_RPC_URL=
ARC_RPC_URL=

GOLDSKY_SECRET_SEPOLIA=
GOLDSKY_SECRET_BASE=
GOLDSKY_SECRET_ARC=
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
ARC_RPC_URL            → https://rpc.ankr.com/arc_testnet
GOLDSKY_SECRET_SEPOLIA → (generated in Part 4)
GOLDSKY_SECRET_BASE    → (generated in Part 4)
GOLDSKY_SECRET_ARC     → (generated in Part 4)
```

### 3.4 Deploy

Click **Deploy**. Once done your backend will be live at:
```
https://bridge-id-backend.onrender.com
```

Verify it's running:
```bash
curl https://bridge-id-backend.onrender.com/health
# → { "status": "ok" }
```

> **Note:** Render free tier spins down after 15 minutes of inactivity.
> The first request after idle takes ~50 seconds. Upgrade to a paid
> instance to avoid cold starts in production.

---

## Part 4 — Set Up Goldsky Subgraphs and Webhooks

Goldsky indexes your BridgeRouter events on-chain and fires them to your
backend via webhooks — so you never miss a burn event.

### 4.1 Install Goldsky CLI

```bash
curl https://goldsky.com/install | bash
goldsky login
```

### 4.2 Deploy subgraphs for each chain

You need one subgraph per chain. From your `bridge-goldsky` folder:

```bash
goldsky subgraph deploy bridge-router-sepolia/1.0.0 --path .
goldsky subgraph deploy bridge-router-base/1.0.0 --path .
goldsky subgraph deploy bridge-router-arc/1.0.0 --path .
```

Your `subgraph.yaml` must point to the correct BridgeRouter address
for each chain:

| Chain        | Router Address                               |
|--------------|----------------------------------------------|
| Sepolia      | `0xf7552791170732E634F4fB5CD38958eA0B57e193` |
| Base Sepolia | `0x9E4bC829967Ef095053f0E8b339690E49ab3aEB4` |
| Arc          | `0x6FC36fD3396310D755A27FD67a0f90A4b7b58A40` |

### 4.3 Create webhooks for each chain

```bash
goldsky subgraph webhook create bridge-router-sepolia/1.0.0 \
  --name bridge-sepolia-webhook \
  --url https://YOUR_BACKEND_URL/hooks/goldsky \
  --entity bridge_event

goldsky subgraph webhook create bridge-router-base/1.0.0 \
  --name bridge-base-webhook \
  --url https://YOUR_BACKEND_URL/hooks/goldsky \
  --entity bridge_event

goldsky subgraph webhook create bridge-router-arc/1.0.0 \
  --name bridge-arc-webhook \
  --url https://YOUR_BACKEND_URL/hooks/goldsky \
  --entity bridge_event
```

### 4.4 Get webhook secrets

After creating each webhook, Goldsky provides a secret for each one.
Add them to your Render environment variables:

```
GOLDSKY_SECRET_SEPOLIA=whs_xxxx
GOLDSKY_SECRET_BASE=whs_xxxx
GOLDSKY_SECRET_ARC=whs_xxxx
```

Your backend verifies the `goldsky-webhook-secret` header on every
incoming request using these secrets.

### 4.5 Verify webhooks are working

Trigger a test bridge transaction on Sepolia and check your Render logs.
You should see:

```
[goldsky] received bridge_event for bridgeId: mybridge_a3f9c2
[goldsky] transaction saved: 0x...
```

---

## Part 5 — Integrate the SDK Into Your Bridge Frontend

### 5.1 Install the SDK

```bash
npm install bridge-id-sdk
```

### 5.2 Generate your Bridge ID

Run this once. This ID permanently links all your transactions in the backend.

```bash
npx bridgeidsdk --name "MyBridge" --address "0xYOUR_ROUTER_ADDRESS"
```

Add the output to your frontend `.env`:
```env
NEXT_PUBLIC_BRIDGE_ID=mybridge_a3f9c2
NEXT_PUBLIC_ANALYTICS_URL=https://your-backend.onrender.com
NEXT_PUBLIC_SEPOLIA_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_BASE_RPC=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
NEXT_PUBLIC_ARC_RPC=https://rpc.ankr.com/arc_testnet
```

### 5.3 Initialize the SDK

```typescript
import { BridgeAnalytics, BridgeError } from "bridge-id-sdk"

const sdk = new BridgeAnalytics({
  bridgeId: process.env.NEXT_PUBLIC_BRIDGE_ID,
  apiUrl:   process.env.NEXT_PUBLIC_ANALYTICS_URL,
  rpcUrls: {
    sepolia: process.env.NEXT_PUBLIC_SEPOLIA_RPC,
    base:    process.env.NEXT_PUBLIC_BASE_RPC,
    arc:     process.env.NEXT_PUBLIC_ARC_RPC,
  }
})
```

### 5.4 Bridge with full tracking

Only call `sdk.bridge()` when both chains have your router deployed.
For all other routes, call CCTP contracts directly without tracking.

```typescript
const ROUTER_CHAINS = ["sepolia", "base", "arc"]

const bothSupported =
  ROUTER_CHAINS.includes(sourceChain) &&
  ROUTER_CHAINS.includes(destinationChain)

if (bothSupported) {
  try {
    const txHash = await sdk.bridge({
      amount,
      sourceChain,
      destinationChain,
      recipientAddress: userAddress,
      walletClient,
    })
    console.log("Bridge tx:", txHash)
  } catch (err) {
    if (err instanceof BridgeError) {
      console.error(err.code, err.message)
    }
  }
} else {
  // Call CCTP contracts directly — no tracking
  await callCCTPDirectly({ ... })
}
```

### 5.5 Show transaction status

```typescript
const status = await sdk.getStatus(burnTxHash)
// "burned" | "attested" | "minted" | "not_found"

if (status.status === "attested") {
  // Show Remint button in your UI
  // Pass status.messageBytes + status.attestation
  // to receiveMessage() on the destination MessageTransmitter
}
```

### 5.6 Render the activity tab

```typescript
const activity = await sdk.getUserActivity(walletAddress)

activity.transactions.forEach(tx => {
  console.log(tx.sourceChain, "→", tx.destinationChain)
  console.log(tx.amount, "USDC")
  console.log(tx.status) // "burned" | "attested" | "minted" | "failed"
})
```

---

## API Reference

Base URL: `https://your-backend.onrender.com`

---

### `POST /track/burn`

Records a burn transaction. Called automatically by `sdk.bridge()`.

**Request body:**
```json
{
  "burnTxHash": "0x...",
  "wallet": "0x...",
  "amount": "100.00",
  "sourceChain": "sepolia",
  "destinationChain": "base",
  "bridgeId": "mybridge_a3f9c2",
  "timestamp": 1234567890
}
```

**Response:** `200 OK`

---

### `GET /transactions`

Returns paginated transaction list for a wallet.

**Query params:**

| Param    | Required | Default | Description            |
|----------|----------|---------|------------------------|
| `wallet` | Yes      | —       | Wallet address (0x...) |
| `limit`  | No       | 20      | Number of results      |
| `offset` | No       | 0       | Pagination offset      |

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "wallet": "0x...",
      "amount": "100.00",
      "sourceChain": "sepolia",
      "destinationChain": "base",
      "burnTxHash": "0x...",
      "mintTxHash": "0x...",
      "status": "minted",
      "timestamp": 1234567890,
      "bridgeId": "mybridge_a3f9c2"
    }
  ]
}
```

---

### `GET /activity/:wallet`

Returns full activity for a wallet address.

**Example:** `GET /activity/0xabc123...`

**Response:**
```json
{
  "wallet": "0xabc123...",
  "transactions": [
    {
      "burnTxHash": "0x...",
      "mintTxHash": "0x...",
      "amount": "100.00",
      "sourceChain": "sepolia",
      "destinationChain": "base",
      "status": "minted",
      "timestamp": 1234567890
    }
  ]
}
```

---

### `GET /analytics/stats`

Returns aggregate stats for your bridge.

**Response:**
```json
{
  "totalVolume": "52400.00",
  "totalTransactions": 142,
  "uniqueWallets": 89,
  "completedBridges": 138,
  "pendingBridges": 4
}
```

---

### `POST /hooks/goldsky`

Goldsky webhook endpoint. Called automatically by Goldsky when a
`BridgeInitiated` event is indexed. Do not call this manually.

Requires `goldsky-webhook-secret` header matching one of your
`GOLDSKY_SECRET_*` environment variables.

---

### `GET /health`

Health check.

**Response:** `{ "status": "ok" }`

---

## Project Structure

```
src/
  server.ts              — Express app and route registration
  db/
    client.ts            — Neon database connection
    schema.ts            — Drizzle table definitions
  routes/
    trackBurn.ts         — POST /track/burn
    transactions.ts      — GET /transactions
    activity.ts          — GET /activity/:wallet
    stats.ts             — GET /analytics/stats
    goldskyHook.ts       — POST /hooks/goldsky
  services/
    txVerifier.ts        — On-chain transaction verification
  chains/
    config.ts            — Chain addresses and CCTP domains
drizzle.config.ts
.env.example
```

---

## Related

- [bridge-id-sdk on npm](https://www.npmjs.com/package/bridge-id-sdk)
- [bridge-id-sdk on GitHub](https://github.com/heyeren2/bridge-id-sdk)
- [Circle CCTP Docs](https://developers.circle.com/stablecoins/cctp-getting-started)

---

## License

MIT