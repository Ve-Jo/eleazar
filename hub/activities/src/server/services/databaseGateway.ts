import { DATABASE_SERVICE_URL } from "../config.ts";
import { parseJsonResponse } from "../lib/http.ts";
import type { JsonResult } from "../types/activityServer.ts";

export async function fetchDatabase(pathname: string, init?: RequestInit): Promise<JsonResult> {
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

export async function ensureGuildUser(guildId: string, userId: string): Promise<void> {
  const ensureResult = await fetchDatabase(`/guilds/${guildId}/users/ensure`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  if (!ensureResult.ok) {
    throw new Error(`Failed to ensure guild user: ${ensureResult.status}`);
  }
}
