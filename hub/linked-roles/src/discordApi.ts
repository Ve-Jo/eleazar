import {
  DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  LINKED_ROLES_HTTP_TIMEOUT_MS,
  LINKED_ROLES_OAUTH_REDIRECT_URI,
} from "./config.ts";
import type {
  DiscordUserPayload,
  MetricPayload,
  TokenPayload,
} from "./types.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";

const INTEGER_GREATER_THAN_OR_EQUAL = 2;

type DiscordRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

type DiscordApiError = Error & {
  status?: number;
  retryable?: boolean;
};

const METADATA_SCHEMA = [
  {
    key: "wallet_balance",
    name: "Wallet Balance",
    name_localizations: {
      "en-US": "Wallet Balance",
      ru: "Баланс кошелька",
      uk: "Баланс гаманця",
    },
    description: "User wallet balance in selected guild",
    description_localizations: {
      "en-US": "User wallet balance in selected guild",
      ru: "Баланс кошелька пользователя в выбранной гильдии",
      uk: "Баланс гаманця користувача у вибраній гільдії",
    },
    type: INTEGER_GREATER_THAN_OR_EQUAL,
  },
  {
    key: "chat_level",
    name: "Chat Level",
    name_localizations: {
      "en-US": "Chat Level",
      ru: "Уровень чата",
      uk: "Рівень чату",
    },
    description: "User chat level in selected guild",
    description_localizations: {
      "en-US": "User chat level in selected guild",
      ru: "Уровень чата пользователя в выбранной гильдии",
      uk: "Рівень чату користувача у вибраній гільдії",
    },
    type: INTEGER_GREATER_THAN_OR_EQUAL,
  },
  {
    key: "voice_level",
    name: "Voice Level",
    name_localizations: {
      "en-US": "Voice Level",
      ru: "Уровень голоса",
      uk: "Рівень голосу",
    },
    description: "User voice level in selected guild",
    description_localizations: {
      "en-US": "User voice level in selected guild",
      ru: "Уровень голоса пользователя в выбранной гильдии",
      uk: "Рівень голосу користувача у вибраній гільдії",
    },
    type: INTEGER_GREATER_THAN_OR_EQUAL,
  },
  {
    key: "total_xp",
    name: "Total XP",
    name_localizations: {
      "en-US": "Total XP",
      ru: "Всего XP",
      uk: "Усього XP",
    },
    description: "User total chat XP in selected guild",
    description_localizations: {
      "en-US": "User total chat XP in selected guild",
      ru: "Суммарный chat XP пользователя в выбранной гильдии",
      uk: "Сумарний chat XP користувача у вибраній гільдії",
    },
    type: INTEGER_GREATER_THAN_OR_EQUAL,
  },
];

async function discordRequest(
  path: string,
  options: DiscordRequestOptions = {}
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINKED_ROLES_HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(`${DISCORD_API_BASE}${path}`, {
      method: options.method || "GET",
      headers: {
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller.signal,
    });

    const raw = await response.text();
    const payload = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const error = new Error(
        `Discord API request failed (${response.status})`
      ) as DiscordApiError;
      error.status = response.status;
      error.retryable = response.status === 429 || response.status >= 500;
      if (payload && typeof payload === "object" && "message" in payload) {
        error.message = `Discord API error (${response.status}): ${String(
          (payload as Record<string, unknown>).message
        )}`;
      }
      throw error;
    }

    return payload;
  } catch (error) {
    const typed = error as DiscordApiError;
    if (typed.name === "AbortError") {
      typed.message = "Discord API timeout";
      typed.retryable = true;
    }
    throw typed;
  } finally {
    clearTimeout(timeoutId);
  }
}

function assertOAuthConfig(): void {
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error("DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured");
  }
}

export function buildDiscordAuthorizeUrl(state: string): string {
  assertOAuthConfig();

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify guilds role_connections.write");
  authorizeUrl.searchParams.set("redirect_uri", LINKED_ROLES_OAUTH_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");
  return authorizeUrl.toString();
}

export async function exchangeCodeForTokens(code: string): Promise<TokenPayload> {
  assertOAuthConfig();

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: LINKED_ROLES_OAUTH_REDIRECT_URI,
  });

  return (await discordRequest("/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })) as TokenPayload;
}

export async function refreshTokens(refreshToken: string): Promise<TokenPayload> {
  assertOAuthConfig();

  const body = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return (await discordRequest("/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })) as TokenPayload;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUserPayload> {
  return (await discordRequest("/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })) as DiscordUserPayload;
}

export async function updateRoleConnectionMetadata(
  accessToken: string,
  metadata: MetricPayload,
  platformName = "Eleazar Hub",
  platformUsername = "Eleazar user"
): Promise<void> {
  await discordRequest(`/users/@me/applications/${DISCORD_CLIENT_ID}/role-connection`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      platform_name: platformName,
      platform_username: platformUsername,
      metadata,
    }),
  });
}

export async function ensureMetadataSchemaRegistered(): Promise<void> {
  if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID) {
    console.warn(
      "[linked-roles] skipping metadata schema sync: DISCORD_TOKEN or DISCORD_CLIENT_ID missing"
    );
    return;
  }

  await discordRequest(`/applications/${DISCORD_CLIENT_ID}/role-connections/metadata`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(METADATA_SCHEMA),
  });
}
