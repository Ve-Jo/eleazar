import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type CooldownRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

type UserWithCooldowns = {
  cooldowns?: unknown;
};

router.get("/:guildId/:userId/:type", async (req: CooldownRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";
    const type = req.params.type ?? "";

    if (!guildId || !userId || !type) {
      return res
        .status(400)
        .json({ error: "guildId, userId, and type are required" });
    }

    const cooldown = await Database.getCooldown(guildId, userId, type);
    res.json(serializeBigInt({ cooldown }));
  } catch (error) {
    console.error("Error getting cooldown:", error);
    res.status(500).json({ error: "Failed to get cooldown" });
  }
});

router.post("/", async (req: CooldownRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const type = typeof req.body.type === "string" ? req.body.type : "";
    const duration = typeof req.body.duration === "number" ? req.body.duration : undefined;

    if (!userId || !guildId || !type || duration === undefined) {
      return res.status(400).json({
        error: "userId, guildId, type, and duration are required",
      });
    }

    const result = await Database.setCooldown(guildId, userId, type, duration);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error setting cooldown:", error);
    res.status(500).json({ error: "Failed to set cooldown" });
  }
});

router.delete("/:guildId/:userId/:type", async (req: CooldownRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";
    const type = req.params.type ?? "";

    if (!guildId || !userId || !type) {
      return res
        .status(400)
        .json({ error: "guildId, userId, and type are required" });
    }

    const result = await Database.updateCooldown(guildId, userId, type);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error deleting cooldown:", error);
    res.status(500).json({ error: "Failed to delete cooldown" });
  }
});

router.get(
  "/crate/:guildId/:userId/:type",
  async (req: CooldownRouteRequest, res: ResponseLike) => {
    try {
      const guildId = req.params.guildId ?? "";
      const userId = req.params.userId ?? "";
      const type = req.params.type ?? "";

      if (!guildId || !userId || !type) {
        return res
          .status(400)
          .json({ error: "guildId, userId, and type are required" });
      }

      const cooldown = await Database.getCrateCooldown(guildId, userId, type);
      res.json(serializeBigInt(cooldown));
    } catch (error) {
      console.error("Error getting crate cooldown:", error);
      res.status(500).json({ error: "Failed to get crate cooldown" });
    }
  }
);

router.get("/:guildId/:userId", async (req: CooldownRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const user = (await Database.getUser(guildId, userId)) as UserWithCooldowns | null;
    const cooldowns =
      user && typeof user.cooldowns === "object" && user.cooldowns !== null
        ? user.cooldowns
        : {};

    res.json(serializeBigInt({ cooldowns }));
  } catch (error) {
    console.error("Error getting user cooldowns:", error);
    res.status(500).json({ error: "Failed to get user cooldowns" });
  }
});

export default router;
