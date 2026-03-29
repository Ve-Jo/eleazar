import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";
import { notifyLinkedRolesMetricUpdated } from "../services/linkedRolesNotifier.ts";

const router = express.Router();

type XPRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

router.post("/add", async (req: XPRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const amount = typeof req.body.amount === "number" ? req.body.amount : undefined;

    if (!userId || !guildId || amount === undefined) {
      return res.status(400).json({
        error: "userId, guildId, and amount are required",
      });
    }

    const result = await Database.addXP(guildId, userId, amount);
    void notifyLinkedRolesMetricUpdated({
      userId,
      guildId,
      reason: "xp_add",
      source: "database/xp.add",
    });
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding XP:", error);
    res.status(500).json({ error: "Failed to add XP" });
  }
});

router.get("/level/:guildId/:userId", async (req: XPRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";
    const type = typeof req.query.type === "string" ? req.query.type : "activity";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const level = await Database.getLevel(guildId, userId, type);
    res.json(serializeBigInt(level));
  } catch (error) {
    console.error("Error getting level:", error);
    res.status(500).json({ error: "Failed to get level" });
  }
});

router.get("/levels/:guildId/:userId", async (req: XPRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const levels = await Database.getAllLevels(guildId, userId);
    res.json(serializeBigInt(levels));
  } catch (error) {
    console.error("Error getting all levels:", error);
    res.status(500).json({ error: "Failed to get all levels" });
  }
});

router.post("/calculate", async (req: XPRouteRequest, res: ResponseLike) => {
  try {
    const xp = typeof req.body.xp === "number" ? req.body.xp : undefined;

    if (xp === undefined) {
      return res.status(400).json({ error: "xp is required" });
    }

    const result = await Database.calculateLevel(xp);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error calculating level:", error);
    res.status(500).json({ error: "Failed to calculate level" });
  }
});

router.post("/check-levelup", async (req: XPRouteRequest, res: ResponseLike) => {
  try {
    const oldXp = typeof req.body.oldXp === "number" ? req.body.oldXp : undefined;
    const newXp = typeof req.body.newXp === "number" ? req.body.newXp : undefined;

    if (oldXp === undefined || newXp === undefined) {
      return res.status(400).json({ error: "oldXp and newXp are required" });
    }

    const result = await Database.checkLevelUp(oldXp, newXp);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error checking level up:", error);
    res.status(500).json({ error: "Failed to check level up" });
  }
});

export default router;
