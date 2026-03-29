import { randomUUID } from "node:crypto";

import express, { type Request, type Response } from "express";

import { createHealthResponse } from "../../shared/src/utils.ts";
import {
  LINKED_ROLES_INTERNAL_WEBHOOK_KEY,
  LINKED_ROLES_OAUTH_CONTEXT_TTL_MS,
  LINKED_ROLES_SERVICE_PORT,
  LINKED_ROLES_SIGNED_START_MAX_AGE_MS,
  WEB_APP_URL,
} from "./config.ts";
import {
  buildDiscordAuthorizeUrl,
  ensureMetadataSchemaRegistered,
  exchangeCodeForTokens,
  fetchDiscordUser,
} from "./discordApi.ts";
import {
  getLinkedRoleConnection,
  upsertLinkedRoleConnection,
  updateLinkedRoleSelectedGuild,
} from "./databaseApi.ts";
import { encryptString } from "./crypto.ts";
import { enqueueSync, resolveStatusPreview, startSyncEngine } from "./syncEngine.ts";
import type { OAuthStatePayload } from "./types.ts";
import {
  buildSignedContext,
  parseStringArray,
  toNumber,
  verifySignedContext,
} from "./utils.ts";

const app = express();
const oauthStateStore = new Map<string, OAuthStatePayload>();

app.use(express.json({ limit: "1mb" }));

function cleanupExpiredOAuthState(): void {
  const now = Date.now();
  for (const [key, value] of oauthStateStore.entries()) {
    if (value.createdAt + LINKED_ROLES_OAUTH_CONTEXT_TTL_MS < now) {
      oauthStateStore.delete(key);
    }
  }
}

function buildReturnUrl(basePath: string, status: string, details?: string): string {
  const url = new URL(basePath);
  url.searchParams.set("linkedRoles", status);
  if (details) {
    url.searchParams.set("details", details);
  }
  return url.toString();
}

function resolveReturnTo(value: unknown): string {
  const fallback = `${WEB_APP_URL}/app/account`;
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  try {
    const parsed = new URL(value.trim());
    if (!parsed.href.startsWith(WEB_APP_URL)) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
}

function parseSignedStartContext(query: Record<string, unknown>): OAuthStatePayload | null {
  const userId = typeof query.userId === "string" ? query.userId.trim() : "";
  const guildIdsCsv = typeof query.guildIds === "string" ? query.guildIds.trim() : "";
  const ts = typeof query.ts === "string" ? query.ts.trim() : "";
  const sig = typeof query.sig === "string" ? query.sig.trim() : "";
  const returnTo = resolveReturnTo(query.returnTo);

  if (!userId || !ts || !sig || !LINKED_ROLES_INTERNAL_WEBHOOK_KEY) {
    return null;
  }

  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  if (Math.abs(Date.now() - timestamp) > LINKED_ROLES_SIGNED_START_MAX_AGE_MS) {
    return null;
  }

  const expected = buildSignedContext(
    LINKED_ROLES_INTERNAL_WEBHOOK_KEY,
    userId,
    guildIdsCsv,
    ts,
    returnTo
  );
  if (!verifySignedContext(expected, sig)) {
    return null;
  }

  const manageableGuildIds = guildIdsCsv
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    userId,
    manageableGuildIds,
    returnTo,
    createdAt: Date.now(),
  };
}

app.get("/health", (_req: Request, res: Response) => {
  res.json(createHealthResponse("linked-roles", "1.0.0"));
});

