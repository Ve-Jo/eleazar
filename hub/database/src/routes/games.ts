import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type GamesRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

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
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding game XP:", error);
    res.status(500).json({ error: "Failed to add game XP" });
  }
});

export default router;
