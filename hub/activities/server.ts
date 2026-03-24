import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../shared/src/serviceConfig.ts";
import { createHealthResponse } from "../shared/src/utils.ts";

import { ACTIVITY_GAME_CATALOG } from "./src/lib/gameCatalog.ts";
import { IdempotencyStore } from "./src/lib/idempotencyStore.ts";
import {
  compute2048SessionReward,
  MAX_2048_SESSION_EARNING,
} from "./src/lib/rewardCalculator.ts";

const runtimeFilename = fileURLToPath(import.meta.url);
const runtimeDirname = path.dirname(runtimeFilename);
const hubEnvPath = path.resolve(runtimeDirname, "../.env");
const activitiesEnvPath = path.resolve(runtimeDirname, ".env");

dotenv.config({ path: hubEnvPath });
dotenv.config({ path: activitiesEnvPath, override: true });

const ACTIVITIES_SERVICE_PORT = Number(
  process.env.ACTIVITIES_SERVICE_PORT || DEFAULT_SERVICE_PORTS.activities
);
const DATABASE_SERVICE_URL = (
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database
).replace(/\/$/, "");

const ACTIVITY_CLIENT_ID =
  process.env.ACTIVITY_CLIENT_ID || process.env.DISCORD_CLIENT_ID || "";
const ACTIVITY_CLIENT_SECRET =
  process.env.ACTIVITY_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || "";
const ACTIVITY_PUBLIC_BASE_URL = (process.env.ACTIVITY_PUBLIC_BASE_URL || "").replace(
  /\/$/,
  ""
);
const ACTIVITY_REDIRECT_URI =
  process.env.ACTIVITY_REDIRECT_URI ||
  (ACTIVITY_PUBLIC_BASE_URL
    ? `${ACTIVITY_PUBLIC_BASE_URL}/api/auth/discord/callback`
    : "https://127.0.0.1");
const ACTIVITY_SHARED_KEY =
  process.env.ACTIVITY_SHARED_KEY || process.env.ELEAZAR_ACTIVITIES_SHARED_KEY || "";

const TOKEN_CACHE_TTL_MS = 60 * 1000;
const tokenUserCache = new Map<
  string,
  {
    expiresAt: number;
    user: {
      id: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
      locale?: string;
    };
  }
>();

type JsonResult = {
  ok: boolean;
  status: number;
  data: any;
};

type AuthenticatedRequest = express.Request & {
  authMode?: "bearer" | "activity_key" | "development";
  authUser?: {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    locale?: string;
  };
};

const completionStore = new IdempotencyStore<Record<string, unknown>>();
setInterval(() => completionStore.cleanup(), 5 * 60 * 1000);

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGameId(gameId: string): string {
  return String(gameId || "").trim().toLowerCase();
}

function getDiscordOAuthErrorMessage(payload: any): string {
  if (!payload || typeof payload !== "object") {
    return "Discord OAuth token exchange failed.";
  }

  const error = typeof payload.error === "string" ? payload.error : "oauth_error";
  const description =
    typeof payload.error_description === "string" ? payload.error_description : "";

  return description ? `${error}: ${description}` : error;
}

