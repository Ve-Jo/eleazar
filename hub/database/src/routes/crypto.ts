import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type CryptoRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

router.post("/positions", async (req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const symbol = typeof req.body.symbol === "string" ? req.body.symbol : "";
    const direction = typeof req.body.type === "string" ? req.body.type : "";
    const amount = req.body.amount;
    const price = req.body.price;

    if (!userId || !guildId || !symbol || amount === undefined || price === undefined || !direction) {
      return res.status(400).json({
        error: "userId, guildId, symbol, amount, price, and type are required",
      });
    }

    const position = await Database.createCryptoPosition(guildId, userId, {
      symbol,
      direction,
      entryPrice: price,
      quantity: amount,
    });
    res.json(serializeBigInt(position));
  } catch (error) {
    console.error("Error creating crypto position:", error);
    res.status(500).json({ error: "Failed to create crypto position" });
  }
});

router.get("/positions/:guildId/:userId", async (req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.params.guildId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const positions = await Database.getUserCryptoPositions(guildId, userId);
    res.json(serializeBigInt(positions));
  } catch (error) {
    console.error("Error getting user crypto positions:", error);
    res.status(500).json({ error: "Failed to get user crypto positions" });
  }
});

router.get("/positions/id/:positionId", async (req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const positionId = req.params.positionId ?? "";

    if (!positionId) {
      return res.status(400).json({ error: "positionId is required" });
    }

    const position = await Database.getCryptoPositionById(positionId);

    if (!position) {
      return res.status(404).json({ error: "Crypto position not found" });
    }

    res.json(serializeBigInt(position));
  } catch (error) {
    console.error("Error getting crypto position:", error);
    res.status(500).json({ error: "Failed to get crypto position" });
  }
});

router.put("/positions/:positionId", async (req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const positionId = req.params.positionId ?? "";
    const updateData = req.body;

    if (!positionId) {
      return res.status(400).json({ error: "positionId is required" });
    }

    const position = await Database.updateCryptoPosition(positionId, updateData);
    res.json(serializeBigInt(position));
  } catch (error) {
    console.error("Error updating crypto position:", error);
    res.status(500).json({ error: "Failed to update crypto position" });
  }
});

router.delete("/positions/:positionId", async (req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const positionId = req.params.positionId ?? "";

    if (!positionId) {
      return res.status(400).json({ error: "positionId is required" });
    }

    const result = await Database.deleteCryptoPosition(positionId);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error deleting crypto position:", error);
    res.status(500).json({ error: "Failed to delete crypto position" });
  }
});

router.get("/positions/active/all", async (_req: CryptoRouteRequest, res: ResponseLike) => {
  try {
    const positions = await Database.getAllActiveCryptoPositions();
    res.json(serializeBigInt(positions));
  } catch (error) {
    console.error("Error getting active crypto positions:", error);
    res.status(500).json({ error: "Failed to get active crypto positions" });
  }
});

export default router;
