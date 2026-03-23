import hubClient from "../api/hubClient.ts";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getRuntimeRedisClient,
  buildPrefixedKey,
} from "../services/runtimeRedis.ts";

type ClientLike = {
  guilds: {
    cache: {
      values: () => IterableIterator<unknown>;
    };
  };
  users: {
    fetch: (userId: string) => Promise<{
      send: (payload: { content: string }) => Promise<unknown>;
    }>;
  };
};

type GuildLike = {
  id: string;
  name: string;
};

const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_LOCK_KEY = "daily-crate-reminders";
const REMINDER_LOCK_TTL_MS = Math.floor(REMINDER_INTERVAL_MS * 0.9);
const JITTER_MAX_MS = 5 * 60 * 1000; // 5 minutes max jitter
const BATCH_SIZE = 50; // Process users in batches of 50
const BATCH_DELAY_MS = 100; // 100ms delay between batches to avoid rate limits
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL for idempotency keys

/**
 * Check if a reminder has already been sent to this user in the current period.
 * Uses Redis SET NX for atomic idempotency check.
 * Returns true if this is the first attempt (should proceed), false if already sent.
 */
async function checkReminderIdempotency(guildId: string, userId: string): Promise<boolean> {
  const client = await getRuntimeRedisClient();
  if (!client) {
    // If Redis unavailable, allow the reminder (rely on DB check instead)
    return true;
  }

  const key = buildPrefixedKey(`reminder:sent:${guildId}:${userId}`);
  const today = new Date().toISOString().split("T")[0] as string; // YYYY-MM-DD

  try {
    const result = await client.set(key, today, {
      PX: IDEMPOTENCY_TTL_MS,
      NX: true,
    });

    return result === "OK";
  } catch (error) {
    console.error("[dailyCrateReminders] Idempotency check failed:", error);
    return true; // Allow on error
  }
}

/**
 * Calculate jittered delay to prevent thundering herd across shards.
 * Uses shard ID to create deterministic but distributed delays.
 */
function calculateJitter(): number {
  // Random jitter between 0 and JITTER_MAX_MS
  return Math.floor(Math.random() * JITTER_MAX_MS);
}

/**
 * Calculate jittered interval with ±10% variance to desynchronize shards.
 */
function calculateJitteredInterval(): number {
  const variance = REMINDER_INTERVAL_MS * 0.1; // 10% variance
  const jitter = (Math.random() - 0.5) * 2 * variance; // ±10%
  return Math.floor(REMINDER_INTERVAL_MS + jitter);
}

function getReminderText(locale: string | null | undefined, guildName: string): string {
  switch ((locale || "en").split("-")[0]) {
    case "ru":
      return `🎁 Ваш ежедневный кейс в ${guildName} уже готов. Откройте /cases, чтобы не потерять серию.`;
    case "uk":
      return `🎁 Ваш щоденний кейс у ${guildName} вже готовий. Відкрийте /cases, щоб не втратити серію.`;
    default:
      return `🎁 Your daily crate in ${guildName} is ready. Open /cases so you don't lose your streak.`;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processDailyCrateReminders(client: ClientLike): Promise<void> {
  const guilds = Array.from(client.guilds.cache.values()).filter(
    (guild): guild is GuildLike =>
      guild != null && typeof guild === "object" && "id" in guild && "name" in guild
  );

  for (const guild of guilds) {
    try {
      const users = (await hubClient.getGuildUsers(guild.id)) as Array<{ id?: string }>;
      
      // Process users in batches to avoid memory spikes and rate limits
      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        
        for (const entry of batch) {
          const userId = entry?.id;
          if (!userId) {
            continue;
          }

          try {
            // Check idempotency first - skip if already sent today
            const isFirstAttempt = await checkReminderIdempotency(guild.id, userId);
            if (!isFirstAttempt) {
              continue; // Already sent, skip
            }

            const dailyStatus = (await hubClient.getDailyCrateStatus(guild.id, userId)) as {
              reminderEligible?: boolean;
            };

            if (!dailyStatus?.reminderEligible) {
              continue;
            }

            const locale = await hubClient.getUserLocale(guild.id, userId).catch(() => "en");
            const user = await client.users.fetch(userId);
            await user.send({
              content: getReminderText(locale, guild.name),
            });
            await hubClient.markDailyCrateReminderSent(guild.id, userId);
          } catch (error) {
            console.warn(`Failed daily crate reminder for ${guild.id}/${userId}:`, error);
          }
        }

        // Delay between batches to avoid rate limits and reduce hub load
        if (i + BATCH_SIZE < users.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }
    } catch (error) {
      console.warn(`Failed to process daily crate reminders for guild ${guild.id}:`, error);
    }
  }
}

function startDailyCrateReminders(client: ClientLike): void {
  const runPass = async (label: string): Promise<void> => {
    const lock = await acquireDistributedLock(REMINDER_LOCK_KEY, REMINDER_LOCK_TTL_MS);

    if (!lock.acquired) {
      console.log(`[dailyCrateReminders] Skip ${label}; lock not acquired`);
      return;
    }

    try {
      await processDailyCrateReminders(client);
    } finally {
      await releaseDistributedLock(REMINDER_LOCK_KEY, lock.token);
    }
  };

  // Apply initial jitter delay on startup to desynchronize shards
  const initialJitter = calculateJitter();
  console.log(`[dailyCrateReminders] Scheduling initial pass with ${initialJitter}ms jitter`);

  setTimeout(() => {
    // Run after jitter delay to catch up on missed reminders during downtime
    runPass("startup").catch((error) => {
      console.error("Initial daily crate reminder pass failed:", error);
    });

    // Then run on jittered interval to prevent synchronized load spikes
    const scheduleNext = (): void => {
      const jitteredInterval = calculateJitteredInterval();
      setTimeout(() => {
        runPass("interval").catch((error) => {
          console.error("Daily crate reminder loop failed:", error);
        });
        scheduleNext(); // Schedule next with new jitter
      }, jitteredInterval);
    };
    scheduleNext();
  }, initialJitter);
}

export { startDailyCrateReminders, processDailyCrateReminders };
