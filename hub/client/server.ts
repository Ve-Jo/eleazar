import express from "express";
import clientApiRouter from "./router.ts";
import { authenticateApiKey } from "./middleware.ts";
import dotenv from "dotenv";
import { createHmac, randomUUID } from "node:crypto";
import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../shared/src/serviceConfig.ts";
import { createHealthResponse } from "../shared/src/utils.ts";

dotenv.config({ path: "../.env" });

const API_PORT = Number(
  process.env.CLIENT_SERVICE_PORT || DEFAULT_SERVICE_PORTS.client
);
const DATABASE_SERVICE_URL = (
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database
).replace(/\/$/, "");
const RENDERING_SERVICE_URL = (
  process.env.RENDERING_SERVICE_URL || DEFAULT_SERVICE_URLS.rendering
).replace(/\/$/, "");
const ACTIVITIES_SERVICE_URL = (
  process.env.ACTIVITIES_SERVICE_URL || DEFAULT_SERVICE_URLS.activities
).replace(/\/$/, "");
const LINKED_ROLES_SERVICE_URL = (
  process.env.LINKED_ROLES_SERVICE_URL || DEFAULT_SERVICE_URLS.linkedRoles
).replace(/\/$/, "");
const WEB_APP_URL = (process.env.WEB_APP_URL || "http://localhost:5173").replace(/\/$/, "");
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET =
  process.env.DISCORD_CLIENT_SECRET || process.env.VITE_DISCORD_CLIENT_SECRET || "";
const LINKED_ROLES_INTERNAL_WEBHOOK_KEY =
  process.env.LINKED_ROLES_INTERNAL_WEBHOOK_KEY || "";
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI ||
  `http://localhost:${API_PORT}/api/auth/discord/callback`;

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_COOKIE_NAME = "eleazar_session";

type OAuthSessionUser = {
  id: string;
  username?: string;
  avatar?: string | null;
  locale?: string;
};

type OAuthGuild = {
  id: string;
  name: string;
  icon?: string | null;
  permissions?: string;
};

type GuildRecordLike = {
  id: string;
  settings?: Record<string, unknown>;
};

type LevelRoleRecordLike = {
  guildId: string;
  roleId: string;
  requiredLevel: number;
  mode?: string;
  replaceLowerRoles?: boolean;
};

type OAuthSession = {
  user: OAuthSessionUser;
  guilds: OAuthGuild[];
  accessToken: string;
  expiresAt: number;
};

type RenderPreviewPreset = {
  component: string;
  props: Record<string, unknown>;
  scaling?: {
    image: number;
    emoji: number;
    debug?: boolean;
  };
  locale?: string;
  options?: Record<string, unknown>;
};

const oauthStateStore = new Map<string, number>();
const sessionStore = new Map<string, OAuthSession>();

// In-memory cache for rendered previews
const renderPreviewCache = new Map<string, { buffer: Buffer; timestamp: number; contentType: string }>();
const RENDER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (shorter to account for dynamic content)
const RENDER_CACHE_MAX_SIZE = 50; // Reduced cache size

// Cache statistics
let cacheHits = 0;
let cacheMisses = 0;

// Clear cache function to force rerender
function clearRenderCache() {
  const size = renderPreviewCache.size;
  renderPreviewCache.clear();
  console.log(`[Cache] Cleared ${size} cached render previews - forcing rerender with random Discord avatars`);
}

