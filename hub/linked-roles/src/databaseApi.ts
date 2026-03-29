import { DATABASE_SERVICE_URL } from "./config.ts";
import { jsonRequest, type HttpError } from "./http.ts";
import type { LinkedRoleConnectionRecord, MetricPayload } from "./types.ts";
import { toSafeInteger } from "./utils.ts";

type LevelsPayload = {
  text?: { level?: number | string; totalXP?: number | string };
  voice?: { level?: number | string };
};

type BalancePayload = {
  balance?: number | string;
};

function isNotFound(error: unknown): boolean {
  return (error as HttpError)?.status === 404;
}

export async function getLinkedRoleConnection(
  userId: string
): Promise<LinkedRoleConnectionRecord | null> {
  try {
    return await jsonRequest<LinkedRoleConnectionRecord>(
      `${DATABASE_SERVICE_URL}/linked-roles/${encodeURIComponent(userId)}`
    );
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

export async function upsertLinkedRoleConnection(
  userId: string,
  payload: Record<string, unknown>
): Promise<LinkedRoleConnectionRecord> {
  return await jsonRequest<LinkedRoleConnectionRecord>(
    `${DATABASE_SERVICE_URL}/linked-roles/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      body: payload,
    }
  );
}

export async function updateLinkedRoleSync(
  userId: string,
  payload: Record<string, unknown>
): Promise<LinkedRoleConnectionRecord> {
  return await jsonRequest<LinkedRoleConnectionRecord>(
    `${DATABASE_SERVICE_URL}/linked-roles/${encodeURIComponent(userId)}/sync`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export async function updateLinkedRoleSelectedGuild(
  userId: string,
  selectedGuildId: string
): Promise<LinkedRoleConnectionRecord> {
  return await jsonRequest<LinkedRoleConnectionRecord>(
    `${DATABASE_SERVICE_URL}/linked-roles/${encodeURIComponent(userId)}/selected-guild`,
    {
      method: "PUT",
      body: { selectedGuildId },
    }
  );
}

export async function listStaleConnections(
  beforeMs: number,
  limit = 100
): Promise<LinkedRoleConnectionRecord[]> {
  return await jsonRequest<LinkedRoleConnectionRecord[]>(
    `${DATABASE_SERVICE_URL}/linked-roles/stale?beforeMs=${beforeMs}&limit=${limit}`
  );
}

export async function computeMetadataForGuild(
  guildId: string,
  userId: string
): Promise<MetricPayload> {
  const [balance, levels] = await Promise.all([
    jsonRequest<BalancePayload>(
      `${DATABASE_SERVICE_URL}/economy/balance/${encodeURIComponent(guildId)}/${encodeURIComponent(userId)}`
    ).catch((error: unknown) => {
      if (isNotFound(error)) {
        return { balance: 0 };
      }
      throw error;
    }),
    jsonRequest<LevelsPayload>(
      `${DATABASE_SERVICE_URL}/xp/levels/${encodeURIComponent(guildId)}/${encodeURIComponent(userId)}`
    ).catch((error: unknown) => {
      if (isNotFound(error)) {
        return {} as LevelsPayload;
      }
      throw error;
    }),
  ]);

  const walletBalance = Math.max(0, toSafeInteger(balance?.balance, 0));

  return {
    wallet_balance: walletBalance,
    chat_level: Math.max(1, toSafeInteger(levels?.text?.level, 1)),
    voice_level: Math.max(1, toSafeInteger(levels?.voice?.level, 1)),
    total_xp: Math.max(0, toSafeInteger(levels?.text?.totalXP, 0)),
  };
}
