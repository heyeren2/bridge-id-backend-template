import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { trackBurnRoute } from "./routes/trackBurn";
import { trackAttestationRoute } from "./routes/trackAttestation";
import { trackMintRoute } from "./routes/trackMint";
import { transactionsRoute } from "./routes/transactions";
import { statsRoute } from "./routes/stats";
import { activityRoute } from "./routes/activity";
import { startStatusPoller } from "./services/statusPoller";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/track", trackBurnRoute);
app.use("/track", trackAttestationRoute);
app.use("/track", trackMintRoute);
app.use("/transactions", transactionsRoute);
app.use("/analytics", statsRoute);
app.use("/activity", activityRoute);

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Start server
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);

    // Start the Iris API poller (every 2 minutes)
    startStatusPoller();
});

export default app;