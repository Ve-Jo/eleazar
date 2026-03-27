import type express from "express";

import { ACTIVITY_SHARED_KEY, TOKEN_CACHE_TTL_MS } from "../config.ts";
import { parseJsonResponse } from "../lib/http.ts";
import { asObject } from "../lib/primitives.ts";
import type { ActivityAuthUser, AuthenticatedRequest } from "../types/activityServer.ts";

const tokenUserCache = new Map<
  string,
  {
    expiresAt: number;
    user: ActivityAuthUser;
  }
>();

async function resolveDiscordUser(accessToken: string): Promise<ActivityAuthUser> {
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
  const parsedData = asObject(parsed.data);
  if (!parsed.ok || !parsedData.id) {
    throw new Error("Failed to resolve Discord user");
  }

  const user: ActivityAuthUser = {
    id: String(parsedData.id),
    username: typeof parsedData.username === "string" ? parsedData.username : undefined,
    global_name:
      typeof parsedData.global_name === "string" ? parsedData.global_name : null,
    avatar: typeof parsedData.avatar === "string" ? parsedData.avatar : null,
    locale: typeof parsedData.locale === "string" ? parsedData.locale : undefined,
  };

  tokenUserCache.set(accessToken, {
    user,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });

  return user;
}

export function createActivityAuthMiddleware(options?: { allowMissingAuth?: boolean }) {
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

export function createActivityAuthHandlers() {
  return {
    optionalActivityAuth: createActivityAuthMiddleware({ allowMissingAuth: true }),
    requireActivityAuth: createActivityAuthMiddleware(),
  };
}
