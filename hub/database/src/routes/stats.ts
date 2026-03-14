import express from "express";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type StatsRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

router.get("/:guildId/:userId", async (req: StatsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const stats = await Database.getStatistics(guildId, userId);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error("Error getting statistics:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

router.patch("/:guildId/:userId", async (req: StatsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";
    const updateData = req.body;

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const stats = await Database.updateStatistics(guildId, userId, updateData);
    res.json(serializeBigInt(stats));
  } catch (error) {
    console.error("Error updating statistics:", error);
    res.status(500).json({ error: "Failed to update statistics" });
  }
});

router.get(
  "/interactions/:guildId/:userId",
  async (req: StatsRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      const stats = await Database.getInteractionStats(guildId, userId);
      res.json(serializeBigInt(stats));
    } catch (error) {
      console.error("Error getting interaction stats:", error);
      res.status(500).json({ error: "Failed to get interaction stats" });
    }
  }
);

router.get(
  "/interactions/:guildId/:userId/top",
  async (req: StatsRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const limit = req.query.limit;

      if (!guildId || !userId) {
        return res.status(400).json({ error: "guildId and userId are required" });
      }

      const limitNum = limit ? parseInt(limit, 10) : 10;
      if (Number.isNaN(limitNum)) {
        return res.status(400).json({ error: "Invalid limit number" });
      }

      const stats = await Database.getMostUsedInteractions(guildId, userId, limitNum);
      res.json(serializeBigInt(stats));
    } catch (error) {
      console.error("Error getting most used interactions:", error);
      res.status(500).json({ error: "Failed to get most used interactions" });
    }
  }
);

export default router;
