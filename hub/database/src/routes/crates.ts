import express from "express";
import Database from "../client.ts";
import { serializeWithBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type CratesRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

type ErrorWithMessage = {
  message?: string;
};

router.get("/:guildId/:userId", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const crates = await Database.getUserCrates(guildId, userId);
    res.json(serializeWithBigInt(crates));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error getting user crates:", error);
    res.status(500).json({ error: typedError.message || "Failed to get user crates" });
  }
});

router.get("/:guildId/:userId/:type", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";
    const type = req.params.type ?? "";

    if (!userId || !guildId || !type) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and type are required" });
    }

    const crate = await Database.getUserCrate(guildId, userId, type);
    res.json(serializeWithBigInt(crate));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error getting user crate:", error);
    res.status(500).json({ error: typedError.message || "Failed to get user crate" });
  }
});

router.post("/", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const type = typeof req.body.type === "string" ? req.body.type : "";
    const count = typeof req.body.count === "number" ? req.body.count : 1;

    if (!userId || !guildId || !type) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and type are required" });
    }

    const result = await Database.addCrate(guildId, userId, type, count);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error adding crate:", error);
    res.status(500).json({ error: typedError.message || "Failed to add crate" });
  }
});

router.delete("/:guildId/:userId/:type", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";
    const type = req.params.type ?? "";
    const count = typeof req.body.count === "number" ? req.body.count : 1;

    if (!userId || !guildId || !type) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and type are required" });
    }

    const result = await Database.removeCrate(guildId, userId, type, count);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error removing crate:", error);
    res.status(500).json({ error: typedError.message || "Failed to remove crate" });
  }
});

router.post("/open", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const userId = typeof req.body.userId === "string" ? req.body.userId : "";
    const guildId = typeof req.body.guildId === "string" ? req.body.guildId : "";
    const type = typeof req.body.type === "string" ? req.body.type : "";

    if (!userId || !guildId || !type) {
      return res
        .status(400)
        .json({ error: "userId, guildId, and type are required" });
    }

    const result = await Database.openCrate(guildId, userId, type);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error opening crate:", error);
    res.status(500).json({ error: typedError.message || "Failed to open crate" });
  }
});

router.get("/status/:guildId/:userId/daily", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const result = await Database.getDailyCrateStatus(guildId, userId);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error getting daily crate status:", error);
    res.status(500).json({ error: typedError.message || "Failed to get daily crate status" });
  }
});

router.post("/status/:guildId/:userId/daily/reminded", async (req: CratesRouteRequest, res: ResponseLike) => {
  try {
    const guildId = req.params.guildId ?? "";
    const userId = req.params.userId ?? "";

    if (!userId || !guildId) {
      return res.status(400).json({ error: "userId and guildId are required" });
    }

    const result = await Database.markDailyCrateReminderSent(guildId, userId);
    res.json(serializeWithBigInt(result));
  } catch (error) {
    const typedError = error as ErrorWithMessage;
    console.error("Error marking daily crate reminder:", error);
    res.status(500).json({ error: typedError.message || "Failed to mark daily crate reminder" });
  }
});

export default router;
