import hubClient from "../api/hubClient.ts";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getRuntimeRedisClient,
  buildPrefixedKey,
} from "../services/runtimeRedis.ts";
import { recordEventCall } from "../services/metrics.ts";

type ClientLike = {
  guilds: {
    cache: {
      values: () => IterableIterator<unknown>;
    };
  };
  users: {
    fetch: (userId: string) => Promise<{
      send: (payload: {
        content?: string;
        embeds?: Array<Record<string, unknown>>;
      }) => Promise<unknown>;
    }>;
  };
};

type GuildLike = {
  id: string;
  name: string;
};

type DailyStatus = {
  reminderEligible?: boolean;
};

type WeeklyStatus = {
  ready?: boolean;
  readyToken?: string | null;
};

type BankStatus = {
  cycleComplete?: boolean;
  cycleCount?: number;
};

type GameResetStatus = {
  eligible?: boolean;
  resetGames?: string[];
  previousDateKey?: string;
};

type NotificationStatus = {
  locale?: string | null;
  daily?: DailyStatus;
  weekly?: WeeklyStatus;
  bank?: BankStatus;
  gameReset?: GameResetStatus;
};

type ReminderType = "daily" | "weekly" | "bank_cycle" | "game_reset";

type ReminderCandidate = {
  type: ReminderType;
  token: string;
  ttlMs: number;
  text: string;
  onSuccess?: () => Promise<void>;
};

type ReservedReminder = ReminderCandidate & {
  redisReservationKey: string | null;
};

type SupportedLocale = "en" | "ru" | "uk";

const REMINDER_INTERVAL_MS = 60 * 60 * 1000;
const REMINDER_LOCK_KEY = "player-reminders";
const REMINDER_LOCK_TTL_MS = Math.floor(REMINDER_INTERVAL_MS * 0.9);
const JITTER_MAX_MS = 5 * 60 * 1000;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 100;
const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const localReminderReservationExpiries = new Map<string, number>();

const GAME_LABELS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "2048": "2048",
    snake: "Snake",
    tower: "Tower",
    coinflip: "Coinflip",
    rpg_clicker2: "RPG Clicker",
  },
  ru: {
    "2048": "2048",
    snake: "Змейка",
    tower: "Башня",
    coinflip: "Монетка",
    rpg_clicker2: "RPG Clicker",
  },
  uk: {
    "2048": "2048",
    snake: "Змійка",
    tower: "Вежа",
    coinflip: "Монетка",
    rpg_clicker2: "RPG Clicker",
  },
};

const LOCALE_COPY = {
  en: {
    digestTitle: "Reminder Center",
    digestDescription: "Here are your current updates for **{{guildName}}**:",
    digestFallback: "You have new reminders.",
    digestFooter: "Tip: keep DMs enabled to receive reminder updates.",
    daily: "🎁 Your daily crate is ready. Use `/cases` to keep your streak.",
    weekly: "📦 Your weekly crate is ready. Use `/cases` to claim it.",
    bankCycle:
      "🏦 Bank cycle{{cycleSuffix}} is complete. Use `/economy continue` to resume interest.",
    gameReset: "🎮 Daily game earnings reset ({{games}}). You can earn coins again today.",
  },
  ru: {
    digestTitle: "Центр Напоминаний",
    digestDescription: "Актуальные обновления для **{{guildName}}**:",
    digestFallback: "У вас есть новые напоминания.",
    digestFooter: "Совет: держите ЛС открытыми, чтобы получать уведомления.",
    daily: "🎁 Ежедневный кейс готов. Используйте `/cases`, чтобы сохранить серию.",
    weekly: "📦 Недельный кейс готов. Используйте `/cases`, чтобы забрать награду.",
    bankCycle:
      "🏦 Банковский цикл{{cycleSuffix}} завершен. Используйте `/economy continue`, чтобы возобновить проценты.",
    gameReset:
      "🎮 Дневной лимит заработка в играх сброшен ({{games}}). Сегодня снова можно зарабатывать монеты.",
  },
  uk: {
    digestTitle: "Центр Нагадувань",
    digestDescription: "Актуальні оновлення для **{{guildName}}**:",
    digestFallback: "У вас є нові нагадування.",
    digestFooter: "Порада: тримайте ЛС відкритими, щоб отримувати сповіщення.",
    daily: "🎁 Щоденний кейс готовий. Використайте `/cases`, щоб зберегти серію.",
    weekly: "📦 Тижневий кейс готовий. Використайте `/cases`, щоб забрати нагороду.",
    bankCycle:
      "🏦 Банківський цикл{{cycleSuffix}} завершено. Використайте `/economy continue`, щоб відновити відсотки.",
    gameReset:
      "🎮 Денний ліміт заробітку в іграх скинуто ({{games}}). Сьогодні знову можна заробляти монети.",
  },
} as const;

function toLocalePrefix(locale: string | null | undefined): string {
  return (locale || "en").split("-")[0] || "en";
}