// Simple cache cleanup function
function cleanupRenderCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, entry] of renderPreviewCache.entries()) {
    if (now - entry.timestamp > RENDER_CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => renderPreviewCache.delete(key));
  
  // If cache is too large, remove oldest entries
  if (renderPreviewCache.size > RENDER_CACHE_MAX_SIZE) {
    const entries = Array.from(renderPreviewCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toDelete = entries.slice(0, renderPreviewCache.size - RENDER_CACHE_MAX_SIZE);
    toDelete.forEach(([key]) => renderPreviewCache.delete(key));
  }
}

// Run cache cleanup every 2 minutes
setInterval(cleanupRenderCache, 2 * 60 * 1000);

// Clear cache on startup to force initial rerender
clearRenderCache();

const LANDING_RENDER_PRESETS: Record<string, RenderPreviewPreset> = {
  balance: {
    component: "Balance",
    locale: "en",
    scaling: { image: 1.25, emoji: 1.25, debug: false },
    options: { renderMode: "web-preview" },
    props: {
      interaction: {
        user: {
          id: "287275696744355840",
          username: "vejoy_",
          displayName: "vejoy_",
          avatarURL: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80",
        },
        guild: {
          id: "932847560192384000",
          name: "Eleazar",
          iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      database: {
        locale: "en",
        realName: "Jacob",
        age: 19,
        gender: "male",
        economy: {
          balance: 425.4,
          bank: 126.82,
        },
        combinedBankBalance: 126.82,
        marriageStatus: {
          status: "MARRIED",
        },
        levelProgress: {
          chat: { level: 21, currentXP: 420, requiredXP: 1000, rank: 4, total: 280 },
          voice: { level: 12, currentXP: 240, requiredXP: 1000, rank: 7, total: 280 },
          game: { level: 17, currentXP: 760, requiredXP: 1000, rank: 2, total: 280 },
        },
        hints: {
          dailyAvailable: 1,
          dailyRemainingMs: 0,
          upgradesAffordable: 3,
          workAvailable: true,
          crimeAvailable: false,
          crimeRemainingMs: 900000,
          crimeCooldownMs: 3600000,
          casesCooldowns: {
            dailyRemainingMs: 0,
            dailyCooldownMs: 86400000,
            weeklyRemainingMs: 5400000,
            weeklyCooldownMs: 604800000,
            closestRemainingMs: 0,
          },
          workEarnings: {
            totalCap: 500,
            earnedToday: 216,
            remainingToday: 284,
            progress: 0.432,
            gameCount: 4,
          },
        },
        caches: {
          count: 3,
        },
      },
      i18n: {
        getLocale: () => "en",
      },
      returnDominant: true,
    },
  },
  cratesdisplay: {
    component: "CratesDisplay",
    locale: "en",
    scaling: { image: 1.1, emoji: 1.1, debug: false },
    options: { renderMode: "web-preview" },
    props: {
      interaction: {
        user: {
          id: "287275696744355840",
          username: "vejoy_",
          displayName: "vejoy_",
          avatarURL: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80",
        },
        guild: {
          id: "932847560192384000",
          name: "Eleazar",
          iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      database: {
        balance: 427.82,
        xp: 18420,
        seasonXp: 920,
      },
      crates: [
        {
          name: "Daily Crate",
          description: "Open every day for economy boosts and progress rewards.",
          emoji: "📦",
          available: true,
          cooldown: 0,
          count: 2,
        },
        {
          name: "Weekly Crate",
          description: "Bigger drops with season XP and utility bonuses.",
          emoji: "🎁",
          available: false,
          cooldown: 93200000,
          count: 1,
        },
        {
          name: "Special Crate",
          description: "Rare drops reserved for active server members.",
          emoji: "✨",
          available: false,
          cooldown: 0,
          count: 4,
        },
      ],
      dailyStatus: {
        streak: 6,
        rewardMultiplier: 1.45,
        available: true,
        cooldownRemainingMs: 0,
        history: ["2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22"],
        currentWeek: [
          { dateKey: "2026-03-18", opened: true },
          { dateKey: "2026-03-19", opened: true },
          { dateKey: "2026-03-20", opened: true },
          { dateKey: "2026-03-21", opened: true },
          { dateKey: "2026-03-22", opened: true }
        ],
      },
      selectedCrate: 0,
      returnDominant: true,
    },
  },
  gamelauncher: {
    component: "GameLauncher",
    locale: "en",
    scaling: { image: 1.1, emoji: 1.1, debug: false },
    options: { renderMode: "web-preview" },
    props: {
      interaction: {
        user: {
          id: "287275696744355840",
          username: "vejoy_",
          displayName: "vejoy_",
          avatarURL: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80",
        },
        guild: {
          id: "932847560192384000",
          name: "Eleazar",
          iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      database: {
        economy: {
          balance: 427.82,
        },
      },
      games: {
        Eleazar: {
          avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
          games_list: [
            { id: "2048", title: "2048", emoji: "🎲", highScore: 12800 },
            { id: "snake", title: "Snake", emoji: "🐍", highScore: 94 },
          ],
        },
        Legacy: {
          avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
          games_list: [
            { id: "rpg_clicker2", title: "RPG Clicker", emoji: "⚔️", isLegacy: true, highScore: 41 },
          ],
        },
      },
      highlightedCategory: 0,
      highlightedGame: 0,
      gameStats: {
        2048: { highScore: 12800 },
        snake: { highScore: 94 },
        rpg_clicker2: { highScore: 41 },
      },
      gameDailyStatus: {
        cap: 1000,
        earnedToday: 420,
        remainingToday: 580,
        upgradeLevel: 3,
      },
      i18n: {
        getLocale: () => "en",
      },
      returnDominant: true,
    },
  },
  level2: {
    component: "Level2",
    locale: "en",
    scaling: { image: 1.15, emoji: 1.1, debug: false },
    options: { renderMode: "web-preview" },
    props: {
      interaction: {
        user: {
          id: "287275696744355840",
          username: "vejoy_",
          displayName: "vejoy_",
          avatarURL: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80",
        },
        guild: {
          id: "932847560192384000",
          name: "Eleazar",
          iconURL: "https://cdn.discordapp.com/embed/avatars/0.png",
        },
      },
      currentXP: 420,
      requiredXP: 1000,
      level: 21,
      gameCurrentXP: 760,
      gameRequiredXP: 1000,
      gameLevel: 17,
      voiceCurrentXP: 240,
      voiceRequiredXP: 1000,
      voiceLevel: 12,
      chatRank: { rank: 4, total: 280 },
      voiceRank: { rank: 7, total: 280 },
      gameRank: { rank: 2, total: 280 },
      seasonXP: 1820,
      seasonEnds: 1774224000000,
      seasonNumber: 3,
      availableRoles: [
        { name: "Veteran", color: "#ffb347", requiredLevel: 10, mode: "text" },
        { name: "Voice Elite", color: "#6ec6ff", requiredLevel: 14, mode: "voice" },
        { name: "Arcade Hero", color: "#7dff8a", requiredLevel: 18, mode: "gaming" },
        { name: "Mythic", color: "#bd4eff", requiredLevel: 28, mode: "combined_all" }
      ],
      i18n: {
        getLocale: () => "en",
      },
      returnDominant: true,
    },
  },
};

if (!DISCORD_CLIENT_SECRET || !DISCORD_CLIENT_ID) {
  console.warn(
    "[API Server] WARNING: Discord OAuth env vars are missing (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET). Web login will fail until configured."
  );
}

function getManageableGuild(
  session: OAuthSession,
  guildId: string
): OAuthGuild | null {
  const guild = session.guilds.find((item) => item.id === guildId);
  if (!guild) {
    return null;
  }

  if (!hasGuildManagePermission(guild.permissions)) {
    return null;
  }

  return guild;
}

const app = express();

// Enhanced proxy middleware for Discord's proxy
app.use((req: any, res: any, next: any) => {
  console.log(`[Debug] Incoming request: ${req.method} ${req.url}`);

  // Handle various proxy path formats
  if (req.url.includes("/.proxy")) {
    const originalUrl = req.url;

    // Handle /.proxy/api/... format
    if (req.url.includes("/.proxy/api/")) {
      req.url = req.url.replace("/.proxy/api/", "/api/");
    }
    // Handle /.proxy prefix
    else if (req.url.startsWith("/.proxy")) {
      req.url = req.url.replace("/.proxy", "");
    }

    console.log(
      `[Proxy Middleware] Rewriting URL from ${originalUrl} to ${req.url}`
    );
  }

  // Extract user ID from Discord token if available
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      // This is a simplified approach - in production you'd properly verify the token
      const token = req.headers.authorization.substring(7); // 'Bearer '.length
      // For now, we'll just use the token presence as authorization
      console.log(`[Auth] Token present in request`);

      // If user ID is in a header, add it to req.user
      if (req.headers["x-user-id"]) {
        req.user = { id: req.headers["x-user-id"] };
        console.log(`[Auth] User ID from header: ${req.user.id}`);
      }
    } catch (error) {
      console.error("[Auth] Error processing token:", error);
    }
  }

  next();
});

// --- Middleware ---
app.use(express.json()); // Parse JSON request bodies

function parseCookies(rawCookieHeader?: string) {
  const parsed: Record<string, string> = {};
  if (!rawCookieHeader) {
    return parsed;
  }

  for (const part of rawCookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }
    const combinedValue = rawValue.join("=");
    try {
      parsed[rawKey] = decodeURIComponent(combinedValue);
    } catch {
      parsed[rawKey] = combinedValue;
    }
  }

  return parsed;
}

function setSessionCookie(res: any, value: string, expiresAt?: number) {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (secure) {
    parts.push("Secure");
  }

  if (expiresAt) {
    parts.push(`Expires=${new Date(expiresAt).toUTCString()}`);
  }

  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: any) {
  setSessionCookie(res, "", Date.now() - 60_000);
}

function getSessionFromRequest(req: any): OAuthSession | null {
  const cookies = parseCookies(req.headers.cookie as string | undefined);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) {
    return null;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(sessionId);
    return null;
  }

  return session;
}

function hasGuildManagePermission(permissionsRaw?: string) {
  if (!permissionsRaw) {
    return false;
  }

  try {
    const permissions = BigInt(permissionsRaw);
    const ADMINISTRATOR = 0x8n;
    const MANAGE_GUILD = 0x20n;
    return (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
      (permissions & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

function resolveSafeReturnTo(raw: unknown): string {
  const fallback = `${WEB_APP_URL}/app/account`;
  if (typeof raw !== "string" || !raw.trim()) {
    return fallback;
  }

  try {
    const parsed = new URL(raw.trim());
    if (!parsed.href.startsWith(WEB_APP_URL)) {
      return fallback;
    }
    return parsed.href;
  } catch {
    return fallback;
  }
}

function buildLinkedRolesStartSignature(
  userId: string,
  guildIdsCsv: string,
  timestamp: string,
  returnTo: string
): string {
  return createHmac("sha256", LINKED_ROLES_INTERNAL_WEBHOOK_KEY)
    .update(`${userId}:${guildIdsCsv}:${timestamp}:${returnTo}`)
    .digest("hex");
}

// --- Health Check Route (before auth) ---
app.get("/health", (req: any, res: any) => {
  res.status(200).json(createHealthResponse("client", "1.0.0"));
});

// --- Cache Management Route (before auth for testing) ---
app.get("/api/cache/clear", (req: any, res: any) => {
  clearRenderCache();
  res.status(200).json({ 
    message: "Render cache cleared successfully",
    cacheSize: renderPreviewCache.size,
    timestamp: new Date().toISOString()
  });
});

app.get(["/api/render-preview/:preset", "/.proxy/api/render-preview/:preset"], async (req: any, res: any) => {
  const presetKey = String(req.params.preset || "").toLowerCase();
  const preset = LANDING_RENDER_PRESETS[presetKey];

  if (!preset) {
    return res.status(404).json({ error: "Unknown render preview preset" });
  }

  try {
    const locale = typeof req.query.locale === "string" && req.query.locale ? req.query.locale : preset.locale || "en";
    const useRandomAvatars = req.query.randomDiscordAvatars === "true";
    
    // Create cache key - use time-based caching for random avatars
    let cacheKey: string;
    if (useRandomAvatars) {
      // Use 5-minute time windows for random avatars to allow caching while showing variety
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      cacheKey = `${presetKey}:${locale}:random:${timeWindow}`;
    } else {
      cacheKey = `${presetKey}:${locale}:fixed`;
    }
    
    // Check cache first
    const cached = renderPreviewCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < RENDER_CACHE_TTL_MS) {
      cacheHits++;
      res.setHeader("Content-Type", cached.contentType);
      if (useRandomAvatars) {
        res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes for random avatars
      } else {
        res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes for fixed
      }
      return res.send(cached.buffer);
    }
    
    cacheMisses++;

    // Generate random Discord avatars if requested
    let props = { ...preset.props };
    if (useRandomAvatars) {
      // Use time window for deterministic random generation within cache window
      const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000));
      const seed = `${presetKey}:${locale}:${timeWindow}`;
      
      // Simple seeded random number generator
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      
      const seededRandom = (min: number, max: number) => {
        hash = ((hash << 5) - hash) & 0x7fffffff;
        return min + (hash % (max - min + 1));
      };
      
      // Generate random Discord user IDs
      const generateRandomDiscordId = () => {
        return 1000000000000000000 + seededRandom(0, 8000000000000000000);
      };
      
      // Generate random Discord avatars (using Discord's 6 default avatars)
      const generateRandomDiscordAvatar = (userId: string) => {
        const avatarId = seededRandom(0, 5);
        return `https://cdn.discordapp.com/embed/avatars/${avatarId}.png`;
      };

      // Override user avatar in interaction
      if (props.interaction && typeof props.interaction === 'object' && 'user' in props.interaction && props.interaction.user) {
        const randomUserId = String(generateRandomDiscordId());
        props.interaction = {
          ...props.interaction,
          user: {
            ...props.interaction.user,
            id: randomUserId,
            avatarURL: generateRandomDiscordAvatar(randomUserId),
          },
        };
      }

      // Override guild avatar if present
      if (props.interaction && typeof props.interaction === 'object' && 'guild' in props.interaction && props.interaction.guild) {
        const guildData = props.interaction.guild as any;
        props.interaction.guild = {
          ...guildData,
          iconURL: generateRandomDiscordAvatar(String(guildData.id)),
        };
      }

      // Override game avatars if present (in GameLauncher)
      if (props.games && typeof props.games === 'object') {
        props.games = Object.keys(props.games).reduce((acc, gameKey) => {
          const gameData = (props.games as any)[gameKey];
          acc[gameKey] = {
            ...gameData,
            avatar: generateRandomDiscordAvatar(gameKey),
          };
          return acc;
        }, {} as any);
      }
    }

    const response = await fetch(`${RENDERING_SERVICE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        component: preset.component,
        props,
        scaling: preset.scaling || { image: 1, emoji: 1, debug: false },
        locale,
        options: preset.options || {},
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return res.status(response.status).json({
        error: errorText || "Failed to render landing preview",
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Cache the result
    renderPreviewCache.set(cacheKey, {
      buffer,
      timestamp: Date.now(),
      contentType,
    });
    
    // Clean up cache if it gets too large
    if (renderPreviewCache.size > RENDER_CACHE_MAX_SIZE) {
      cleanupRenderCache();
    }
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutes browser cache
    return res.send(buffer);
  } catch (error) {
    console.error("[Web API] Failed to render landing preview:", error);
    return res.status(500).json({ error: "Failed to render landing preview" });
  }
});

app.get(["/api/auth/discord/login", "/.proxy/api/auth/discord/login"], async (req: any, res: any) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: "Discord OAuth is not configured" });
  }

  const state = randomUUID();
  oauthStateStore.set(state, Date.now() + OAUTH_STATE_TTL_MS);

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify guilds");
  authorizeUrl.searchParams.set("redirect_uri", DISCORD_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "none");

  res.redirect(authorizeUrl.toString());
});

app.get(
  ["/api/auth/discord/callback", "/.proxy/api/auth/discord/callback"],
  async (req: any, res: any) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    const stateExpiresAt = oauthStateStore.get(state);
    oauthStateStore.delete(state);

    if (!code || !state || !stateExpiresAt || stateExpiresAt < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OAuth state" });
    }

    try {
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: DISCORD_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("[Auth] Discord token exchange failed:", errorBody);
        return res.status(502).json({ error: "Failed to exchange Discord OAuth token" });
      }

      const tokenJson = (await tokenResponse.json()) as {
        access_token?: string;
        expires_in?: number;
      };

      if (!tokenJson.access_token) {
        return res.status(502).json({ error: "Discord did not return access token" });
      }

      const [userResponse, guildsResponse] = await Promise.all([
        fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        }),
        fetch("https://discord.com/api/users/@me/guilds", {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` },
        }),
      ]);

      if (!userResponse.ok || !guildsResponse.ok) {
        return res.status(502).json({ error: "Failed to load Discord user data" });
      }

      const user = (await userResponse.json()) as OAuthSessionUser;
      const guilds = (await guildsResponse.json()) as OAuthGuild[];

      const sessionId = randomUUID();
      const expiresAt = Date.now() + Number(tokenJson.expires_in || 3600) * 1000;

      sessionStore.set(sessionId, {
        user,
        guilds,
        accessToken: tokenJson.access_token,
        expiresAt,
      });

      setSessionCookie(res, sessionId, expiresAt);
      return res.redirect(`${WEB_APP_URL}/app`);
    } catch (error) {
      console.error("[Auth] Discord callback failed:", error);
      return res.status(500).json({ error: "OAuth callback processing failed" });
    }
  }
);