async function parseJsonResponse(response: Response): Promise<JsonResult> {
  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function fetchDatabase(pathname: string, init?: RequestInit): Promise<JsonResult> {
  const targetPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const response = await fetch(`${DATABASE_SERVICE_URL}${targetPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  return parseJsonResponse(response);
}

async function resolveDiscordUser(accessToken: string) {
  const cached = tokenUserCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const parsed = await parseJsonResponse(response);
  if (!parsed.ok || !parsed.data?.id) {
    throw new Error("Failed to resolve Discord user");
  }

  const user = {
    id: String(parsed.data.id),
    username: parsed.data.username,
    global_name: parsed.data.global_name,
    avatar: parsed.data.avatar,
    locale: parsed.data.locale,
  };

  tokenUserCache.set(accessToken, {
    user,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });

  return user;
}

function createActivityAuthMiddleware(options?: { allowMissingAuth?: boolean }) {
  return async function activityAuthMiddleware(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ) {
    const allowMissingAuth = Boolean(options?.allowMissingAuth);

  if (process.env.NODE_ENV === "development" && process.env.SKIP_AUTH === "true") {
    const devUserId = String(req.headers["x-user-id"] || "preview-user");
    req.authMode = "development";
    req.authUser = {
      id: devUserId,
      username: "Preview User",
    };
    return next();
  }

  const authHeader = String(req.headers.authorization || "");
  if (!authHeader) {
    if (allowMissingAuth) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: missing Authorization header" });
  }

  if (authHeader.startsWith("Activity ")) {
    const providedKey = authHeader.substring("Activity ".length);
    if (!ACTIVITY_SHARED_KEY || providedKey !== ACTIVITY_SHARED_KEY) {
      return res.status(403).json({ error: "Forbidden: invalid activity key" });
    }

    const fallbackUserId = req.headers["x-user-id"];
    if (!fallbackUserId) {
      return res.status(400).json({
        error: "x-user-id header is required when using Activity key auth",
      });
    }

    req.authMode = "activity_key";
    req.authUser = { id: String(fallbackUserId) };
    return next();
  }

  if (authHeader.startsWith("Bearer ")) {
    const accessToken = authHeader.substring("Bearer ".length).trim();

    try {
      const discordUser = await resolveDiscordUser(accessToken);
      req.authMode = "bearer";
      req.authUser = discordUser;
      return next();
    } catch (error) {
      console.error("[activities] failed to resolve bearer token", error);
      return res.status(401).json({ error: "Unauthorized: invalid bearer token" });
    }
  }

  if (allowMissingAuth) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized: unsupported auth scheme" });
  };
}

const requireActivityAuth = createActivityAuthMiddleware();
const optionalActivityAuth = createActivityAuthMiddleware({ allowMissingAuth: true });

async function ensureGuildUser(guildId: string, userId: string): Promise<void> {
  const ensureResult = await fetchDatabase(`/guilds/${guildId}/users/ensure`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  if (!ensureResult.ok) {
    throw new Error(`Failed to ensure guild user: ${ensureResult.status}`);
  }
}

function getUpgradeLevel(upgrades: any[], type: string): number {
  const upgrade = upgrades.find(
    (item) => String(item?.type || "").toLowerCase() === String(type).toLowerCase()
  );
  return Math.max(1, toNumber(upgrade?.level, 1));
}

export function createActivitiesApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json(createHealthResponse("activities", "1.0.0"));
  });

  app.get(["/api/config", "/.proxy/api/config"], (_req, res) => {
    res.json({
      clientId: ACTIVITY_CLIENT_ID,
      redirectUri: ACTIVITY_REDIRECT_URI,
      publicBaseUrl: ACTIVITY_PUBLIC_BASE_URL || null,
      max2048SessionEarning: MAX_2048_SESSION_EARNING,
      entryPointOnly: true,
      games: ACTIVITY_GAME_CATALOG,
    });
  });

  app.get(
    ["/api/auth/discord/callback", "/.proxy/api/auth/discord/callback"],
    (req, res) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(req.query || {})) {
        if (value == null) {
          continue;
        }

        if (Array.isArray(value)) {
          for (const entry of value) {
            params.append(key, String(entry));
          }
          continue;
        }

        params.set(key, String(value));
      }

      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Discord Activity OAuth</title>
  </head>
  <body>
    <script>
      (function () {
        var payload = {
          type: "discord-activity-oauth-callback",
          query: Object.fromEntries(new URLSearchParams(${JSON.stringify(params.toString())}))
        };

        try {
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        window.location.replace("/");
      })();
    </script>
    <p>Discord authorization completed. Return to your Activity if this page stays open.</p>
  </body>
</html>`);
    }
  );

  app.post(["/api/token", "/.proxy/api/token"], async (req, res) => {
    try {
      if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
        return res.status(500).json({
          error: "Missing Activity OAuth env vars",
          required: ["ACTIVITY_CLIENT_ID", "ACTIVITY_CLIENT_SECRET"],
        });
      }

      const code = typeof req.body?.code === "string" ? req.body.code : "";
      if (!code) {
        return res.status(400).json({ error: "OAuth code is required" });
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: ACTIVITY_CLIENT_ID,
        client_secret: ACTIVITY_CLIENT_SECRET,
      });

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const parsed = await parseJsonResponse(tokenResponse);
      if (!parsed.ok) {
        return res.status(parsed.status).json({
          ...(parsed.data && typeof parsed.data === "object" ? parsed.data : {}),
          error:
            typeof parsed.data?.error === "string" ? parsed.data.error : "oauth_token_exchange_failed",
          message: getDiscordOAuthErrorMessage(parsed.data),
        });
      }

      return res.status(parsed.status).json(parsed.data);
    } catch (error: any) {
      console.error("[activities] token exchange failed", error);
      return res.status(500).json({
        error: "Token exchange failed",
        message: error?.message || "Unknown error",
      });
    }
  });

  app.get(
    ["/api/launcher-data", "/.proxy/api/launcher-data"],
    optionalActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const guildId = String(req.query.guildId || req.headers["x-guild-id"] || "").trim();
        const authUser = req.authUser;
        const baseGames = ACTIVITY_GAME_CATALOG.map((game) => ({
          ...game,
          dailyStatus: null,
          highScore: 0,
        }));

        if (!authUser?.id) {
          return res.json({
            user: {
              id: "guest",
              username: "Guest",
              displayName: "Guest",
            },
            guild: guildId ? { id: guildId, name: `Guild ${guildId}` } : null,
            readOnly: true,
            unsupportedReason:
              "Discord authorization is unavailable for this launch. Reopen the activity after checking OAuth settings.",
            economy: null,
            crates: [],
            crateSummary: { total: 0 },
            upgrades: [],
            stats: null,
            levels: null,
            records: {},
            games: baseGames,
          });
        }

        if (!guildId) {
          return res.json({
            user: authUser,
            guild: null,
            readOnly: true,
            unsupportedReason: "Guild context is required for rewards.",
            economy: null,
            crates: [],
            crateSummary: { total: 0 },
            upgrades: [],
            stats: null,
            levels: null,
            records: {},
            games: baseGames,
          });
        }

        await ensureGuildUser(guildId, authUser.id);

        const [
          userResult,
          guildResult,
          recordsResult,
          ...dailyStatusResults
        ] = await Promise.all([
          fetchDatabase(`/users/${guildId}/${authUser.id}`),
          fetchDatabase(`/guilds/${guildId}`),
          fetchDatabase(`/games/records/${guildId}/${authUser.id}`),
          ...ACTIVITY_GAME_CATALOG.map((game) =>
            fetchDatabase(`/games/earnings/${guildId}/${authUser.id}/${normalizeGameId(game.id)}`)
          ),
        ]);

        const user = userResult.data || {};
        const economy = user?.economy || {};
        const crates = Array.isArray(user?.crates) ? user.crates : [];
        const upgrades = Array.isArray(user?.upgrades) ? user.upgrades : [];
        const stats = user?.stats || null;
        const levels = user?.Level || null;

        const crateSummary = crates.reduce(
          (acc: Record<string, number>, crate: any) => {
            const type = String(crate?.type || "unknown");
            const count = Math.max(0, toNumber(crate?.count, 0));
            acc[type] = (acc[type] || 0) + count;
            acc.total = (acc.total || 0) + count;
            return acc;
          },
          { total: 0 }
        );

        const recordMap = recordsResult.ok && recordsResult.data ? recordsResult.data : {};
        const games = ACTIVITY_GAME_CATALOG.map((game, index) => ({
          ...game,
          highScore: toNumber(recordMap?.[game.id]?.highScore || 0),
          dailyStatus: dailyStatusResults[index]?.ok ? dailyStatusResults[index]?.data || null : null,
        }));

        return res.json({
          user: {
            ...authUser,
            displayName: authUser.global_name || authUser.username || authUser.id,
          },
          guild: guildResult.ok
            ? {
                id: guildId,
                name: guildResult.data?.id === guildId
                  ? guildResult.data?.name || `Guild ${guildId}`
                  : `Guild ${guildId}`,
              }
            : { id: guildId, name: `Guild ${guildId}` },
          readOnly: false,
          economy: {
            balance: toNumber(economy?.balance),
            bankBalance: toNumber(economy?.bankBalance),
            bankDistributed: toNumber(economy?.bankDistributed),
            totalBankBalance:
              toNumber(economy?.bankBalance) + toNumber(economy?.bankDistributed),
            bankRate: toNumber(economy?.bankRate),
          },
          crates,
          crateSummary,
          upgrades,
          stats,
          levels,
          records: recordMap,
          games,
        });
      } catch (error: any) {
        console.error("[activities] launcher-data failed", error);
        return res.status(500).json({
          error: "Failed to load launcher data",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    ["/api/games/2048/complete", "/.proxy/api/games/2048/complete"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const submissionId = String(req.body?.submissionId || "").trim();
        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const requestedScore = toNumber(req.body?.score, 0);
        const requestedMoves = toNumber(req.body?.moves, 0);
        const requestedDurationMs = toNumber(req.body?.durationMs, 0);

        if (!submissionId) {
          return res.status(400).json({ error: "submissionId is required" });
        }

        if (!guildId) {
          return res.status(400).json({
            error: "guildId is required for rewarded gameplay",
          });
        }

        const score = clamp(0, requestedScore, 2_000_000);
        const moves = clamp(0, requestedMoves, 200_000);
        const durationMs = clamp(0, requestedDurationMs, 12 * 60 * 60 * 1000);

        const idempotencyKey = `2048:${guildId}:${authUser.id}:${submissionId}`;
        const existing = completionStore.get(idempotencyKey);
        if (existing) {
          return res.json({
            ...existing,
            idempotent: true,
          });
        }

        await ensureGuildUser(guildId, authUser.id);
        const userResult = await fetchDatabase(`/users/${guildId}/${authUser.id}`);
        const upgrades = Array.isArray(userResult.data?.upgrades)
          ? userResult.data.upgrades
          : [];
        const gamesEarningLevel = getUpgradeLevel(upgrades, "games_earning");

        const reward = compute2048SessionReward({
          score,
          moves,
          durationMs,
          gamesEarningLevel,
        });

        const gameXp = Math.max(0, Math.floor(score * 5));

        const highScoreResult = await fetchDatabase(`/games/records/update`, {
          method: "POST",
          body: JSON.stringify({
            userId: authUser.id,
            guildId,
            gameId: "2048",
            score,
          }),
        });

        const xpResult =
          gameXp > 0
            ? await fetchDatabase(`/games/xp/add`, {
                method: "POST",
                body: JSON.stringify({
                  userId: authUser.id,
                  guildId,
                  gameType: "2048",
                  xp: gameXp,
                }),
              })
            : { ok: true, status: 200, data: null };

        const payoutResult =
          reward.requestedEarning > 0
            ? await fetchDatabase(`/games/earnings/award`, {
                method: "POST",
                body: JSON.stringify({
                  userId: authUser.id,
                  guildId,
                  gameId: "2048",
                  amount: reward.requestedEarning,
                }),
              })
            : { ok: true, status: 200, data: null };

        const dailyStatusResult = await fetchDatabase(
          `/games/earnings/${guildId}/${authUser.id}/2048`
        );
        const balanceResult = await fetchDatabase(`/economy/balance/${guildId}/${authUser.id}`);

        const payout = payoutResult.data || {};
        const totalBlockedAmount = Math.max(0, toNumber(payout?.blockedAmount));
        const capBlockedAmount = Math.max(
          0,
          toNumber(payout?.capBlockedAmount, totalBlockedAmount)
        );
        const effectiveRequestedAmount = Math.max(
          0,
          toNumber(
            payout?.effectiveRequestedAmount,
            toNumber(payout?.requestedAmount, reward.requestedEarning)
          )
        );
        const visualAwardedAmount = Math.max(0, effectiveRequestedAmount - capBlockedAmount);

        const responsePayload = {
          idempotent: false,
          success: true,
          submissionId,
          gameId: "2048",
          userId: authUser.id,
          guildId,
          session: {
            score,
            moves,
            durationMs,
          },
          reward: {
            requestedEarning: Number(reward.requestedEarning.toFixed(4)),
            awardedAmount: toNumber(payout?.awardedAmount, 0),
            visualAwardedAmount,
            blockedAmount: capBlockedAmount,
            softLimitAwardAmount: toNumber(payout?.softLimitAwardAmount, 0),
            softLimitPayoutFactor: toNumber(payout?.softLimitPayoutFactor, 0),
            gameXp,
          },
          progression: {
            highScore: highScoreResult.data?.highScore || score,
            isNewRecord: Boolean(highScoreResult.data?.isNewRecord),
            levelUp: xpResult.data?.levelUp || null,
            type: xpResult.data?.type || null,
          },
          dailyStatus: dailyStatusResult.data || null,
          economy: {
            balance: toNumber(balanceResult.data?.balance, 0),
            totalBankBalance: toNumber(balanceResult.data?.totalBankBalance, 0),
          },
        };

        completionStore.set(idempotencyKey, responsePayload);
        return res.json(responsePayload);
      } catch (error: any) {
        console.error("[activities] 2048 completion failed", error);
        return res.status(500).json({
          error: "Failed to finalize 2048 session",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  // Compatibility routes used by old activity clients proxied through hub/client.
  app.post(
    ["/api/games/updateRecord", "/.proxy/api/games/updateRecord"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const result = await fetchDatabase(`/games/records/update`, {
          method: "POST",
          body: JSON.stringify(req.body || {}),
        });
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({
          error: error?.message || "Failed to update game record",
        });
      }
    }
  );

  app.get(
    ["/api/shop/upgrades/:guildId/:userId", "/.proxy/api/shop/upgrades/:guildId/:userId"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const guildId = String(req.params.guildId || "");
        const userId = String(req.params.userId || "");
        const result = await fetchDatabase(`/economy/upgrades/${guildId}/${userId}`);
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({ error: error?.message || "Failed to load upgrades" });
      }
    }
  );

  const staticPath = path.join(runtimeDirname, "client", "dist");

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get(/^\/(?!api|\.proxy|health).*/, (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send(
          "Activities API is running. Build the activity client with `bun --cwd client run build` to serve the web app from this process."
        );
    });
  }

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[activities] unhandled error", error);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}

if (import.meta.main) {
  if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
    console.warn(
      "[activities] WARNING: ACTIVITY_CLIENT_ID / ACTIVITY_CLIENT_SECRET are not configured. OAuth token exchange will fail until configured."
    );
  }
  if (!ACTIVITY_PUBLIC_BASE_URL && !process.env.ACTIVITY_REDIRECT_URI) {
    console.warn(
      `[activities] WARNING: ACTIVITY_PUBLIC_BASE_URL is not set. Redirect URI falls back to Discord's recommended placeholder (${ACTIVITY_REDIRECT_URI}).`
    );
  }

  const app = createActivitiesApp();
  app.listen(ACTIVITIES_SERVICE_PORT, () => {
    console.log(`Activities service running on http://localhost:${ACTIVITIES_SERVICE_PORT}`);
    console.log(`Health check: http://localhost:${ACTIVITIES_SERVICE_PORT}/health`);
  });
}
