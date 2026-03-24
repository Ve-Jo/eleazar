import { UPGRADES } from "../constants/database.ts";
import { getEconomyTuningConfig } from "../../../shared/src/economyTuning.ts";

type UnknownRecord = Record<string, unknown>;

type UpgradeRecord = {
  type?: string;
  level?: number;
};

type StatisticsRecord = {
  interactionStats?: unknown;
};

type PrismaClientLike = {
  $queryRawUnsafe: (
    query: string,
    ...params: unknown[]
  ) => Promise<Array<{ awardedAmount?: unknown; earnedAfter?: unknown }>>;
  gameDailyEarnings: {
    upsert: (args: {
      where: {
        guildId_userId_gameId_dateKey: {
          guildId: string;
          userId: string;
          gameId: string;
          dateKey: string;
        };
      };
      update: { lastUpdated: number };
      create: {
        guildId: string;
        userId: string;
        gameId: string;
        dateKey: string;
        earned: number;
        lastUpdated: number;
      };
    }) => Promise<{ earned: unknown }>;
    findUnique: (args: {
      where: {
        guildId_userId_gameId_dateKey: {
          guildId: string;
          userId: string;
          gameId: string;
          dateKey: string;
        };
      };
    }) => Promise<{ earned: unknown } | null>;
    findMany: (args: {
      where: {
        guildId: string;
        userId: string;
        dateKey: string;
      };
      select: {
        gameId: true;
        earned: true;
      };
    }) => Promise<Array<{ gameId: string; earned: unknown }>>;
  };
};

async function getGameDailyStatusFromDb(
  prisma: PrismaClientLike,
  guildId: string,
  userId: string,
  gameId: string,
  upgrades: UpgradeRecord[] | null | undefined,
  referenceTimestamp = Date.now()
): Promise<GameDailyStatus> {
  const dateKey = getDateKey(referenceTimestamp);
  const tuning = getEconomyTuningConfig();
  const rawBaseCap = GAME_DAILY_CAPS[gameId] || 150;
  const baseCap = Math.max(
    1,
    Math.floor(rawBaseCap * Math.max(0.2, Number(tuning.faucets.gameDailyCapMultiplier || 1)))
  );
  const upgradeLevel = getUpgradeLevel(upgrades, "games_earning");
  const multiplier =
    1 + Math.max(0, upgradeLevel - 1) * Number(UPGRADES.games_earning.effectMultiplier || 0);
  const cap = Math.max(baseCap, Math.floor(baseCap * multiplier));

  const record = await prisma.gameDailyEarnings.findUnique({
    where: {
      guildId_userId_gameId_dateKey: {
        guildId,
        userId,
        gameId,
        dateKey,
      },
    },
  });

  const earnedToday = toFiniteNumber(record?.earned, 0);
  const remainingToday = Math.max(0, cap - earnedToday);

  return {
    gameId,
    dateKey,
    earnedToday,
    remainingToday,
    baseCap,
    cap,
    upgradeLevel,
    multiplier: Number(multiplier.toFixed(2)),
  };
}

async function awardGameDailyEarningsAtomic(
  prisma: PrismaClientLike,
  guildId: string,
  userId: string,
  gameId: string,
  requestedAmount: number,
  capAmount: number,
  referenceTimestamp = Date.now()
): Promise<{ awardedAmount: number; earnedAfter: number }> {
  const dateKey = getDateKey(referenceTimestamp);
  const safeRequested = Math.max(0, toFiniteNumber(requestedAmount, 0));
  const safeCap = Math.max(0, toFiniteNumber(capAmount, 0));

  const baseRecord = await prisma.gameDailyEarnings.upsert({
    where: {
      guildId_userId_gameId_dateKey: {
        guildId,
        userId,
        gameId,
        dateKey,
      },
    },
    update: {
      // Keep this as "ensure row exists" only; award math is done atomically below.
      lastUpdated: referenceTimestamp,
    },
    create: {
      guildId,
      userId,
      gameId,
      dateKey,
      earned: 0,
      lastUpdated: referenceTimestamp,
    },
  });

  if (safeRequested <= 0 || safeCap <= 0) {
    return {
      awardedAmount: 0,
      earnedAfter: toFiniteNumber(baseRecord.earned, 0),
    };
  }

  const rows = await prisma.$queryRawUnsafe(
    `
      WITH locked AS (
        SELECT earned
        FROM game_daily_earnings
        WHERE guild_id = $1 AND user_id = $2 AND game_id = $3 AND date_key = $4
        FOR UPDATE
      ),
      calc AS (
        SELECT GREATEST(
          0::numeric,
          LEAST($5::numeric, $6::numeric - COALESCE((SELECT earned FROM locked), 0::numeric))
        ) AS awarded
      ),
      updated AS (
        UPDATE game_daily_earnings
        SET earned = earned + (SELECT awarded FROM calc),
            last_updated = $7
        WHERE guild_id = $1 AND user_id = $2 AND game_id = $3 AND date_key = $4
        RETURNING earned
      )
      SELECT
        (SELECT awarded FROM calc) AS "awardedAmount",
        COALESCE((SELECT earned FROM updated), COALESCE((SELECT earned FROM locked), 0::numeric)) AS "earnedAfter"
    `,
    guildId,
    userId,
    gameId,
    dateKey,
    safeRequested,
    safeCap,
    referenceTimestamp
  );

  const row = rows[0] || {};
  const awardedAmount = toFiniteNumber(row.awardedAmount, 0);
  const earnedAfter = toFiniteNumber(row.earnedAfter, 0);

  return {
    awardedAmount,
    earnedAfter,
  };
}

