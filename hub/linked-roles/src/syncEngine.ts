import {
  LINKED_ROLES_QUEUE_BASE_DELAY_MS,
  LINKED_ROLES_QUEUE_MAX_DELAY_MS,
  LINKED_ROLES_QUEUE_MAX_RETRIES,
  LINKED_ROLES_RECONCILIATION_INTERVAL_MS,
} from "./config.ts";
import {
  computeMetadataForGuild,
  getLinkedRoleConnection,
  listStaleConnections,
  updateLinkedRoleSync,
} from "./databaseApi.ts";
import { decryptString, encryptString } from "./crypto.ts";
import {
  fetchDiscordUser,
  refreshTokens,
  updateRoleConnectionMetadata,
} from "./discordApi.ts";
import type {
  LinkedRoleConnectionRecord,
  MetricPayload,
  SyncOutcome,
  SyncQueueJob,
} from "./types.ts";
import { clamp, parseStringArray, toNumber } from "./utils.ts";

const queuedJobs = new Map<string, SyncQueueJob>();
const inFlightUsers = new Set<string>();

let queueTimer: ReturnType<typeof setInterval> | null = null;
let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error || "Unknown error");
}

function isRetryableError(error: unknown): boolean {
  const typed = error as { retryable?: boolean; status?: number };
  if (typed?.retryable) {
    return true;
  }

  const status = Number(typed?.status || 0);
  return status === 429 || status >= 500;
}

function nextRetryDelayMs(attempt: number): number {
  const baseDelay = LINKED_ROLES_QUEUE_BASE_DELAY_MS * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(baseDelay * Math.random() * 0.3);
  return clamp(baseDelay + jitter, LINKED_ROLES_QUEUE_BASE_DELAY_MS, LINKED_ROLES_QUEUE_MAX_DELAY_MS);
}

async function resolveValidTokens(
  connection: LinkedRoleConnectionRecord
): Promise<{ accessToken: string; refreshToken: string; expiresAtMs: number }> {
  let accessToken = decryptString(connection.encryptedAccessToken);
  let refreshToken = decryptString(connection.encryptedRefreshToken);
  let expiresAtMs = toNumber(connection.tokenExpiresAt, 0);

  const shouldRefresh = expiresAtMs <= Date.now() + 60_000;
  if (!shouldRefresh) {
    return { accessToken, refreshToken, expiresAtMs };
  }

  const refreshed = await refreshTokens(refreshToken);
  if (!refreshed?.access_token) {
    const error = new Error("Discord refresh token response missing access token") as Error & {
      retryable?: boolean;
    };
    error.retryable = false;
    throw error;
  }

  accessToken = refreshed.access_token;
  refreshToken = refreshed.refresh_token || refreshToken;
  expiresAtMs = Date.now() + Number(refreshed.expires_in || 3600) * 1000;

  await updateLinkedRoleSync(connection.userId, {
    encryptedAccessToken: encryptString(accessToken),
    encryptedRefreshToken: encryptString(refreshToken),
    tokenExpiresAt: expiresAtMs,
    scopes: parseStringArray(
      typeof refreshed.scope === "string" ? refreshed.scope.split(" ") : []
    ),
    syncStatus: "token_refreshed",
    lastSyncError: null,
  });

  return { accessToken, refreshToken, expiresAtMs };
}

async function publishMetadata(
  connection: LinkedRoleConnectionRecord,
  metadata: MetricPayload,
  accessToken: string
): Promise<void> {
  const platformUsername = connection.selectedGuildId
    ? `${connection.userId}@${connection.selectedGuildId}`
    : connection.userId;

  await updateRoleConnectionMetadata(
    accessToken,
    metadata,
    "Eleazar Hub",
    platformUsername
  );
}

