import express from "express";
import Database from "../client.js";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type MarriageRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

router.get("/status/:userId", async (req: MarriageRouteRequest, res: ResponseLike) => {
  try {
    const userId = req.params.userId ?? "";
    const guildId = req.query.guildId;

    if (!userId || !guildId) {
      return res.status(400).json({ error: "guildId and userId are required" });
    }

    const status = await Database.getMarriageStatus(guildId, userId);
    res.json(serializeBigInt(status));
  } catch (error) {
    console.error("Error getting marriage status:", error);
    res.status(500).json({ error: "Failed to get marriage status" });
  }
});

router.post("/propose", async (req: MarriageRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId1 = typeof req.body.userId1 === "string" ? req.body.userId1 : "";
    const userId2 = typeof req.body.userId2 === "string" ? req.body.userId2 : "";

    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({
        error: "guildId, userId1, and userId2 are required",
      });
    }

    const result = await Database.proposeMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error proposing marriage:", error);
    res.status(500).json({ error: "Failed to propose marriage" });
  }
});

router.post("/accept", async (req: MarriageRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId1 = typeof req.body.userId1 === "string" ? req.body.userId1 : "";
    const userId2 = typeof req.body.userId2 === "string" ? req.body.userId2 : "";

    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({
        error: "guildId, userId1, and userId2 are required",
      });
    }

    const result = await Database.acceptMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error accepting marriage:", error);
    res.status(500).json({ error: "Failed to accept marriage" });
  }
});

router.post("/reject", async (req: MarriageRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId1 = typeof req.body.userId1 === "string" ? req.body.userId1 : "";
    const userId2 = typeof req.body.userId2 === "string" ? req.body.userId2 : "";

    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({
        error: "guildId, userId1, and userId2 are required",
      });
    }

    const result = await Database.rejectMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error rejecting marriage:", error);
    res.status(500).json({ error: "Failed to reject marriage" });
  }
});

router.post("/dissolve", async (req: MarriageRouteRequest, res: ResponseLike) => {
  try {
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const userId1 = typeof req.body.userId1 === "string" ? req.body.userId1 : "";
    const userId2 = typeof req.body.userId2 === "string" ? req.body.userId2 : "";

    if (!guildId || !userId1 || !userId2) {
      return res.status(400).json({
        error: "guildId, userId1, and userId2 are required",
      });
    }

    const result = await Database.dissolveMarriage(guildId, userId1, userId2);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error dissolving marriage:", error);
    res.status(500).json({ error: "Failed to dissolve marriage" });
  }
});

export default router;