async function getGameDailyResetStatusFromDb(
  prisma: PrismaClientLike,
  guildId: string,
  userId: string,
  referenceTimestamp = Date.now()
): Promise<GameDailyResetStatus> {
  const todayDateKey = getDateKey(referenceTimestamp);
  const previousDateKey = addUtcDays(todayDateKey, -1);

  const [previousRows, todayRows] = await Promise.all([
    prisma.gameDailyEarnings.findMany({
      where: {
        guildId,
        userId,
        dateKey: previousDateKey,
      },
      select: {
        gameId: true,
        earned: true,
      },
    }),
    prisma.gameDailyEarnings.findMany({
      where: {
        guildId,
        userId,
        dateKey: todayDateKey,
      },
      select: {
        gameId: true,
        earned: true,
      },
    }),
  ]);

  const previouslyCappedGames = Array.from(
    new Set(
      previousRows
        .filter((row) => toFiniteNumber(row.earned, 0) > 0)
        .map((row) => row.gameId)
        .filter((gameId): gameId is string => Boolean(gameId))
    )
  );

  const todayPlayedGames = new Set(
    todayRows
      .filter((row) => toFiniteNumber(row.earned, 0) > 0)
      .map((row) => row.gameId)
      .filter((gameId): gameId is string => Boolean(gameId))
  );

  const resetGames = previouslyCappedGames.filter((gameId) => !todayPlayedGames.has(gameId));

  return {
    todayDateKey,
    previousDateKey,
    resetGames,
    previouslyCappedGames,
    eligible: resetGames.length > 0,
  };
}

type DayEntry = {
  dateKey: string;
  opened: boolean;
  isToday: boolean;
  isFuture: boolean;
  dayLabel: string;
  dayNumber: number;
};

type DailyCrateMeta = {
  streak?: number;
  lastOpenedDay?: string | null;
  lastOpenedAt?: number;
  lastReminderDay?: string | null;
  lastReminderAt?: number;
  history?: string[];
};

type GameDailyMeta = {
  dateKey?: string;
  totals?: Record<string, number>;
};

type EconomySystemMeta = {
  dailyCrate?: DailyCrateMeta;
  gameDailyEarnings?: GameDailyMeta;
};

type EconomyInteractionStats = {
  modals?: UnknownRecord;
  buttons?: UnknownRecord;
  commands?: UnknownRecord;
  selectMenus?: UnknownRecord;
  economy?: EconomySystemMeta;
  [key: string]: unknown;
};

type DailyCrateStatus = {
  streak: number;
  rewardMultiplier: number;
  history: string[];
  lastOpenedDay: string | null;
  lastOpenedAt: number | null;
  lastReminderDay: string | null;
  lastReminderAt: number | null;
  currentWeek: DayEntry[];
  available: boolean;
  cooldownRemainingMs: number;
  nextAvailableAt: number | null;
  reminderEligible: boolean;
};

type DailyCrateUpdate = {
  interactionStats: EconomyInteractionStats;
  status: DailyCrateStatus;
};

type GameDailyStatus = {
  gameId: string;
  dateKey: string;
  earnedToday: number;
  remainingToday: number;
  baseCap: number;
  cap: number;
  upgradeLevel: number;
  multiplier: number;
};

type GameDailyResetStatus = {
  todayDateKey: string;
  previousDateKey: string;
  resetGames: string[];
  previouslyCappedGames: string[];
  eligible: boolean;
};

type GameAwardResult = GameDailyStatus & {
  requestedAmount: number;
  awardedAmount: number;
  blockedAmount: number;
  interactionStats: EconomyInteractionStats;
};

const DAILY_STREAK_BONUS_PER_DAY = 0.05;
const DAILY_STREAK_MAX_BONUS = 0.5;
const DAILY_HISTORY_LIMIT = 21;
const DAILY_REMINDER_INTERVAL_MS = 18 * 60 * 60 * 1000;
const GAME_DAILY_CAPS: Record<string, number> = {
  "2048": 180,
  snake: 160,
  tower: 250,
  coinflip: 300,
  rpg_clicker2: 140,
};

function getDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addUtcDays(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + offset);
  return getDateKey(date.getTime());
}

function getWeekEntries(referenceTimestamp = Date.now(), history: string[] = []): DayEntry[] {
  const today = new Date(referenceTimestamp);
  const currentDay = today.getUTCDay();
  const startOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const todayKey = getDateKey(referenceTimestamp);
  const openedSet = new Set(history);
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + startOffset + index));
    const dateKey = getDateKey(date.getTime());
    return {
      dateKey,
      opened: openedSet.has(dateKey),
      isToday: dateKey === todayKey,
      isFuture: date.getTime() > referenceTimestamp,
      dayLabel: labels[index] || "Day",
      dayNumber: date.getUTCDate(),
    };
  });
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseInteractionStats(value: unknown): EconomyInteractionStats {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as EconomyInteractionStats;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as EconomyInteractionStats;
      }
    } catch {}
  }

  return {
    modals: {},
    buttons: {},
    commands: {},
    selectMenus: {},
    economy: {},
  };
}

function getEconomyMeta(stats: StatisticsRecord | null | undefined): EconomyInteractionStats {
  const interactionStats = parseInteractionStats(stats?.interactionStats);
  if (!interactionStats.economy || typeof interactionStats.economy !== "object") {
    interactionStats.economy = {};
  }
  return interactionStats;
}

function normalizeHistory(history: unknown): string[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((entry) => (typeof entry === "string" ? entry : null))
    .filter((entry): entry is string => Boolean(entry))
    .slice(-DAILY_HISTORY_LIMIT);
}

function buildDailyCrateStatus(
  stats: StatisticsRecord | null | undefined,
  cooldownRemainingMs: number,
  referenceTimestamp = Date.now()
): DailyCrateStatus {
  const interactionStats = getEconomyMeta(stats);
  const dailyCrate = interactionStats.economy?.dailyCrate || {};
  const history = normalizeHistory(dailyCrate.history);
  const streak = Math.max(0, Math.floor(toFiniteNumber(dailyCrate.streak, 0)));
  const available = cooldownRemainingMs <= 0;
  const nextAvailableAt = available ? null : referenceTimestamp + cooldownRemainingMs;
  const rewardMultiplier = Number(
    (1 + Math.min(Math.max(0, streak - 1) * DAILY_STREAK_BONUS_PER_DAY, DAILY_STREAK_MAX_BONUS)).toFixed(2)
  );
  const lastReminderAt = dailyCrate.lastReminderAt ? toFiniteNumber(dailyCrate.lastReminderAt, 0) : null;
  const lastReminderDay = typeof dailyCrate.lastReminderDay === "string" ? dailyCrate.lastReminderDay : null;
  const currentDayKey = getDateKey(referenceTimestamp);

  return {
    streak,
    rewardMultiplier,
    history,
    lastOpenedDay: typeof dailyCrate.lastOpenedDay === "string" ? dailyCrate.lastOpenedDay : null,
    lastOpenedAt: dailyCrate.lastOpenedAt ? toFiniteNumber(dailyCrate.lastOpenedAt, 0) : null,
    lastReminderDay,
    lastReminderAt,
    currentWeek: getWeekEntries(referenceTimestamp, history),
    available,
    cooldownRemainingMs: Math.max(0, cooldownRemainingMs),
    nextAvailableAt,
    reminderEligible:
      available &&
      lastReminderDay !== currentDayKey &&
      (!lastReminderAt || referenceTimestamp - lastReminderAt >= DAILY_REMINDER_INTERVAL_MS),
  };
}

function registerDailyCrateOpen(
  stats: StatisticsRecord | null | undefined,
  cooldownRemainingMs: number,
  referenceTimestamp = Date.now()
): DailyCrateUpdate {
  const interactionStats = getEconomyMeta(stats);
  const dailyCrate = interactionStats.economy?.dailyCrate || {};
  const todayKey = getDateKey(referenceTimestamp);
  const yesterdayKey = addUtcDays(todayKey, -1);
  const previousDay = typeof dailyCrate.lastOpenedDay === "string" ? dailyCrate.lastOpenedDay : null;
  const currentStreak = Math.max(0, Math.floor(toFiniteNumber(dailyCrate.streak, 0)));

  let streak = 1;
  if (previousDay === todayKey) {
    streak = Math.max(1, currentStreak);
  } else if (previousDay === yesterdayKey) {
    streak = Math.max(1, currentStreak + 1);
  }

  const history = Array.from(new Set([...normalizeHistory(dailyCrate.history), todayKey])).slice(
    -DAILY_HISTORY_LIMIT
  );

  interactionStats.economy = {
    ...(interactionStats.economy || {}),
    dailyCrate: {
      streak,
      history,
      lastOpenedDay: todayKey,
      lastOpenedAt: referenceTimestamp,
      lastReminderDay: null,
      lastReminderAt: 0,
    },
  };

  return {
    interactionStats,
    status: buildDailyCrateStatus(
      { interactionStats },
      cooldownRemainingMs,
      referenceTimestamp
    ),
  };
}

