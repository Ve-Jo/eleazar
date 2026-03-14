import express from "express";
import Database from "../client.ts";
import { serializeWithBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type SeasonsRouteRequest = RequestLike & {
  query: Record<string, string | undefined>;
};

router.get("/current", async (_req: SeasonsRouteRequest, res: ResponseLike) => {
  try {
    const season = await Database.getCurrentSeason();
    res.json(serializeWithBigInt(season));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get current season";
    console.error("Error getting current season:", error);
    res.status(500).json({ error: message });
  }
});

router.get("/leaderboard", async (req: SeasonsRouteRequest, res: ResponseLike) => {
  try {
    const seasonId = req.query.seasonId;
    const limitValue = req.query.limit ?? "250";

    if (!seasonId) {
      return res.status(400).json({ error: "seasonId is required" });
    }

    const parsedSeasonId = parseInt(seasonId, 10);
    const parsedLimit = parseInt(limitValue, 10);

    if (Number.isNaN(parsedSeasonId) || Number.isNaN(parsedLimit)) {
      return res.status(400).json({ error: "Invalid seasonId or limit" });
    }

    const leaderboard = await Database.getSeasonLeaderboard(parsedSeasonId, parsedLimit);
    res.json(serializeWithBigInt(leaderboard));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get season leaderboard";
    console.error("Error getting season leaderboard:", error);
    res.status(500).json({ error: message });
  }
});

export default router;
