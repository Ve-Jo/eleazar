import {
  ACTIVITY_DISCORD_BOT_TOKEN,
  DISCORD_ROLE_CACHE_TTL_MS,
  DISCORD_ROLE_FETCH_TIMEOUT_MS,
} from "../config.ts";

type DiscordRoleMapEntry = {
  name: string;
  color?: string;
};

type DiscordRoleCacheEntry = {
  expiresAt: number;
  map: Record<string, DiscordRoleMapEntry>;
};

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const guildRoleCache = new Map<string, DiscordRoleCacheEntry>();
const guildRoleInFlight = new Map<string, Promise<Record<string, DiscordRoleMapEntry>>>();

function resolveBotToken(): string {
  return (
    process.env.ACTIVITY_DISCORD_BOT_TOKEN ||
    process.env.DISCORD_TOKEN ||
    ACTIVITY_DISCORD_BOT_TOKEN
  );
}

function toRoleHexColor(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const intColor = Math.max(0, Math.min(0xffffff, Math.floor(value)));
  return `#${intColor.toString(16).padStart(6, "0")}`;
}

function normalizeRoleMap(payload: unknown): Record<string, DiscordRoleMapEntry> {
  if (!Array.isArray(payload)) {
    return {};
  }

  const nextMap: Record<string, DiscordRoleMapEntry> = {};
  for (const entry of payload) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const id = String(record.id || "").trim();
    const name = String(record.name || "").trim();
    if (!id || !name) {
      continue;
    }
    nextMap[id] = {
      name,
      color: toRoleHexColor(record.color),
    };
  }

  return nextMap;
}

export async function fetchDiscordGuildRoleMap(
  guildId: string
): Promise<Record<string, DiscordRoleMapEntry>> {
  const safeGuildId = String(guildId || "").trim();
  const botToken = resolveBotToken();
  if (!safeGuildId || !botToken) {
    return {};
  }

  const now = Date.now();
  const cached = guildRoleCache.get(safeGuildId);
  if (cached && cached.expiresAt > now) {
    return cached.map;
  }

  const existingInFlight = guildRoleInFlight.get(safeGuildId);
  if (existingInFlight) {
    return existingInFlight;
  }

  const requestPromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DISCORD_ROLE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${DISCORD_API_BASE_URL}/guilds/${safeGuildId}/roles`, {
        method: "GET",
        headers: {
          Authorization: `Bot ${botToken}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status !== 401 && response.status !== 403 && response.status !== 429) {
          console.warn(
            `[activities] discord role fetch failed for guild ${safeGuildId}: ${response.status}`
          );
        }
        return {};
      }

      const payload = (await response.json()) as unknown;
      const normalized = normalizeRoleMap(payload);
      guildRoleCache.set(safeGuildId, {
        map: normalized,
        expiresAt: Date.now() + DISCORD_ROLE_CACHE_TTL_MS,
      });
      return normalized;
    } catch {
      clearTimeout(timeoutId);
      return {};
    } finally {
      guildRoleInFlight.delete(safeGuildId);
    }
  })();

  guildRoleInFlight.set(safeGuildId, requestPromise);
  return requestPromise;
}

export function resetDiscordRoleCache(): void {
  guildRoleCache.clear();
  guildRoleInFlight.clear();
}