function markDailyCrateReminderSent(
  stats: StatisticsRecord | null | undefined,
  referenceTimestamp = Date.now()
): EconomyInteractionStats {
  const interactionStats = getEconomyMeta(stats);
  const dailyCrate = interactionStats.economy?.dailyCrate || {};
  interactionStats.economy = {
    ...(interactionStats.economy || {}),
    dailyCrate: {
      ...dailyCrate,
      lastReminderDay: getDateKey(referenceTimestamp),
      lastReminderAt: referenceTimestamp,
    },
  };
  return interactionStats;
}

function getUpgradeLevel(upgrades: UpgradeRecord[] | null | undefined, type: string): number {
  if (!Array.isArray(upgrades)) {
    return 1;
  }

  return Math.max(1, Math.floor(toFiniteNumber(upgrades.find((entry) => entry?.type === type)?.level, 1)));
}

function getGameDailyStatus(
  stats: StatisticsRecord | null | undefined,
  upgrades: UpgradeRecord[] | null | undefined,
  gameId: string,
  referenceTimestamp = Date.now()
): GameDailyStatus {
  const interactionStats = getEconomyMeta(stats);
  const stored = interactionStats.economy?.gameDailyEarnings || {};
  const dateKey = getDateKey(referenceTimestamp);
  const normalizedTotals =
    stored.dateKey === dateKey && stored.totals && typeof stored.totals === "object"
      ? Object.fromEntries(
          Object.entries(stored.totals).map(([key, value]) => [key, Math.max(0, toFiniteNumber(value, 0))])
        )
      : {};
  const baseCap = GAME_DAILY_CAPS[gameId] || 150;
  const upgradeLevel = getUpgradeLevel(upgrades, "games_earning");
  const multiplier =
    1 + Math.max(0, upgradeLevel - 1) * Number(UPGRADES.games_earning.effectMultiplier || 0);
  const cap = Math.max(baseCap, Math.floor(baseCap * multiplier));
  const earnedToday = Math.max(0, toFiniteNumber(normalizedTotals[gameId], 0));
  const remainingToday = Math.max(0, cap - earnedToday);

  return {
    gameId,
    dateKey,
    earnedToday,
    remainingToday,
    baseCap,
    cap,
    upgradeLevel,
    multiplier: Number(multiplier.toFixed(2)),
  };
}

function awardGameDailyEarnings(
  stats: StatisticsRecord | null | undefined,
  upgrades: UpgradeRecord[] | null | undefined,
  gameId: string,
  requestedAmount: number,
  referenceTimestamp = Date.now()
): GameAwardResult {
  const interactionStats = getEconomyMeta(stats);
  const status = getGameDailyStatus(stats, upgrades, gameId, referenceTimestamp);
  const safeRequested = Math.max(0, toFiniteNumber(requestedAmount, 0));
  const awardedAmount = Math.max(0, Math.min(status.remainingToday, safeRequested));
  const blockedAmount = Math.max(0, safeRequested - awardedAmount);
  const stored = interactionStats.economy?.gameDailyEarnings || {};
  const totals =
    stored.dateKey === status.dateKey && stored.totals && typeof stored.totals === "object"
      ? { ...stored.totals }
      : {};

  totals[gameId] = Math.max(0, toFiniteNumber(totals[gameId], 0) + awardedAmount);

  interactionStats.economy = {
    ...(interactionStats.economy || {}),
    gameDailyEarnings: {
      dateKey: status.dateKey,
      totals,
    },
  };

  const updatedStatus = getGameDailyStatus({ interactionStats }, upgrades, gameId, referenceTimestamp);

  return {
    ...updatedStatus,
    requestedAmount: safeRequested,
    awardedAmount,
    blockedAmount,
    interactionStats,
  };
}

export {
  DAILY_REMINDER_INTERVAL_MS,
  GAME_DAILY_CAPS,
  getDateKey,
  getEconomyMeta,
  buildDailyCrateStatus,
  registerDailyCrateOpen,
  markDailyCrateReminderSent,
  getGameDailyStatus,
  awardGameDailyEarnings,
  getGameDailyStatusFromDb,
  getGameDailyResetStatusFromDb,
  awardGameDailyEarningsAtomic,
};
