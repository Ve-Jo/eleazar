import { z } from "zod";

import type {
  ActivityLauncherPayload,
  ActivityMutationEnvelope,
} from "../../../../shared/src/contracts/hub.ts";

import type {
  AuthState,
  CompletionResponse,
} from "../types/activityUi.ts";
import { LAUNCHER_DATA_TIMEOUT_MS, TUNNEL_BYPASS_HEADER } from "./activityConstants.ts";
import {
  activityCompletionResponseSchema,
  activityConfigSchema,
  activityLauncherPayloadSchema,
  activityMutationEnvelopeSchema,
  activityTokenExchangeSchema,
} from "./apiSchemas.ts";
import { getGuildIdFromUrl } from "./activityView.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
  [TUNNEL_BYPASS_HEADER]: "1",
} as const;

async function parseResponseOrThrow<T>(
  response: Response,
  schema: z.ZodType<T>,
  fallbackErrorMessage: string
): Promise<T> {
  const payload: unknown = await response.json().catch(() => ({}));
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new Error(fallbackErrorMessage);
  }

  if (!response.ok) {
    const data = parsed.data as { error?: string; message?: string };
    throw new Error(data.error || data.message || fallbackErrorMessage);
  }

  return parsed.data;
}

export async function fetchActivityConfig() {
  const response = await fetch("/api/config", {
    headers: {
      [TUNNEL_BYPASS_HEADER]: "1",
    },
  });

  return parseResponseOrThrow(response, activityConfigSchema, "Failed to load Activity config");
}

export async function exchangeActivityToken(code: string) {
  const response = await fetch("/api/token", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ code }),
  });

  return parseResponseOrThrow(
    response,
    activityTokenExchangeSchema,
    "Failed to exchange OAuth token"
  );
}

export async function fetchActivityLauncherData(
  auth: AuthState | null
): Promise<ActivityLauncherPayload> {
  const guildId = auth?.guildId || getGuildIdFromUrl();
  const params = new URLSearchParams();

  if (guildId) {
    params.set("guildId", guildId);
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(() => abortController.abort(), LAUNCHER_DATA_TIMEOUT_MS);

  try {
    const response = await fetch(`/api/launcher-data?${params.toString()}`, {
      headers: {
        [TUNNEL_BYPASS_HEADER]: "1",
        ...(auth?.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
        ...(auth?.userId ? { "x-user-id": auth.userId } : {}),
        ...(guildId ? { "x-guild-id": guildId } : {}),
      },
      signal: abortController.signal,
    });

    return parseResponseOrThrow(
      response,
      activityLauncherPayloadSchema,
      "Failed to load launcher data"
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function postActivityMutation<TAction extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  auth: AuthState | null,
  actionSchema: z.ZodType<TAction>
): Promise<ActivityMutationEnvelope<TAction>> {
  if (!auth?.accessToken || !auth.guildId) {
    throw new Error("This action requires Discord authorization.");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${auth.accessToken}`,
      "x-guild-id": auth.guildId,
    },
    body: JSON.stringify({
      guildId: auth.guildId,
      ...body,
    }),
  });

  const schema = activityMutationEnvelopeSchema(actionSchema);
  return parseResponseOrThrow(response, schema, "Action failed");
}

const completionRequestSchema = z.object({
  submissionId: z.string(),
  guildId: z.string(),
  score: z.number(),
  moves: z.number(),
  durationMs: z.number(),
});

export async function completeActivity2048Game(
  auth: AuthState | null,
  request: z.infer<typeof completionRequestSchema>
): Promise<CompletionResponse> {
  if (!auth?.guildId || !auth.accessToken) {
    throw new Error("This action requires Discord authorization.");
  }

  const parsedRequest = completionRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    throw new Error("Invalid game completion payload");
  }

  const response = await fetch("/api/games/2048/complete", {
    method: "POST",
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${auth.accessToken}`,
      "x-guild-id": auth.guildId,
    },
    body: JSON.stringify(parsedRequest.data),
  });

  return parseResponseOrThrow(
    response,
    activityCompletionResponseSchema,
    "Failed to submit game result"
  );
}