app.get("/linked-role", (_req: Request, res: Response) => {
  const accountUrl = `${WEB_APP_URL}/app/account`;
  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Eleazar Linked Roles</title>
  </head>
  <body style="font-family: Arial, sans-serif; padding: 32px;">
    <h1>Eleazar Linked Roles</h1>
    <p>To connect your account and update linked-role metadata, open your account page in Eleazar Hub.</p>
    <p><a href="${accountUrl}">Open account settings</a></p>
  </body>
</html>`);
});

app.get("/oauth/discord/start", (req: Request, res: Response) => {
  cleanupExpiredOAuthState();

  const payload = parseSignedStartContext(req.query as Record<string, unknown>);
  if (!payload) {
    return res.status(401).json({ error: "Invalid signed OAuth start context" });
  }

  const state = randomUUID();
  oauthStateStore.set(state, payload);

  try {
    const authorizeUrl = buildDiscordAuthorizeUrl(state);
    return res.redirect(authorizeUrl);
  } catch (error) {
    return res
      .status(500)
      .json({ error: `Failed to build Discord authorize URL: ${String(error)}` });
  }
});

app.get("/oauth/discord/callback", async (req: Request, res: Response) => {
  cleanupExpiredOAuthState();

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const context = oauthStateStore.get(state);
  oauthStateStore.delete(state);

  const fallbackReturnTo = `${WEB_APP_URL}/app/account`;
  if (!code || !state || !context) {
    return res.redirect(buildReturnUrl(fallbackReturnTo, "oauth_error", "state_or_code_invalid"));
  }

  try {
    const tokenPayload = await exchangeCodeForTokens(code);
    if (!tokenPayload?.access_token || !tokenPayload?.refresh_token) {
      return res.redirect(
        buildReturnUrl(context.returnTo, "oauth_error", "token_payload_incomplete")
      );
    }
    const discordUser = await fetchDiscordUser(tokenPayload.access_token);

    if (String(discordUser.id || "") !== context.userId) {
      return res.redirect(
        buildReturnUrl(context.returnTo, "oauth_error", "discord_user_mismatch")
      );
    }

    const manageableGuildIds = context.manageableGuildIds;
    const selectedGuildId = manageableGuildIds[0] || null;
    const syncStatus = selectedGuildId ? "connected" : "missing_selected_guild";

    await upsertLinkedRoleConnection(context.userId, {
      selectedGuildId,
      manageableGuildIds,
      encryptedAccessToken: encryptString(tokenPayload.access_token),
      encryptedRefreshToken: encryptString(tokenPayload.refresh_token),
      tokenExpiresAt: Date.now() + Number(tokenPayload.expires_in || 3600) * 1000,
      scopes: parseStringArray(
        typeof tokenPayload.scope === "string" ? tokenPayload.scope.split(" ") : []
      ),
      discordUserId: discordUser.id,
      discordUsername:
        discordUser.global_name || discordUser.username || context.userId,
      syncStatus,
      lastSyncAt: null,
      lastSyncError: null,
    });

    enqueueSync(context.userId, "oauth_callback");
    return res.redirect(buildReturnUrl(context.returnTo, "connected"));
  } catch (error) {
    console.error("[linked-roles] OAuth callback failed", error);
    return res.redirect(buildReturnUrl(context.returnTo, "oauth_error", "callback_failed"));
  }
});

app.get("/api/linked-roles/status", async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const connection = await getLinkedRoleConnection(userId);
    if (!connection) {
      return res.json({
        connected: false,
        userId,
        selectedGuildId: null,
        manageableGuildIds: [],
        syncStatus: "disconnected",
        lastSyncAt: null,
        lastSyncError: null,
        metadataPreview: null,
      });
    }

    const metadataPreview = await resolveStatusPreview(userId);
    return res.json({
      connected: true,
      userId,
      selectedGuildId: connection.selectedGuildId,
      manageableGuildIds: parseStringArray(connection.manageableGuildIds),
      syncStatus: connection.syncStatus || "connected",
      lastSyncAt: connection.lastSyncAt ? toNumber(connection.lastSyncAt, Date.now()) : null,
      lastSyncError: connection.lastSyncError || null,
      metadataPreview,
    });
  } catch (error) {
    console.error("[linked-roles] failed to load status", error);
    return res.status(500).json({ error: "Failed to load linked roles status" });
  }
});

app.put("/api/linked-roles/selected-guild", async (req: Request, res: Response) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const selectedGuildId =
      typeof req.body?.selectedGuildId === "string" ? req.body.selectedGuildId.trim() : "";

    if (!userId || !selectedGuildId) {
      return res.status(400).json({ error: "userId and selectedGuildId are required" });
    }

    const connection = await getLinkedRoleConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: "Linked role connection not found" });
    }

    const manageableGuildIds = parseStringArray(connection.manageableGuildIds);
    if (!manageableGuildIds.includes(selectedGuildId)) {
      return res.status(400).json({ error: "selectedGuildId is not in manageable guilds" });
    }

    await updateLinkedRoleSelectedGuild(userId, selectedGuildId);
    enqueueSync(userId, "selected_guild_changed");

    return res.json({ success: true, selectedGuildId });
  } catch (error) {
    console.error("[linked-roles] failed to update selected guild", error);
    return res.status(500).json({ error: "Failed to update selected guild" });
  }
});

app.post("/api/linked-roles/sync-now", async (req: Request, res: Response) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "manual_sync";

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const connection = await getLinkedRoleConnection(userId);
    if (!connection) {
      return res.status(404).json({ error: "Linked role connection not found" });
    }

    enqueueSync(userId, reason);
    return res.json({ queued: true });
  } catch (error) {
    console.error("[linked-roles] sync-now failed", error);
    return res.status(500).json({ error: "Failed to enqueue sync" });
  }
});

app.post("/internal/events/metric-updated", (req: Request, res: Response) => {
  const key = String(req.headers["x-linked-roles-key"] || "").trim();
  if (!LINKED_ROLES_INTERNAL_WEBHOOK_KEY || key !== LINKED_ROLES_INTERNAL_WEBHOOK_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  const reason =
    typeof req.body?.reason === "string"
      ? req.body.reason
      : typeof req.body?.source === "string"
        ? req.body.source
        : "metric_event";

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  enqueueSync(userId, reason, 1_000);
  return res.json({ queued: true });
});

app.listen(LINKED_ROLES_SERVICE_PORT, async () => {
  console.log(`[linked-roles] service running on port ${LINKED_ROLES_SERVICE_PORT}`);

  try {
    await ensureMetadataSchemaRegistered();
    console.log("[linked-roles] metadata schema ensured");
  } catch (error) {
    console.error("[linked-roles] metadata schema ensure failed", error);
  }

  startSyncEngine();
});
