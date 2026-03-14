import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type LevelsRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

router.get("/roles/:guildId", async (req: LevelsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const levelRoles = await Database.getLevelRoles(guildId);
    res.json(serializeBigInt(levelRoles));
  } catch (error) {
    console.error("Error getting level roles:", error);
    res.status(500).json({ error: "Failed to get level roles" });
  }
});

router.get(
  "/roles/:guildId/level/:level",
  async (req: LevelsRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const level = req.params.level ?? "";

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      const levelNum = parseInt(level, 10);
      if (Number.isNaN(levelNum)) {
        return res.status(400).json({ error: "Invalid level number" });
      }

      const role = await Database.getEligibleLevelRole(guildId, levelNum);
      res.json(serializeBigInt({ role }));
    } catch (error) {
      console.error("Error getting eligible level role:", error);
      res.status(500).json({ error: "Failed to get eligible level role" });
    }
  }
);

router.get(
  "/roles/:guildId/next/:currentLevel",
  async (req: LevelsRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const currentLevel = req.params.currentLevel ?? "";

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      const levelNum = parseInt(currentLevel, 10);
      if (Number.isNaN(levelNum)) {
        return res.status(400).json({ error: "Invalid current level number" });
      }

      const nextRole = await Database.getNextLevelRole(guildId, levelNum);
      res.json(serializeBigInt({ nextRole }));
    } catch (error) {
      console.error("Error getting next level role:", error);
      res.status(500).json({ error: "Failed to get next level role" });
    }
  }
);

router.post("/roles", async (req: LevelsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const levelValue = req.body.level;
    const roleId = typeof req.body.roleId === "string" ? req.body.roleId : "";

    if (!guildId || levelValue === undefined || !roleId) {
      return res.status(400).json({
        error: "guildId, level, and roleId are required",
      });
    }

    const levelNum =
      typeof levelValue === "number"
        ? levelValue
        : typeof levelValue === "string"
          ? parseInt(levelValue, 10)
          : Number.NaN;

    if (Number.isNaN(levelNum)) {
      return res.status(400).json({ error: "Invalid level number" });
    }

    const result = await Database.addLevelRole(guildId, levelNum, roleId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error adding level role:", error);
    res.status(500).json({ error: "Failed to add level role" });
  }
});

router.delete(
  "/roles/:guildId/:level",
  async (req: LevelsRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const level = req.params.level ?? "";

      if (!guildId) {
        return res.status(400).json({ error: "guildId is required" });
      }

      const levelNum = parseInt(level, 10);
      if (Number.isNaN(levelNum)) {
        return res.status(400).json({ error: "Invalid level number" });
      }

      const result = await Database.removeLevelRole(guildId, levelNum);
      res.json(serializeBigInt(result));
    } catch (error) {
      console.error("Error removing level role:", error);
      res.status(500).json({ error: "Failed to remove level role" });
    }
  }
);

export default router;