app.get(["/api/auth/me", "/.proxy/api/auth/me"], (req: any, res: any) => {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({ authenticated: true, user: session.user });
});

app.post(["/api/auth/logout", "/.proxy/api/auth/logout"], (req: any, res: any) => {
  const cookies = parseCookies(req.headers.cookie as string | undefined);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (sessionId) {
    sessionStore.delete(sessionId);
  }

  clearSessionCookie(res);
  return res.json({ success: true });
});

app.get(
  ["/api/linked-roles/oauth/start", "/.proxy/api/linked-roles/oauth/start"],
  (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!LINKED_ROLES_INTERNAL_WEBHOOK_KEY) {
      return res.status(500).json({
        error: "LINKED_ROLES_INTERNAL_WEBHOOK_KEY is not configured",
      });
    }

    const manageableGuildIds = session.guilds
      .filter((guild) => hasGuildManagePermission(guild.permissions))
      .map((guild) => guild.id);

    const guildIdsCsv = manageableGuildIds.join(",");
    const ts = Date.now().toString();
    const returnTo = resolveSafeReturnTo(req.query?.returnTo);
    const sig = buildLinkedRolesStartSignature(
      session.user.id,
      guildIdsCsv,
      ts,
      returnTo
    );

    const target = new URL(`${LINKED_ROLES_SERVICE_URL}/oauth/discord/start`);
    target.searchParams.set("userId", session.user.id);
    target.searchParams.set("guildIds", guildIdsCsv);
    target.searchParams.set("ts", ts);
    target.searchParams.set("sig", sig);
    target.searchParams.set("returnTo", returnTo);

    return res.redirect(target.toString());
  }
);