function resolveLocale(locale: string | null | undefined): SupportedLocale {
  const prefix = toLocalePrefix(locale);
  if (prefix === "ru" || prefix === "uk") {
    return prefix;
  }
  return "en";
}

function parseEmbedColor(): number {
  const raw = process.env.EMBED_COLOR || "";
  if (!raw) {
    return 0x3465d8;
  }

  const normalized = raw.trim().replace(/^#/, "");
  const parsed = Number.parseInt(normalized, 16);
  return Number.isNaN(parsed) ? 0x3465d8 : parsed;
}

function interpolate(template: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, value),
    template
  );
}

function getCopy(locale: string): (typeof LOCALE_COPY)[SupportedLocale] {
  const prefix = resolveLocale(locale);
  return LOCALE_COPY[prefix];
}

function getTodayDateKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().split("T")[0] || "unknown";
}

function formatGameNames(locale: string, gameIds: string[]): string {
  const labels = GAME_LABELS[resolveLocale(locale)];
  return gameIds.map((id) => labels[id] || id).join(", ");
}

function getDailyReminderText(locale: string): string {
  return getCopy(locale).daily;
}

function getWeeklyReminderText(locale: string): string {
  return getCopy(locale).weekly;
}

function getBankCycleReminderText(locale: string, cycleCount: number): string {
  const cycleSuffix = cycleCount > 0 ? ` #${cycleCount}` : "";
  return interpolate(getCopy(locale).bankCycle, { cycleSuffix });
}

function getGameResetReminderText(locale: string, gameIds: string[]): string {
  const games = formatGameNames(locale, gameIds);
  return interpolate(getCopy(locale).gameReset, { games });
}

function buildDigestEmbed(
  locale: string,
  guildName: string,
  lines: string[]
): Record<string, unknown> {
  const copy = getCopy(locale);

  return {
    title: copy.digestTitle,
    description: [
      interpolate(copy.digestDescription, { guildName }),
      "",
      ...lines.map((line) => `• ${line}`),
    ].join("\n"),
    color: parseEmbedColor(),
    footer: {
      text: copy.digestFooter,
    },
    timestamp: new Date().toISOString(),
  };
}

function getDigestFallbackContent(locale: string): string {
  return getCopy(locale).digestFallback;
}

async function reserveReminderIdempotency(
  guildId: string,
  userId: string,
  type: ReminderType,
  token: string,
  ttlMs: number
): Promise<{ acquired: boolean; redisReservationKey: string | null }> {
  const redisReservationKey = buildPrefixedKey(
    `reminder:sent:${type}:${guildId}:${userId}:${token}`
  );

  const client = await getRuntimeRedisClient();
  if (!client) {
    const now = Date.now();
    for (const [key, expiry] of localReminderReservationExpiries.entries()) {
      if (expiry <= now) {
        localReminderReservationExpiries.delete(key);
      }
    }

    const existingExpiry = localReminderReservationExpiries.get(redisReservationKey) || 0;

    if (existingExpiry > now) {
      return { acquired: false, redisReservationKey: null };
    }

    localReminderReservationExpiries.set(redisReservationKey, now + ttlMs);
    return { acquired: true, redisReservationKey };
  }

  try {
    const result = await client.set(redisReservationKey, Date.now().toString(), {
      PX: ttlMs,
      NX: true,
    });

    return {
      acquired: result === "OK",
      redisReservationKey: result === "OK" ? redisReservationKey : null,
    };
  } catch (error) {
    console.error("[playerReminders] idempotency reserve failed:", error);
    return { acquired: true, redisReservationKey: null };
  }
}

async function releaseReminderReservation(redisReservationKey: string | null): Promise<void> {
  if (!redisReservationKey) {
    return;
  }

  if (localReminderReservationExpiries.has(redisReservationKey)) {
    localReminderReservationExpiries.delete(redisReservationKey);
  }

  const client = await getRuntimeRedisClient();
  if (!client) {
    return;
  }

  try {
    await client.del(redisReservationKey);
  } catch (error) {
    console.warn("[playerReminders] failed to release reservation key:", error);
  }
}

function calculateJitter(): number {
  return Math.floor(Math.random() * JITTER_MAX_MS);
}

