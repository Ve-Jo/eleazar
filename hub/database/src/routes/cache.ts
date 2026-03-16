import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type CacheRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
};

// Get from cache
router.get("/:key", async (req: CacheRouteRequest, res: ResponseLike) => {
  try {
    const key = req.params.key ?? "";
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    const decodedKey = decodeURIComponent(key);

    const value = await Database.getFromCache(decodedKey);
    res.json(serializeBigInt({ value }));
  } catch (error) {
    console.error("Error getting from cache:", error);
    res.status(500).json({ error: "Failed to get from cache" });
  }
});

// Set cache value
router.put("/:key", async (req: CacheRouteRequest, res: ResponseLike) => {
  try {
    const key = req.params.key ?? "";
    const { value, ttl } = req.body;
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    const decodedKey = decodeURIComponent(key);

    if (value === undefined) {
      return res.status(400).json({ error: "value is required" });
    }

    const normalizedTtl = null;
    const result = await Database.setCache(decodedKey, value, normalizedTtl);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error setting cache:", error);
    res.status(500).json({ error: "Failed to set cache" });
  }
});

// Invalidate cache keys
router.post("/invalidate", async (req: CacheRouteRequest, res: ResponseLike) => {
  try {
    const keys = req.body.keys;

    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: "keys array is required" });
    }

    const result = await Database.invalidateCache(keys);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error invalidating cache:", error);
    res.status(500).json({ error: "Failed to invalidate cache" });
  }
});

// Delete cache key
router.delete("/:key", async (req: CacheRouteRequest, res: ResponseLike) => {
  try {
    const key = req.params.key ?? "";
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    const decodedKey = decodeURIComponent(key);

    const result = await Database.deleteFromCache(decodedKey);
    res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error deleting from cache:", error);
    res.status(500).json({ error: "Failed to delete from cache" });
  }
});

export default router;
