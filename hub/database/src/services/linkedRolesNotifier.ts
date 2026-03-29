import { DEFAULT_SERVICE_URLS } from "../../../shared/src/serviceConfig.ts";

type LinkedRoleMetricEvent = {
  userId: string;
  guildId?: string;
  reason?: string;
  source?: string;
  at?: number;
};

const LINKED_ROLES_SERVICE_URL = (
  process.env.LINKED_ROLES_SERVICE_URL || DEFAULT_SERVICE_URLS.linkedRoles
).replace(/\/$/, "");

const LINKED_ROLES_INTERNAL_WEBHOOK_KEY =
  process.env.LINKED_ROLES_INTERNAL_WEBHOOK_KEY || "";

const LINKED_ROLES_NOTIFY_TIMEOUT_MS = Number(
  process.env.LINKED_ROLES_NOTIFY_TIMEOUT_MS || 2_000
);

async function postMetricEvent(event: LinkedRoleMetricEvent): Promise<void> {
  if (!LINKED_ROLES_INTERNAL_WEBHOOK_KEY || !LINKED_ROLES_SERVICE_URL) {
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LINKED_ROLES_NOTIFY_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${LINKED_ROLES_SERVICE_URL}/internal/events/metric-updated`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-linked-roles-key": LINKED_ROLES_INTERNAL_WEBHOOK_KEY,
        },
        body: JSON.stringify({
          ...event,
          at: event.at || Date.now(),
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn(
        `[linked-roles-notifier] failed to push event for ${event.userId}: ${response.status}`
      );
    }
  } catch (error) {
    console.warn("[linked-roles-notifier] event push failed", error);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function notifyLinkedRolesMetricUpdated(
  event: LinkedRoleMetricEvent
): Promise<void> {
  if (!event?.userId) {
    return;
  }

  await postMetricEvent(event);
}

export async function notifyLinkedRolesMetricUpdatedMany(
  events: LinkedRoleMetricEvent[]
): Promise<void> {
  if (!Array.isArray(events) || events.length === 0) {
    return;
  }

  await Promise.all(events.map((event) => postMetricEvent(event)));
}