app.get(
  ["/api/linked-roles/status", "/.proxy/api/linked-roles/status"],
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const response = await fetch(
        `${LINKED_ROLES_SERVICE_URL}/api/linked-roles/status?userId=${encodeURIComponent(session.user.id)}`
      );

      const payloadText = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({
          error: payloadText || "Failed to load linked roles status",
        });
      }

      return res.type("application/json").send(payloadText);
    } catch (error) {
      console.error("[Web API] Failed to load linked roles status:", error);
      return res.status(500).json({ error: "Failed to load linked roles status" });
    }
  }
);

app.put(
  ["/api/linked-roles/selected-guild", "/.proxy/api/linked-roles/selected-guild"],
  express.json(),
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const selectedGuildId =
      typeof req.body?.selectedGuildId === "string"
        ? req.body.selectedGuildId.trim()
        : "";
    if (!selectedGuildId) {
      return res.status(400).json({ error: "selectedGuildId is required" });
    }

    const manageableGuild = getManageableGuild(session, selectedGuildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const response = await fetch(
        `${LINKED_ROLES_SERVICE_URL}/api/linked-roles/selected-guild`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: session.user.id,
            selectedGuildId,
          }),
        }
      );

      const payloadText = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({
          error: payloadText || "Failed to update selected guild",
        });
      }

      return res.type("application/json").send(payloadText);
    } catch (error) {
      console.error("[Web API] Failed to update linked role selected guild:", error);
      return res.status(500).json({ error: "Failed to update selected guild" });
    }
  }
);

