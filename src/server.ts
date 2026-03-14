import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { trackBurnRoute } from "./routes/trackBurn";
import { transactionsRoute } from "./routes/transactions";
import { statsRoute } from "./routes/stats";
import { activityRoute } from "./routes/activity";
import { goldskyHookRoute } from "./routes/goldskyHook";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/track", trackBurnRoute);
app.use("/transactions", transactionsRoute);
app.use("/analytics", statsRoute);
app.use("/activity", activityRoute);
app.use("/hooks", goldskyHookRoute);    // Goldsky sends mint events here

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Start server
app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
});

export default app;