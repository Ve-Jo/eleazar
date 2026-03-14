import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type GuildsRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

router.get("/:guildId", async (req: GuildsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const guild = await Database.getGuild(guildId);

    if (!guild) {
      return res.status(404).json({ error: "Guild not found" });
    }

    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error("Error getting guild:", error);
    res.status(500).json({ error: "Failed to get guild" });
  }
});

router.post("/ensure", async (req: GuildsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const guild = await Database.ensureGuild(guildId);
    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error("Error ensuring guild:", error);
    res.status(500).json({ error: "Failed to ensure guild" });
  }
});

router.put("/:guildId", async (req: GuildsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const guildData = req.body;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const guild = await Database.upsertGuild(guildId, guildData);
    res.json(serializeBigInt(guild));
  } catch (error) {
    console.error("Error upserting guild:", error);
    res.status(500).json({ error: "Failed to upsert guild" });
  }
});

router.get("/:guildId/users", async (req: GuildsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const users = await Database.getGuildUsers(guildId);
    res.json(serializeBigInt(users));
  } catch (error) {
    console.error("Error getting guild users:", error);
    res.status(500).json({ error: "Failed to get guild users" });
  }
});

router.post("/:guildId/users/ensure", async (req: GuildsRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";

    if (!guildId || !userId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const result = await Database.ensureGuildUser(guildId, userId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error ensuring guild user:", error);
    res.status(500).json({ error: "Failed to ensure guild user" });
  }
});

export default router;
