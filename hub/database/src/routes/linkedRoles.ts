import express from "express";
import Database from "../client.ts";
import { serializeBigInt } from "../utils/serialization.ts";
import type { RequestLike, ResponseLike } from "../types/http.ts";

const router = express.Router();

type LinkedRolesRouteRequest = RequestLike & {
  params: Record<string, string>;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeBigInt(value: unknown, fallback = Date.now() + 3600_000): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.floor(value));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return BigInt(fallback);
    }
  }

  return BigInt(fallback);
}

router.get("/stale", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const beforeMs = req.query.beforeMs ? Number(req.query.beforeMs) : Date.now();
    const limit = req.query.limit ? Number(req.query.limit) : 100;

    const rows = await Database.listStaleLinkedRoleConnections(beforeMs, limit);
    return res.json(serializeBigInt(rows));
  } catch (error) {
    console.error("Error listing stale linked role connections:", error);
    return res.status(500).json({ error: "Failed to list stale linked role connections" });
  }
});

router.get("/:userId", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const record = await Database.getLinkedRoleConnection(userId);
    if (!record) {
      return res.status(404).json({ error: "Linked role connection not found" });
    }

    return res.json(serializeBigInt(record));
  } catch (error) {
    console.error("Error getting linked role connection:", error);
    return res.status(500).json({ error: "Failed to get linked role connection" });
  }
});

router.put("/:userId", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const encryptedAccessToken =
      typeof req.body.encryptedAccessToken === "string"
        ? req.body.encryptedAccessToken
        : "";
    const encryptedRefreshToken =
      typeof req.body.encryptedRefreshToken === "string"
        ? req.body.encryptedRefreshToken
        : "";

    if (!encryptedAccessToken || !encryptedRefreshToken) {
      return res.status(400).json({
        error: "encryptedAccessToken and encryptedRefreshToken are required",
      });
    }

    const selectedGuildId =
      typeof req.body.selectedGuildId === "string" && req.body.selectedGuildId.trim()
        ? req.body.selectedGuildId.trim()
        : null;

    const result = await Database.upsertLinkedRoleConnection(userId, {
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenExpiresAt: normalizeBigInt(req.body.tokenExpiresAt),
      manageableGuildIds: normalizeStringArray(req.body.manageableGuildIds),
      scopes: normalizeStringArray(req.body.scopes),
      selectedGuildId,
      discordUserId:
        typeof req.body.discordUserId === "string" ? req.body.discordUserId : null,
      discordUsername:
        typeof req.body.discordUsername === "string" ? req.body.discordUsername : null,
      syncStatus:
        typeof req.body.syncStatus === "string" ? req.body.syncStatus : "connected",
      lastSyncAt:
        req.body.lastSyncAt === null || req.body.lastSyncAt === undefined
          ? null
          : normalizeBigInt(req.body.lastSyncAt, Date.now()),
      lastSyncError:
        typeof req.body.lastSyncError === "string" ? req.body.lastSyncError : null,
    });

    return res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error upserting linked role connection:", error);
    return res.status(500).json({ error: "Failed to upsert linked role connection" });
  }
});

router.put("/:userId/selected-guild", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const userId = String(req.params.userId || "").trim();
    const selectedGuildId =
      typeof req.body.selectedGuildId === "string" && req.body.selectedGuildId.trim()
        ? req.body.selectedGuildId.trim()
        : null;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await Database.setLinkedRoleSelectedGuild(userId, selectedGuildId);
    return res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error setting linked role selected guild:", error);
    return res.status(500).json({ error: "Failed to set linked role selected guild" });
  }
});

router.patch("/:userId/sync", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const updateData: Record<string, unknown> = {};

    if (typeof req.body.syncStatus === "string") {
      updateData.syncStatus = req.body.syncStatus;
    }

    if ("lastSyncAt" in req.body) {
      if (req.body.lastSyncAt === null || req.body.lastSyncAt === undefined) {
        updateData.lastSyncAt = null;
      } else {
        updateData.lastSyncAt = normalizeBigInt(req.body.lastSyncAt, Date.now());
      }
    }

    if ("lastSyncError" in req.body) {
      if (typeof req.body.lastSyncError === "string") {
        updateData.lastSyncError = req.body.lastSyncError;
      } else if (req.body.lastSyncError === null) {
        updateData.lastSyncError = null;
      }
    }

    if (typeof req.body.encryptedAccessToken === "string") {
      updateData.encryptedAccessToken = req.body.encryptedAccessToken;
    }

    if (typeof req.body.encryptedRefreshToken === "string") {
      updateData.encryptedRefreshToken = req.body.encryptedRefreshToken;
    }

    if (req.body.tokenExpiresAt !== undefined) {
      updateData.tokenExpiresAt = normalizeBigInt(req.body.tokenExpiresAt);
    }

    if (typeof req.body.selectedGuildId === "string") {
      updateData.selectedGuildId = req.body.selectedGuildId || null;
    }

    if (Array.isArray(req.body.manageableGuildIds)) {
      updateData.manageableGuildIds = normalizeStringArray(req.body.manageableGuildIds);
    }

    if (Array.isArray(req.body.scopes)) {
      updateData.scopes = normalizeStringArray(req.body.scopes);
    }

    const result = await Database.updateLinkedRoleConnection(userId, updateData);
    return res.json(serializeBigInt(result));
  } catch (error) {
    console.error("Error updating linked role sync state:", error);
    return res.status(500).json({ error: "Failed to update linked role sync state" });
  }
});

router.delete("/:userId", async (req: LinkedRolesRouteRequest, res: ResponseLike) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const deleted = await Database.deleteLinkedRoleConnection(userId);

    return res.json(serializeBigInt({ success: true, deleted }));
  } catch (error) {
    console.error("Error deleting linked role connection:", error);
    return res.status(500).json({ error: "Failed to delete linked role connection" });
  }
});

export default router;
