import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";
import { notifyLinkedRolesMetricUpdated } from "../services/linkedRolesNotifier.ts";

const router = express.Router();

type GamesRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

router.get("/leaderboard", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const category = req.query.category;
    const scope = req.query.scope ?? "local";
    const guildId = req.query.guildId;
    const limitRaw = req.query.limit ?? "250";
    const limit = parseInt(limitRaw, 10);

    if (category !== "games" && category !== "2048" && category !== "snake") {
      return res.status(400).json({ error: "category must be games, 2048, or snake" });
    }

    if (scope !== "local" && scope !== "global") {
      return res.status(400).json({ error: "scope must be local or global" });
    }

    if (scope === "local" && !guildId) {
      return res.status(400).json({ error: "guildId is required for local scope" });
    }

    if (Number.isNaN(limit) || limit <= 0) {
      return res.status(400).json({ error: "limit must be a positive number" });
    }

    const leaderboard = await Database.getGameLeaderboard(category, scope, guildId, limit);
    res.json(serializeBigInt(leaderboard));
  } catch (error) {
    console.error("Error getting game leaderboard:", error);
    res.status(500).json({ error: "Failed to get game leaderboard" });
  }
});

router.get("/records/:guildId/:userId", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const records = await Database.getGameRecords(guildId, userId);
    res.json(serializeBigInt(records));
  } catch (error) {
    console.error("Error getting game records:", error);
    res.status(500).json({ error: "Failed to get game records" });
  }
});

router.post("/records/update", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const gameId = typeof req.body.gameId === "string" ? req.body.gameId : "";
    const score = typeof req.body.score === "number" ? req.body.score : undefined;

    if (!userId || !guildId || !gameId || score === undefined) {
      return res.status(400).json({
        error: "userId, guildId, gameId, and score are required",
      });
    }

    const result = await Database.updateGameHighScore(guildId, userId, gameId, score);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error updating game record:", error);
    res.status(500).json({ error: "Failed to update game record" });
  }
});

router.get("/earnings/:guildId/:userId/:gameId", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";
    const gameId = req.params.gameId ?? "";

    if (!userId || !guildId || !gameId) {
      return res.status(400).json({ error: "userId, guildId, and gameId are required" });
    }

    const result = await Database.getGameDailyStatus(guildId, userId, gameId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error getting game earning status:", error);
    res.status(500).json({ error: "Failed to get game earning status" });
  }
});

router.post("/earnings/award", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const gameId = typeof req.body.gameId === "string" ? req.body.gameId : "";
    const amount = typeof req.body.amount === "number" ? req.body.amount : undefined;

    if (!userId || !guildId || !gameId || amount === undefined) {
      return res.status(400).json({
        error: "userId, guildId, gameId, and amount are required",
      });
    }

    const result = await Database.awardGameDailyEarnings(guildId, userId, gameId, amount);
    void notifyLinkedRolesMetricUpdated({
      userId,
      guildId,
      reason: "game_earnings_award",
      source: "database/games.earnings.award",
    });
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error awarding game earnings:", error);
    res.status(500).json({ error: "Failed to award game earnings" });
  }
});

router.post("/xp/add", async (req: GamesRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const gameType = typeof req.body.gameType === "string" ? req.body.gameType : "";
    const xp = typeof req.body.xp === "number" ? req.body.xp : undefined;

    if (!userId || !guildId || !gameType || xp === undefined) {
      return res.status(400).json({
        error: "userId, guildId, gameType, and xp are required",
      });
    }

    const result = await Database.addGameXP(guildId, userId, gameType, xp);
    void notifyLinkedRolesMetricUpdated({
      userId,
      guildId,
      reason: "game_xp_add",
      source: "database/games.xp.add",
    });
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding game XP:", error);
    res.status(500).json({ error: "Failed to add game XP" });
  }
});

export default router;