app.post(
  ["/api/linked-roles/sync-now", "/.proxy/api/linked-roles/sync-now"],
  express.json(),
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const response = await fetch(`${LINKED_ROLES_SERVICE_URL}/api/linked-roles/sync-now`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: session.user.id,
          reason: typeof req.body?.reason === "string" ? req.body.reason : "manual_sync",
        }),
      });

      const payloadText = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({
          error: payloadText || "Failed to sync linked roles metadata",
        });
      }

      return res.type("application/json").send(payloadText);
    } catch (error) {
      console.error("[Web API] Failed to sync linked roles metadata:", error);
      return res.status(500).json({ error: "Failed to sync linked roles metadata" });
    }
  }
);

app.get(["/api/guilds", "/.proxy/api/guilds"], (req: any, res: any) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const manageableGuilds = session.guilds.filter((guild) =>
    hasGuildManagePermission(guild.permissions)
  );

  return res.json({ guilds: manageableGuilds });
});

app.get(
  ["/api/guilds/:guildId/overview", "/.proxy/api/guilds/:guildId/overview"],
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const guildId = String(req.params.guildId || "");
    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const manageableGuild = getManageableGuild(session, guildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const [guildResponse, statsResponse, levelRolesResponse] = await Promise.all([
        fetch(`${DATABASE_SERVICE_URL}/guilds/${guildId}`),
        fetch(`${DATABASE_SERVICE_URL}/stats/${guildId}/${session.user.id}`),
        fetch(`${DATABASE_SERVICE_URL}/levels/roles/${guildId}`),
      ]);

      const guildPayload = guildResponse.ok
        ? ((await guildResponse.json()) as GuildRecordLike)
        : null;
      const statsPayload = statsResponse.ok ? await statsResponse.json() : null;
      const levelRolesPayload = levelRolesResponse.ok
        ? ((await levelRolesResponse.json()) as LevelRoleRecordLike[])
        : [];

      const voiceRoomsSettings =
        (guildPayload?.settings?.voiceRooms as Record<string, unknown> | undefined) || {};

      return res.json({
        guild: {
          id: manageableGuild.id,
          name: manageableGuild.name,
          icon: manageableGuild.icon ?? null,
        },
        stats: statsPayload,
        levelRolesCount: Array.isArray(levelRolesPayload) ? levelRolesPayload.length : 0,
        voiceRoomsEnabled: Boolean(voiceRoomsSettings.waitingRoomsEnabled),
      });
    } catch (error) {
      console.error("[Web API] Failed to fetch guild overview:", error);
      return res.status(500).json({ error: "Failed to fetch guild overview" });
    }
  }
);

