import express from "express";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type MusicRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

router.post("/players", async (req: MusicRouteRequest, res: ResponseLike) => {
  try {
    const player = req.body.player;

    if (!player) {
      return res.status(400).json({ error: "player data is required" });
    }

    const result = await Database.savePlayer(player);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error saving player:", error);
    res.status(500).json({ error: "Failed to save player" });
  }
});

router.get("/players", async (_req: MusicRouteRequest, res: ResponseLike) => {
  try {
    const players = await Database.loadPlayers();
    res.json(serializeBigInt(players));
  } catch (error) {
    console.error("Error loading players:", error);
    res.status(500).json({ error: "Failed to load players" });
  }
});

router.get("/players/:guildId", async (req: MusicRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const player = await Database.getPlayer(guildId);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json(serializeBigInt(player));
  } catch (error) {
    console.error("Error getting player:", error);
    res.status(500).json({ error: "Failed to get player" });
  }
});

router.put("/players/:guildId", async (req: MusicRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const data = req.body;

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const result = await Database.updatePlayer(guildId, data);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error updating player:", error);
    res.status(500).json({ error: "Failed to update player" });
  }
});

router.delete("/players/:guildId", async (req: MusicRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";

    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const result = await Database.deletePlayer(guildId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error deleting player:", error);
    res.status(500).json({ error: "Failed to delete player" });
  }
});

export default router;