function calculateJitteredInterval(): number {
  const variance = REMINDER_INTERVAL_MS * 0.1;
  const jitter = (Math.random() - 0.5) * 2 * variance;
  return Math.floor(REMINDER_INTERVAL_MS + jitter);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reserveCandidates(
  guildId: string,
  userId: string,
  candidates: ReminderCandidate[]
): Promise<ReservedReminder[]> {
  const reserved: ReservedReminder[] = [];

  for (const candidate of candidates) {
    const reservation = await reserveReminderIdempotency(
      guildId,
      userId,
      candidate.type,
      candidate.token,
      candidate.ttlMs
    );

    if (!reservation.acquired) {
      continue;
    }

    reserved.push({
      ...candidate,
      redisReservationKey: reservation.redisReservationKey,
    });
  }

  return reserved;
}

async function processPlayerReminders(client: ClientLike): Promise<void> {
  const guilds = Array.from(client.guilds.cache.values()).filter(
    (guild): guild is GuildLike =>
      guild != null &&
      typeof guild === "object" &&
      "id" in guild &&
      "name" in guild
  );

  for (const guild of guilds) {
    try {
      const users = (await hubClient.getGuildUsers(guild.id)) as Array<{ id?: string }>;

      for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);

        for (const entry of batch) {
          const userId = entry?.id;
          if (!userId) {
            continue;
          }

          try {
            const status = (await hubClient.getUserNotificationStatus(
              guild.id,
              userId
            )) as NotificationStatus;
            const locale = toLocalePrefix(status?.locale);
            const todayDateKey = getTodayDateKey();

            const candidates: ReminderCandidate[] = [];

            if (status?.daily?.reminderEligible) {
              candidates.push({
                type: "daily",
                token: todayDateKey,
                ttlMs: DEFAULT_IDEMPOTENCY_TTL_MS,
                text: getDailyReminderText(locale),
                onSuccess: async () => {
                  await hubClient.markDailyCrateReminderSent(guild.id, userId);
                },
              });
            }

            if (status?.weekly?.ready) {
              candidates.push({
                type: "weekly",
                token: String(status.weekly.readyToken || "ready"),
                ttlMs: 8 * 24 * 60 * 60 * 1000,
                text: getWeeklyReminderText(locale),
              });
            }

            if (status?.bank?.cycleComplete) {
              const cycleCount = Math.max(0, Number(status.bank.cycleCount || 0));
              candidates.push({
                type: "bank_cycle",
                token: String(cycleCount || "complete"),
                ttlMs: 30 * 24 * 60 * 60 * 1000,
                text: getBankCycleReminderText(locale, cycleCount),
              });
            }

            if (status?.gameReset?.eligible && Array.isArray(status.gameReset.resetGames)) {
              const resetGames = status.gameReset.resetGames.filter((id) => typeof id === "string");
              if (resetGames.length > 0) {
                candidates.push({
                  type: "game_reset",
                  token: String(status.gameReset.previousDateKey || todayDateKey),
                  ttlMs: 36 * 60 * 60 * 1000,
                  text: getGameResetReminderText(locale, resetGames),
                });
              }
            }

            if (candidates.length === 0) {
              continue;
            }

            const reserved = await reserveCandidates(guild.id, userId, candidates);
            if (reserved.length === 0) {
              continue;
            }

            try {
              const user = await client.users.fetch(userId);
              await user.send({
                content: getDigestFallbackContent(locale),
                embeds: [
                  buildDigestEmbed(
                    locale,
                    guild.name,
                    reserved.map((item) => item.text)
                  ),
                ],
              });

              for (const reminder of reserved) {
                if (reminder.onSuccess) {
                  await reminder.onSuccess();
                }
              }
            } catch (sendError) {
              for (const reminder of reserved) {
                await releaseReminderReservation(reminder.redisReservationKey);
              }
              throw sendError;
            }
          } catch (error) {
            console.warn(`[playerReminders] Failed for ${guild.id}/${userId}:`, error);
          }
        }

        if (i + BATCH_SIZE < users.length) {
          await sleep(BATCH_DELAY_MS);
        }
      }
    } catch (error) {
      console.warn(`[playerReminders] Failed guild ${guild.id}:`, error);
    }
  }
}

function startDailyCrateReminders(client: ClientLike): void {
  const runPass = async (label: string): Promise<void> => {
    const startedAt = Date.now();
    let isError = false;

    try {
      const lock = await acquireDistributedLock(REMINDER_LOCK_KEY, REMINDER_LOCK_TTL_MS);

      if (!lock.acquired) {
        console.log(`[playerReminders] Skip ${label}; lock not acquired`);
        return;
      }

      try {
        await processPlayerReminders(client);
      } finally {
        await releaseDistributedLock(REMINDER_LOCK_KEY, lock.token);
      }
    } catch (error) {
      isError = true;
      throw error;
    } finally {
      const duration = Date.now() - startedAt;
      recordEventCall("dailyCrateReminders", duration, isError);
    }
  };

  const initialJitter = calculateJitter();
  console.log(`[playerReminders] Scheduling initial pass with ${initialJitter}ms jitter`);

  setTimeout(() => {
    runPass("startup").catch((error) => {
      console.error("[playerReminders] Initial pass failed:", error);
    });

    const scheduleNext = (): void => {
      const jitteredInterval = calculateJitteredInterval();
      setTimeout(() => {
        runPass("interval").catch((error) => {
          console.error("[playerReminders] Loop failed:", error);
        });
        scheduleNext();
      }, jitteredInterval);
    };

    scheduleNext();
  }, initialJitter);
}

export { startDailyCrateReminders, processPlayerReminders };
