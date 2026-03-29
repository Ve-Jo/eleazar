import dotenv from "dotenv";

import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../../shared/src/serviceConfig.ts";

dotenv.config({ path: "../.env" });
dotenv.config({ path: ".env" });

export const LINKED_ROLES_SERVICE_PORT = Number(
  process.env.LINKED_ROLES_SERVICE_PORT || DEFAULT_SERVICE_PORTS.linkedRoles
);

export const LINKED_ROLES_SERVICE_URL = (
  process.env.LINKED_ROLES_SERVICE_URL || DEFAULT_SERVICE_URLS.linkedRoles
).replace(/\/$/, "");

export const LINKED_ROLES_PUBLIC_BASE_URL = (
  process.env.LINKED_ROLES_PUBLIC_BASE_URL || LINKED_ROLES_SERVICE_URL
).replace(/\/$/, "");

export const LINKED_ROLES_OAUTH_REDIRECT_URI = (
  process.env.LINKED_ROLES_OAUTH_REDIRECT_URI ||
  `${LINKED_ROLES_PUBLIC_BASE_URL}/oauth/discord/callback`
).replace(/\/$/, "");

export const LINKED_ROLES_VERIFICATION_URL = (
  process.env.LINKED_ROLES_VERIFICATION_URL ||
  `${LINKED_ROLES_PUBLIC_BASE_URL}/linked-role`
).replace(/\/$/, "");

export const DATABASE_SERVICE_URL = (
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database
).replace(/\/$/, "");

export const WEB_APP_URL = (process.env.WEB_APP_URL || "http://localhost:5173").replace(
  /\/$/,
  ""
);

export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
export const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
export const DISCORD_BOT_TOKEN =
  process.env.DISCORD_TOKEN ||
  process.env.ACTIVITY_DISCORD_BOT_TOKEN ||
  "";

export const LINKED_ROLES_INTERNAL_WEBHOOK_KEY =
  process.env.LINKED_ROLES_INTERNAL_WEBHOOK_KEY || "";
export const LINKED_ROLES_ENCRYPTION_KEY = process.env.LINKED_ROLES_ENCRYPTION_KEY || "";

export const LINKED_ROLES_RECONCILIATION_INTERVAL_MS = Number(
  process.env.LINKED_ROLES_RECONCILIATION_INTERVAL_MS || 300_000
);

export const LINKED_ROLES_QUEUE_MAX_RETRIES = Number(
  process.env.LINKED_ROLES_QUEUE_MAX_RETRIES || 6
);
export const LINKED_ROLES_QUEUE_BASE_DELAY_MS = Number(
  process.env.LINKED_ROLES_QUEUE_BASE_DELAY_MS || 2_000
);
export const LINKED_ROLES_QUEUE_MAX_DELAY_MS = Number(
  process.env.LINKED_ROLES_QUEUE_MAX_DELAY_MS || 120_000
);

export const LINKED_ROLES_OAUTH_CONTEXT_TTL_MS = Number(
  process.env.LINKED_ROLES_OAUTH_CONTEXT_TTL_MS || 10 * 60 * 1000
);
export const LINKED_ROLES_SIGNED_START_MAX_AGE_MS = Number(
  process.env.LINKED_ROLES_SIGNED_START_MAX_AGE_MS || 5 * 60 * 1000
);

export const LINKED_ROLES_HTTP_TIMEOUT_MS = Number(
  process.env.LINKED_ROLES_HTTP_TIMEOUT_MS || 10_000
);
