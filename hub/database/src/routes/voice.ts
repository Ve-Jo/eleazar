import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type VoiceRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query?: Record<string, unknown>;
};

router.post("/sessions", async (req: VoiceRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const channelId = typeof req.body.channelId === "string" ? req.body.channelId : "";

    if (!userId || !guildId || !channelId) {
      return res.status(400).json({
        error: "userId, guildId, and channelId are required",
      });
    }

    const joinedAt = typeof req.body.joinedAt === "number" ? req.body.joinedAt : Date.now();
    const session = await Database.createVoiceSession(
      guildId,
      userId,
      channelId,
      joinedAt
    );
    res.json(serializeBigInt(session));
  } catch (error) {
    console.error("Error creating voice session:", error);
    res.status(500).json({ error: "Failed to create voice session" });
  }
});

router.get(
  "/sessions/:guildId/:userId",
  async (req: VoiceRouteRequest, res: ResponseLike) => {
    try {
      const userId = req.params.userId ?? "";
      const guildId = req.params.guildId ?? "";

      if (!userId || !guildId) {
        return res.status(400).json({ error: "userId and guildId are required" });
      }

      const session = await Database.getVoiceSession(guildId, userId);

      if (!session) {
        return res.status(404).json({ error: "Voice session not found" });
      }

      res.json(serializeBigInt(session));
    } catch (error) {
      console.error("Error getting voice session:", error);
      res.status(500).json({ error: "Failed to get voice session" });
    }
  }
);

router.delete(
  "/sessions/:guildId/:userId",
  async (req: VoiceRouteRequest, res: ResponseLike) => {
    try {
      const userId = req.params.userId ?? "";
      const guildId = req.params.guildId ?? "";

      if (!userId || !guildId) {
        return res.status(400).json({ error: "userId and guildId are required" });
      }

      const result = await Database.removeVoiceSession(guildId, userId);
      res.json(serializeBigInt(result));
    } catch (error) {
      console.error("Error removing voice session:", error);
      res.status(500).json({ error: "Failed to remove voice session" });
    }
  }
);

router.get(
  "/sessions/guild/:guildId",
  async (req: VoiceRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      const channelId =
        typeof req.query?.channelId === "string" ? req.query.channelId : undefined;

      const sessions = await Database.getAllVoiceSessions(guildId, channelId);
      res.json(serializeBigInt(sessions));
    } catch (error) {
      console.error("Error getting guild voice sessions:", error);
      res.status(500).json({ error: "Failed to get guild voice sessions" });
    }
  }
);

router.post("/xp/calculate", async (req: VoiceRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const joinedAt = typeof req.body.joinedAt === "number" ? req.body.joinedAt : undefined;
    const timeSpent = typeof req.body.timeSpent === "number" ? req.body.timeSpent : undefined;
    const resolvedJoinedAt =
      joinedAt !== undefined
        ? joinedAt
        : timeSpent !== undefined
          ? Date.now() - Math.max(0, timeSpent)
          : undefined;

    if (!userId || !guildId || resolvedJoinedAt === undefined) {
      return res.status(400).json({
        error: "userId, guildId, and (joinedAt or timeSpent) are required",
      });
    }

    const result = await Database.calculateAndAddVoiceXP(
      guildId,
      userId,
      { joinedAt: resolvedJoinedAt }
    );
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error calculating voice XP:", error);
    res.status(500).json({ error: "Failed to calculate voice XP" });
  }
});

export default router;
