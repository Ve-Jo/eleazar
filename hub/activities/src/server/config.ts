import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../../../shared/src/serviceConfig.ts";

const runtimeFilename = fileURLToPath(import.meta.url);
const runtimeDirname = path.dirname(runtimeFilename);

export const ACTIVITIES_ROOT_DIR = path.resolve(runtimeDirname, "../..");
export const HUB_ROOT_DIR = path.resolve(ACTIVITIES_ROOT_DIR, "..");
export const STATIC_CLIENT_PATH = path.join(ACTIVITIES_ROOT_DIR, "client", "dist");

dotenv.config({ path: path.resolve(HUB_ROOT_DIR, ".env") });
dotenv.config({ path: path.resolve(ACTIVITIES_ROOT_DIR, ".env"), override: true });

export const ACTIVITIES_SERVICE_PORT = Number(
  process.env.ACTIVITIES_SERVICE_PORT || DEFAULT_SERVICE_PORTS.activities
);
export const DATABASE_SERVICE_URL = (
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database
).replace(/\/$/, "");
export const RENDERING_SERVICE_URL = (
  process.env.RENDERING_SERVICE_URL || DEFAULT_SERVICE_URLS.rendering
).replace(/\/$/, "");

export const ACTIVITY_CLIENT_ID =
  process.env.ACTIVITY_CLIENT_ID || process.env.DISCORD_CLIENT_ID || "";
export const ACTIVITY_CLIENT_SECRET =
  process.env.ACTIVITY_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || "";
export const ACTIVITY_PUBLIC_BASE_URL = (process.env.ACTIVITY_PUBLIC_BASE_URL || "").replace(
  /\/$/,
  ""
);
export const ACTIVITY_REDIRECT_URI =
  process.env.ACTIVITY_REDIRECT_URI ||
  (ACTIVITY_PUBLIC_BASE_URL
    ? `${ACTIVITY_PUBLIC_BASE_URL}/api/auth/discord/callback`
    : "https://127.0.0.1");
export const ACTIVITY_SHARED_KEY =
  process.env.ACTIVITY_SHARED_KEY || process.env.ELEAZAR_ACTIVITIES_SHARED_KEY || "";

export const TOKEN_CACHE_TTL_MS = 60 * 1000;
export const PALETTE_CACHE_TTL_MS = 15 * 60 * 1000;