async function syncUserConnection(userId: string, reason: string): Promise<SyncOutcome> {
  const connection = await getLinkedRoleConnection(userId);
  if (!connection) {
    await updateLinkedRoleSync(userId, {
      syncStatus: "disconnected",
      lastSyncError: "Linked role connection not found",
      lastSyncAt: Date.now(),
    }).catch(() => null);

    return {
      ok: false,
      retryable: false,
      error: "Linked role connection not found",
    };
  }

  const selectedGuildId = String(connection.selectedGuildId || "").trim();
  if (!selectedGuildId) {
    await updateLinkedRoleSync(userId, {
      syncStatus: "missing_selected_guild",
      lastSyncError: "No selected guild for linked roles",
      lastSyncAt: Date.now(),
    });

    return {
      ok: false,
      retryable: false,
      error: "No selected guild configured",
    };
  }

  let accessToken = "";

  try {
    const tokenState = await resolveValidTokens(connection);
    accessToken = tokenState.accessToken;
  } catch (error) {
    await updateLinkedRoleSync(userId, {
      syncStatus: "token_error",
      lastSyncError: getErrorMessage(error),
      lastSyncAt: Date.now(),
    }).catch(() => null);

    return {
      ok: false,
      retryable: isRetryableError(error),
      error: getErrorMessage(error),
    };
  }

  let metadata: MetricPayload;
  try {
    metadata = await computeMetadataForGuild(selectedGuildId, userId);
  } catch (error) {
    return {
      ok: false,
      retryable: isRetryableError(error),
      error: `Metric calculation failed: ${getErrorMessage(error)}`,
    };
  }

  try {
    await publishMetadata(connection, metadata, accessToken);
  } catch (error) {
    const status = Number((error as { status?: number })?.status || 0);
    if (status === 401) {
      try {
        const refreshed = await refreshTokens(decryptString(connection.encryptedRefreshToken));
        const refreshedToken = refreshed.access_token;
        const refreshedRefreshToken =
          refreshed.refresh_token || decryptString(connection.encryptedRefreshToken);
        const expiresAt = Date.now() + Number(refreshed.expires_in || 3600) * 1000;

        await updateLinkedRoleSync(userId, {
          encryptedAccessToken: encryptString(refreshedToken),
          encryptedRefreshToken: encryptString(refreshedRefreshToken),
          tokenExpiresAt: expiresAt,
        });

        await publishMetadata(connection, metadata, refreshedToken);
      } catch (secondError) {
        return {
          ok: false,
          retryable: isRetryableError(secondError),
          error: getErrorMessage(secondError),
        };
      }
    } else {
      return {
        ok: false,
        retryable: isRetryableError(error),
        error: getErrorMessage(error),
      };
    }
  }

  await updateLinkedRoleSync(userId, {
    syncStatus: "synced",
    lastSyncAt: Date.now(),
    lastSyncError: null,
  });

  console.log(`[linked-roles] synced metadata for user ${userId} (${reason})`);
  return { ok: true, metadata };
}

async function executeJob(job: SyncQueueJob): Promise<void> {
  inFlightUsers.add(job.userId);

  try {
    const outcome = await syncUserConnection(job.userId, job.reason);
    if (outcome.ok) {
      queuedJobs.delete(job.userId);
      return;
    }

    const nextAttempt = job.attempts + 1;
    if (!outcome.retryable || nextAttempt > LINKED_ROLES_QUEUE_MAX_RETRIES) {
      queuedJobs.delete(job.userId);
      await updateLinkedRoleSync(job.userId, {
        syncStatus: "error",
        lastSyncAt: Date.now(),
        lastSyncError: outcome.error,
      }).catch(() => null);
      return;
    }

    const delayMs = nextRetryDelayMs(nextAttempt);
    queuedJobs.set(job.userId, {
      ...job,
      attempts: nextAttempt,
      nextRunAt: Date.now() + delayMs,
      lastError: outcome.error,
    });

    await updateLinkedRoleSync(job.userId, {
      syncStatus: "retrying",
      lastSyncError: outcome.error,
      lastSyncAt: Date.now(),
    }).catch(() => null);
  } finally {
    inFlightUsers.delete(job.userId);
  }
}

async function processQueue(): Promise<void> {
  const now = Date.now();
  const dueJobs = Array.from(queuedJobs.values())
    .filter((job) => job.nextRunAt <= now)
    .sort((a, b) => a.nextRunAt - b.nextRunAt);

  for (const job of dueJobs) {
    if (inFlightUsers.has(job.userId)) {
      continue;
    }

    void executeJob(job);
  }
}

async function runReconciliation(): Promise<void> {
  try {
    const staleBefore = Date.now() - LINKED_ROLES_RECONCILIATION_INTERVAL_MS;
    const rows = await listStaleConnections(staleBefore, 200);
    for (const row of rows) {
      enqueueSync(row.userId, "reconciliation", Math.floor(Math.random() * 3000));
    }
  } catch (error) {
    console.warn("[linked-roles] reconciliation job failed", error);
  }
}

export function enqueueSync(userId: string, reason: string, delayMs = 0): void {
  if (!userId) {
    return;
  }

  const runAt = Date.now() + Math.max(0, delayMs);
  const existing = queuedJobs.get(userId);
  if (!existing) {
    queuedJobs.set(userId, {
      userId,
      reason,
      attempts: 0,
      nextRunAt: runAt,
    });
  } else {
    existing.nextRunAt = Math.min(existing.nextRunAt, runAt);
    existing.reason = reason || existing.reason;
    queuedJobs.set(userId, existing);
  }

  void updateLinkedRoleSync(userId, {
    syncStatus: "queued",
    lastSyncError: null,
  }).catch(() => null);
}

export function startSyncEngine(): void {
  if (!queueTimer) {
    queueTimer = setInterval(() => {
      void processQueue();
    }, 1_000);
  }

  if (!reconciliationTimer) {
    reconciliationTimer = setInterval(() => {
      void runReconciliation();
    }, LINKED_ROLES_RECONCILIATION_INTERVAL_MS);
  }

  void runReconciliation();
}

export async function resolveStatusPreview(
  userId: string
): Promise<MetricPayload | null> {
  const connection = await getLinkedRoleConnection(userId);
  if (!connection || !connection.selectedGuildId) {
    return null;
  }

  try {
    return await computeMetadataForGuild(connection.selectedGuildId, userId);
  } catch {
    return null;
  }
}