app.get(
  ["/api/guilds/:guildId/settings", "/.proxy/api/guilds/:guildId/settings"],
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const guildId = String(req.params.guildId || "");
    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const manageableGuild = getManageableGuild(session, guildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const [guildResponse, levelRolesResponse] = await Promise.all([
        fetch(`${DATABASE_SERVICE_URL}/guilds/${guildId}`),
        fetch(`${DATABASE_SERVICE_URL}/levels/roles/${guildId}`),
      ]);

      if (!guildResponse.ok) {
        return res.status(guildResponse.status).json({ error: "Failed to fetch guild" });
      }

      const guildPayload = (await guildResponse.json()) as GuildRecordLike;
      const levelRolesPayload = levelRolesResponse.ok
        ? ((await levelRolesResponse.json()) as LevelRoleRecordLike[])
        : [];

      const voiceRooms =
        (guildPayload?.settings?.voiceRooms as Record<string, unknown> | undefined) || {};

      return res.json({
        guildId,
        settings: {
          voiceRooms,
        },
        levelRoles: Array.isArray(levelRolesPayload) ? levelRolesPayload : [],
      });
    } catch (error) {
      console.error("[Web API] Failed to fetch guild settings:", error);
      return res.status(500).json({ error: "Failed to fetch guild settings" });
    }
  }
);

app.put(
  ["/api/guilds/:guildId/settings/voice-rooms", "/.proxy/api/guilds/:guildId/settings/voice-rooms"],
  express.json(),
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const guildId = String(req.params.guildId || "");
    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const manageableGuild = getManageableGuild(session, guildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const guildResponse = await fetch(`${DATABASE_SERVICE_URL}/guilds/${guildId}`);
      if (!guildResponse.ok) {
        return res.status(guildResponse.status).json({ error: "Failed to fetch guild" });
      }

      const guildPayload = (await guildResponse.json()) as GuildRecordLike;
      const existingSettings = (guildPayload.settings || {}) as Record<string, unknown>;
      const existingVoiceRooms =
        (existingSettings.voiceRooms as Record<string, unknown> | undefined) || {};
      const incomingVoiceRooms =
        (req.body?.voiceRooms as Record<string, unknown> | undefined) || {};

      const mergedVoiceRooms = {
        ...existingVoiceRooms,
        ...incomingVoiceRooms,
      };

      const updateResponse = await fetch(`${DATABASE_SERVICE_URL}/guilds/${guildId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: {
            ...existingSettings,
            voiceRooms: mergedVoiceRooms,
          },
        }),
      });

      if (!updateResponse.ok) {
        const updateBody = await updateResponse.text();
        return res
          .status(updateResponse.status)
          .json({ error: updateBody || "Failed to update guild settings" });
      }

      return res.json({ success: true, voiceRooms: mergedVoiceRooms });
    } catch (error) {
      console.error("[Web API] Failed to update voice room settings:", error);
      return res.status(500).json({ error: "Failed to update voice room settings" });
    }
  }
);

app.post(
  ["/api/guilds/:guildId/level-roles", "/.proxy/api/guilds/:guildId/level-roles"],
  express.json(),
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const guildId = String(req.params.guildId || "");
    if (!guildId) {
      return res.status(400).json({ error: "guildId is required" });
    }

    const manageableGuild = getManageableGuild(session, guildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const roleId = typeof req.body?.roleId === "string" ? req.body.roleId : "";
    const level = typeof req.body?.level === "number" ? req.body.level : Number(req.body?.level);
    const mode = typeof req.body?.mode === "string" ? req.body.mode : "text";
    const replaceLowerRoles =
      typeof req.body?.replaceLowerRoles === "boolean" ? req.body.replaceLowerRoles : true;

    if (!roleId || Number.isNaN(level)) {
      return res.status(400).json({ error: "roleId and valid level are required" });
    }

    try {
      const response = await fetch(`${DATABASE_SERVICE_URL}/levels/roles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guildId,
          roleId,
          level,
          mode,
          replaceLowerRoles,
        }),
      });

      const payloadText = await response.text();
      if (!response.ok) {
        return res.status(response.status).json({ error: payloadText || "Failed to add level role" });
      }

      return res.status(201).send(payloadText);
    } catch (error) {
      console.error("[Web API] Failed to add level role:", error);
      return res.status(500).json({ error: "Failed to add level role" });
    }
  }
);

