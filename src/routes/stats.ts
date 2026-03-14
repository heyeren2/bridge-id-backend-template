import { Router, Request, Response } from "express";
import { db } from "../db/client";
import { bridgeStats } from "../db/schema";
import { eq } from "drizzle-orm";

export const statsRoute = Router();

// GET /analytics/stats?bridgeId=mybridge_a3f9c2
statsRoute.get("/stats", async (req: Request, res: Response) => {

    const { bridgeId } = req.query;

    if (!bridgeId) {
        return res.status(400).json({ error: "bridgeId is required" });
    }

    try {

        const stats = await db
            .select()
            .from(bridgeStats)
            .where(eq(bridgeStats.bridgeId, bridgeId as string))
            .limit(1);

        if (stats.length === 0) {
            return res.json({
                bridgeId,
                totalVolume: "0",
                totalTransactions: 0,
                totalUsers: 0,
                dailyVolume: "0",
                weeklyVolume: "0",
                monthlyVolume: "0",
            });
        }

        return res.json(stats[0]);

    } catch (err: any) {
        console.error("Failed to fetch stats:", err.message);
        return res.status(500).json({ error: "Internal server error" });
    }
});