app.delete(
  ["/api/guilds/:guildId/level-roles/:roleId", "/.proxy/api/guilds/:guildId/level-roles/:roleId"],
  async (req: any, res: any) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const guildId = String(req.params.guildId || "");
    const roleId = String(req.params.roleId || "");
    if (!guildId || !roleId) {
      return res.status(400).json({ error: "guildId and roleId are required" });
    }

    const manageableGuild = getManageableGuild(session, guildId);
    if (!manageableGuild) {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const response = await fetch(`${DATABASE_SERVICE_URL}/levels/roles/${guildId}/${roleId}`, {
        method: "DELETE",
      });

      const payloadText = await response.text();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: payloadText || "Failed to remove level role" });
      }

      return res.send(payloadText);
    } catch (error) {
      console.error("[Web API] Failed to remove level role:", error);
      return res.status(500).json({ error: "Failed to remove level role" });
    }
  }
);

// --- API Routes ---
// Create a function to handle both direct and proxied routes
function setupDualRoutes(appInstance: any, router: any) {
  // List of API endpoints that need to be accessible both directly and through proxy
  const apiEndpoints = [
    { method: "post", path: "/games/updateRecord" },
    { method: "get", path: "/shop/upgrades/:guildId/:userId" },
  ];

  // For each endpoint, create both a direct and proxied route
  apiEndpoints.forEach((endpoint) => {
    const directPath = `/api${endpoint.path}`;
    const proxyPath = `/.proxy/api${endpoint.path}`;

    console.log(
      `[API Server] Setting up dual routes for ${endpoint.method.toUpperCase()} ${directPath} and ${proxyPath}`
    );

    // Handler function that forwards requests to the activities server
    const routeHandler = async (req: any, res: any) => {
      console.log(
        `[API Server] Forwarding ${req.method} request at ${req.originalUrl} to activities server`
      );

      try {
        // Forward all headers to preserve authentication
        const headers: Record<string, any> = {
          "Content-Type": "application/json",
        };

        for (const [key, value] of Object.entries(req.headers)) {
          // Skip host and content-length headers to avoid conflicts
          if (![["host"], ["content-length"]].flat().includes(key.toLowerCase())) {
            headers[key] = value as string;
          }
        }

        // Determine the target URL in the activities server
        const targetPath = req.originalUrl.includes("/.proxy")
          ? req.originalUrl
          : req.originalUrl.replace("/api", "/.proxy/api");

        const forwardResponse = await fetch(
          `${ACTIVITIES_SERVICE_URL}${targetPath}`,
          {
            method: req.method,
            headers,
            body:
              req.method !== "GET" && req.method !== "HEAD"
                ? JSON.stringify(req.body)
                : undefined,
          }
        );

        const responseData = await forwardResponse.text();
        console.log(
          `[API Server] Activities server response: ${forwardResponse.status}`
        );

        // Return the same status and body from the activities server
        res.status(forwardResponse.status).send(responseData);
      } catch (error: any) {
        console.error(`[API Server] Error forwarding request:`, error);
        res
          .status(500)
          .json({ error: "Internal server error", message: error.message });
      }
    };

    // Register both direct and proxy routes
    appInstance[endpoint.method](directPath, express.json(), routeHandler);
    appInstance[endpoint.method](proxyPath, express.json(), routeHandler);
  });
}

// Add token endpoint for OAuth flow
app.post(
  ["/api/token", "/.proxy/api/token"],
  express.json(),
  async (req: any, res: any) => {
    try {
      const { code } = req.body;

      console.log(
        `[API Server] Token request received with code: ${
          code ? code.substring(0, 5) + "..." : "undefined"
        }`
      );
      console.log(`[API Server] Request body:`, req.body);

      // Instead of handling the token exchange ourselves, forward the request to the activities server
      console.log("[API Server] Forwarding token request to activities server");

      const forwardResponse = await fetch(`${ACTIVITIES_SERVICE_URL}/api/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const responseData = await forwardResponse.text();
      console.log(
        `[API Server] Activities server response: ${forwardResponse.status}`
      );

      // Return the same status and body from the activities server
      res.status(forwardResponse.status).send(responseData);
    } catch (error: any) {
      console.error("[API Server] Error forwarding token request:", error);
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Add config endpoint to provide client ID
app.get(["/api/config", "/.proxy/api/config"], async (req: any, res: any) => {
  try {
    console.log("[API Server] Forwarding config request to activities server");
    const forwardResponse = await fetch(`${ACTIVITIES_SERVICE_URL}/api/config`);

    const responseData = await forwardResponse.text();
    console.log(
      `[API Server] Activities server config response: ${forwardResponse.status}`
    );

    // Return the same status and body from the activities server
    res.status(forwardResponse.status).send(responseData);
  } catch (error: any) {
    console.error("[API Server] Error forwarding config request:", error);
    return res
      .status(500)
      .json({ error: "Internal server error", message: error.message });
  }
});

// Add launcher-data endpoint to provide user data
app.get(
  ["/api/launcher-data", "/.proxy/api/launcher-data"],
  async (req: any, res: any) => {
    try {
      console.log(
        "[API Server] Forwarding launcher-data request to activities server"
      );

      // Forward all headers to preserve authentication
      const headers: Record<string, any> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        // Skip host header to avoid conflicts
        if (key.toLowerCase() !== "host") {
          headers[key] = value as string;
        }
      }

      const forwardResponse = await fetch(
        `${ACTIVITIES_SERVICE_URL}/api/launcher-data`,
        {
          headers,
        }
      );

      const responseData = await forwardResponse.text();
      console.log(
        `[API Server] Activities server launcher-data response: ${forwardResponse.status}`
      );

      // Return the same status and body from the activities server
      res.status(forwardResponse.status).send(responseData);
    } catch (error: any) {
      console.error(
        "[API Server] Error forwarding launcher-data request:",
        error
      );
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Forward 2048 completion endpoint to activities service.
app.post(
  ["/api/games/2048/complete", "/.proxy/api/games/2048/complete"],
  express.json(),
  async (req: any, res: any) => {
    try {
      const headers: Record<string, any> = { "Content-Type": "application/json" };
      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== "host" && key.toLowerCase() !== "content-length") {
          headers[key] = value as string;
        }
      }

      const forwardResponse = await fetch(
        `${ACTIVITIES_SERVICE_URL}/api/games/2048/complete`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(req.body || {}),
        }
      );

      const responseData = await forwardResponse.text();
      return res.status(forwardResponse.status).send(responseData);
    } catch (error: any) {
      return res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  }
);

// Add high score update endpoint for database integration
app.post(
  ["/api/games/records/update", "/.proxy/api/games/records/update"],
  express.json(),
  async (req: any, res: any) => {
    console.log(
      `[API Server] Forwarding ${req.method} request at ${req.originalUrl} to database service`
    );

    try {
      const headers: Record<string, any> = { "Content-Type": "application/json" };

      for (const [key, value] of Object.entries(req.headers)) {
        if (key.toLowerCase() !== "host" && key.toLowerCase() !== "content-length") {
          headers[key] = value as string;
        }
      }

      const forwardResponse = await fetch(
        `${DATABASE_SERVICE_URL}/games/records/update`,
        {
          method: req.method,
          headers,
          body: JSON.stringify(req.body),
        }
      );

      const responseData = await forwardResponse.text();
      res.status(forwardResponse.status).send(responseData);
    } catch (error: any) {
      res.status(500).json({ error: "Internal server error", message: error.message });
    }
  }
);

// Add update-balance endpoint to forward to activities server
app.post(
  ["/api/update-balance", "/.proxy/api/update-balance"],
  express.json(),
  async (req: any, res: any) => {
    try {
      console.log("[API Server] Processing update-balance request locally");

      // Extract from headers and body
      const guildId = req.headers["x-guild-id"] || req.body.guildId;
      let userId = req.body.userId || req.headers["x-user-id"]; // Try to get from body first, then headers
      const { amount, reason } = req.body;

      // If userId is not provided, try to extract it from the Discord token
      if (
        !userId &&
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
      ) {
        try {
          const accessToken = req.headers.authorization.substring(7); // Remove "Bearer "
          const userResponse = await fetch(
            "https://discord.com/api/users/@me",
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (userResponse.ok) {
            const discordUser = (await userResponse.json()) as { id?: string };
            userId = discordUser.id || userId;
            console.log(
              `[API Server] Extracted user ID from Discord token: ${userId}`
            );
          } else {
            console.error(
              `[API Server] Failed to extract user ID from Discord token: ${userResponse.status}`
            );
          }
        } catch (error) {
          console.error(
            `[API Server] Error extracting user ID from Discord token:`,
            error
          );
        }
      }

      console.log(
        `[API Server] Update balance request: guild=${guildId}, user=${userId}, amount=${amount}, reason=${reason}`
      );

      if (!guildId || !userId || amount === undefined) {
        return res.status(400).json({
          error: "Missing required fields: guildId, userId, amount",
          received: {
            guildId,
            userId,
            amount,
            reason,
            headers: {
              "x-guild-id": req.headers["x-guild-id"],
              "x-user-id": req.headers["x-user-id"],
              authorization: req.headers.authorization
                ? "Present (not shown)"
                : "Missing",
            },
          },
          help: "Make sure to include guildId in x-guild-id header, userId in x-user-id header or body, and amount in the request body",
        });
      }

      const forwardResponse = await fetch(
        `${DATABASE_SERVICE_URL}/economy/balance/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ guildId, userId, amount }),
        }
      );

      const result = (await forwardResponse.json().catch(() => null)) as
        | { balance?: { toString?: () => string } }
        | null;

      const responseData = {
        success: true,
        newBalance: result?.balance?.toString?.() ?? "N/A",
        message: "Balance updated successfully",
      };

      console.log(`[API Server] Balance update successful:`, responseData);
      res.json(responseData);
    } catch (error: any) {
      console.error(
        "[API Server] Error processing update-balance request:",
        error
      );
      return res
        .status(500)
        .json({ error: "Internal server error", message: error.message });
    }
  }
);

// Apply authentication middleware specifically to the client API routes
app.use("/api", authenticateApiKey, clientApiRouter);

// Set up dual routes for direct and proxied access
setupDualRoutes(app, clientApiRouter);

// Optional: Add other routers here if needed (e.g., for internal bot stats)
// app.use('/internal', internalRouter);

// Diagnostic catch-all route to log unhandled paths
app.use("*", (req: any, res: any) => {
  console.log(`[API Server] Unhandled route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: "API route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// --- Error Handling Middleware (Example) ---
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[API Server] Unhandled Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// --- Start Server Function ---
export function startApiClientServer() {
  try {
    app.listen(API_PORT, () => {
      console.log(
        `[API Server - Client] Listening on http://localhost:${API_PORT}`
      );
    });
  } catch (error) {
    console.error("[API Server - Client] Failed to start:", error);
    // Optional: exit process or handle error differently
    process.exit(1);
  }
}

// Start the server
startApiClientServer();
