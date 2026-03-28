import { CRATE_TYPES, UPGRADES } from "../../../../shared/src/domain.ts";
import type {
  ActivityBalanceSnapshot,
  ActivityCasesState,
  ActivityGameCard,
  ActivityLauncherHints,
  ActivityLauncherPayload,
  ActivityLevelProgress,
  ActivityLevelProgression,
  ActivityLevelProgressEntry,
  ActivityMarriageStatus,
  ActivityPalette,
  ActivityProgressionRole,
  ActivitySupportedLocale,
  ActivityUpgradeCard,
  ActivityUpgradesState,
  LevelCalculation,
} from "../../../../shared/src/contracts/hub.ts";

import { ACTIVITY_GAME_CATALOG } from "../../lib/gameCatalog.ts";
import {
  buildActivityStrings,
  getActivityLocaleValue,
  getUpgradeCategoryTitle,
  normalizeActivityLocale,
} from "../../lib/activityI18n.ts";
import {
  asArray,
  asObject,
  clamp,
  formatCompactNumber,
  formatDurationCompact,
  getAvatarUrl,
  getUpgradeLevel,
  interpolateTemplate,
  normalizeGameId,
  toBoolean,
  toNumber,
  roundMoney,
} from "../lib/primitives.ts";
import { ensureGuildUser, fetchDatabase } from "./databaseGateway.ts";
import { fetchDiscordGuildRoleMap } from "./discordRolesService.ts";
import { DEFAULT_ACTIVITY_PALETTE, fetchRenderingPalette } from "./paletteService.ts";
import type { ActivityAuthUser, ActivityUserRecord, JsonResult } from "../types/activityServer.ts";

const UPGRADE_CATEGORY_ORDER = [
  "economy",
  "activity",
  "cooldowns",
  "defense",
  "banking",
] as const;

const UPGRADE_IMPACT_KEYS: Record<string, string> = {
  daily_bonus: "impact_daily_rewards",
  games_earning: "impact_game_payouts",
  crime_mastery: "impact_crime_mastery",
  time_wizard: "impact_daily_weekly",
  vault_guard: "impact_defense",
  bank_vault: "impact_bank_max_time",
};

const CRIME_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const LEVEL_ROLE_MODES = new Set([
  "text",
  "voice",
  "gaming",
  "combined_activity",
  "combined_all",
]);

function toSerializedNumber(value: unknown, fallback = 0): number {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (
      (record.type === "BigInt" || record.type === "Decimal") &&
      Object.prototype.hasOwnProperty.call(record, "value")
    ) {
      return toNumber(record.value, fallback);
    }
  }

  return toNumber(value, fallback);
}

function buildEmptyBalanceSnapshot(): ActivityBalanceSnapshot {
  return {
    walletBalance: 0,
    bankBalance: 0,
    bankDistributed: 0,
    totalBankBalance: 0,
    projectedBankBalance: 0,
    projectedTotalBankBalance: 0,
    annualRate: 0,
    annualRatePercent: 0,
    cycleStartTime: 0,
    maxInactiveMs: 0,
    timeIntoCycleMs: 0,
    cycleProgress: 0,
    cycleComplete: false,
    upgradeDiscount: 0,
    updatedAt: Date.now(),
  };
}

function getUpgradePrice(type: string, level: number): number {
  const config = UPGRADES[type as keyof typeof UPGRADES];
  if (!config) {
    return 0;
  }

  return Math.floor(config.basePrice * Math.pow(config.priceMultiplier, Math.max(0, level - 1)));
}

function getUpgradeEffectUnit(type: string): "percent" | "minutes" | "hours" {
  if (type === "crime_mastery") {
    return "minutes";
  }
  if (type === "bank_vault") {
    return "hours";
  }
  return "percent";
}

function getUpgradeEffectValue(type: string, level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  const config = UPGRADES[type as keyof typeof UPGRADES];
  const configRecord = config as {
    effectMultiplier?: number;
    effectValue?: number;
  };
  if (!config) {
    return 0;
  }

  if (type === "bank_vault") {
    return (Math.max(0, safeLevel - 1) * Number(configRecord.effectValue || 0)) / 3600000;
  }

  if (type === "crime_mastery") {
    return (Math.max(0, safeLevel - 1) * Number(configRecord.effectValue || 0)) / 60000;
  }

  if (typeof configRecord.effectMultiplier === "number") {
    return Math.max(0, safeLevel - 1) * Number(configRecord.effectMultiplier) * 100;
  }

  if (typeof configRecord.effectValue === "number") {
    return Math.max(0, safeLevel - 1) * Number(configRecord.effectValue);
  }

  return Math.max(0, safeLevel - 1);
}

function formatUpgradeEffectLabel(
  locale: ActivitySupportedLocale,
  strings: ReturnType<typeof buildActivityStrings>,
  type: string,
  effectValue: number
): string {
  const unit = getUpgradeEffectUnit(type);
  const unitLabel =
    unit === "minutes"
      ? strings.common.unitMinuteShort
      : unit === "hours"
      ? strings.common.unitHourShort
      : "%";
  const formatted = effectValue.toLocaleString(
    locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US",
    {
      maximumFractionDigits: effectValue >= 10 ? 0 : 2,
      minimumFractionDigits: 0,
    }
  );

  return unit === "percent" ? `${formatted}%` : `${formatted} ${unitLabel}`;
}

function getFallbackImpactLabel(
  type: string,
  strings: ReturnType<typeof buildActivityStrings>
): string {
  switch (type) {
    case "daily_bonus":
      return strings.upgrades.impactDailyRewards;
    case "games_earning":
      return strings.upgrades.impactGamePayouts;
    case "crime_mastery":
      return strings.upgrades.impactCrimeMastery;
    case "time_wizard":
      return strings.upgrades.impactDailyWeekly;
    case "vault_guard":
      return strings.upgrades.impactDefense;
    case "bank_vault":
      return strings.upgrades.impactBankMaxTime;
    default:
      return strings.nav.upgrades;
  }
}

function buildBalanceSnapshot(
  user: ActivityUserRecord,
  bankProjection: unknown
): ActivityBalanceSnapshot {
  const economy = asObject(user.economy);
  const projection = asObject(bankProjection);
  const walletBalance = toNumber(economy.balance, 0);
  const bankBalance = toNumber(economy.bankBalance, 0);
  const bankDistributed = toNumber(economy.bankDistributed, 0);
  const totalBankBalance = bankBalance + bankDistributed;
  const projectedBankBalance = Math.max(bankBalance, toNumber(projection.balance, bankBalance));
  const annualRate = toNumber(projection.annualRate, 0);
  const maxInactiveMs = Math.max(0, toNumber(projection.maxInactiveMs, 0));
  const timeIntoCycleMs = Math.max(0, toNumber(projection.timeIntoCycle, 0));

  return {
    walletBalance,
    bankBalance,
    bankDistributed,
    totalBankBalance,
    projectedBankBalance,
    projectedTotalBankBalance: projectedBankBalance + bankDistributed,
    annualRate,
    annualRatePercent: annualRate * 100,
    cycleStartTime: toNumber(economy.bankStartTime, 0),
    maxInactiveMs,
    timeIntoCycleMs,
    cycleProgress: maxInactiveMs > 0 ? clamp(0, timeIntoCycleMs / maxInactiveMs, 1) : 0,
    cycleComplete: toBoolean(projection.cycleComplete),
    upgradeDiscount: clamp(0, toNumber(economy.upgradeDiscount, 0), 95),
    updatedAt: Date.now(),
  };
}

function buildCasesState(
  locale: ActivitySupportedLocale,
  strings: ReturnType<typeof buildActivityStrings>,
  crates: Array<Record<string, unknown>>,
  dailyStatusInput: unknown,
  weeklyCooldownValue: unknown
): ActivityCasesState {
  const dailyStatus = asObject(dailyStatusInput);
  const counts = crates.reduce<Record<string, number>>((acc, crate) => {
    const type = String(crate.type || "").trim().toLowerCase();
    if (!type) {
      return acc;
    }

    acc[type] = Math.max(0, toNumber(crate.count, 0));
    return acc;
  }, {});

  const dailyCount = counts.daily || 0;
  const weeklyCount = counts.weekly || 0;
  const dailyCooldownRemainingMs = Math.max(0, toNumber(dailyStatus.cooldownRemainingMs, 0));
  const weeklyCooldownRemainingMs = Math.max(0, toNumber(weeklyCooldownValue, 0));
  const dailyAvailable = dailyCount > 0 && toBoolean(dailyStatus.available);
  const weeklyAvailable = weeklyCount > 0 && weeklyCooldownRemainingMs <= 0;
  const now = Date.now();
  const durationLabels = {
    day: strings.common.unitDayShort,
    hour: strings.common.unitHourShort,
    minute: strings.common.unitMinuteShort,
  };

  return {
    totalCount: dailyCount + weeklyCount,
    availableCount: Number(dailyAvailable) + Number(weeklyAvailable),
    dailyStatus: Object.keys(dailyStatus).length > 0 ? dailyStatus : null,
    cards: [
      {
        type: "daily",
        name: strings.cases.dailyName,
        description: strings.cases.dailyDescription,
        emoji: CRATE_TYPES.daily.emoji,
        count: dailyCount,
        available: dailyAvailable,
        cooldownRemainingMs: dailyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.daily.cooldown,
        nextAvailableAt: dailyCooldownRemainingMs > 0 ? now + dailyCooldownRemainingMs : null,
        statusLabel: dailyAvailable
          ? strings.cases.readyNow
          : formatDurationCompact(dailyCooldownRemainingMs, locale, durationLabels),
        rewardPreview: {
          minCoins: CRATE_TYPES.daily.rewards.min_coins,
          maxCoins: CRATE_TYPES.daily.rewards.max_coins,
          seasonXpAmount: CRATE_TYPES.daily.rewards.seasonXp_amount,
          discountAmount: CRATE_TYPES.daily.rewards.discount_amount,
        },
        dailyStatus: Object.keys(dailyStatus).length > 0 ? dailyStatus : null,
      },
      {
        type: "weekly",
        name: strings.cases.weeklyName,
        description: strings.cases.weeklyDescription,
        emoji: CRATE_TYPES.weekly.emoji,
        count: weeklyCount,
        available: weeklyAvailable,
        cooldownRemainingMs: weeklyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.weekly.cooldown,
        nextAvailableAt: weeklyCooldownRemainingMs > 0 ? now + weeklyCooldownRemainingMs : null,
        statusLabel: weeklyAvailable
          ? strings.cases.readyNow
          : formatDurationCompact(weeklyCooldownRemainingMs, locale, durationLabels),
        rewardPreview: {
          minCoins: CRATE_TYPES.weekly.rewards.min_coins,
          maxCoins: CRATE_TYPES.weekly.rewards.max_coins,
          seasonXpAmount: CRATE_TYPES.weekly.rewards.seasonXp_amount,
          discountAmount: CRATE_TYPES.weekly.rewards.discount_amount,
        },
        dailyStatus: null,
      },
    ],
  };
}

function buildUpgradesState(
  locale: ActivitySupportedLocale,
  strings: ReturnType<typeof buildActivityStrings>,
  upgrades: Array<Record<string, unknown>>,
  walletBalance: number,
  discountPercent: number
): ActivityUpgradesState {
  const allCards: ActivityUpgradeCard[] = Object.entries(UPGRADES).map(([type, config]) => {
    const currentLevel = getUpgradeLevel(upgrades, type);
    const nextLevel = currentLevel + 1;
    const currentEffect = getUpgradeEffectValue(type, currentLevel);
    const nextEffect = getUpgradeEffectValue(type, nextLevel);
    const deltaEffect = Math.max(0, nextEffect - currentEffect);
    const originalPrice = getUpgradePrice(type, currentLevel);
    const discountedPrice =
      discountPercent > 0
        ? Math.max(1, Math.floor(originalPrice * (1 - discountPercent / 100)))
        : originalPrice;
    const name = getActivityLocaleValue(
      locale,
      `commands.economy.shop.upgrades.${type}.name`,
      type
    );
    const descriptionTemplate = getActivityLocaleValue(
      locale,
      `commands.economy.shop.upgrades.${type}.description`,
      name
    );
    const impactLabel = getActivityLocaleValue(
      locale,
      `commands.economy.shop.${UPGRADE_IMPACT_KEYS[type] || ""}`,
      getFallbackImpactLabel(type, strings)
    );

    return {
      type,
      category: config.category,
      emoji: config.emoji,
      name,
      description: interpolateTemplate(descriptionTemplate, {
        effect: formatCompactNumber(currentEffect, locale),
        increasePerLevel: formatCompactNumber(deltaEffect, locale),
        increasePerLevelMinutes: formatCompactNumber(deltaEffect, locale),
      }),
      impactLabel,
      currentLevel,
      nextLevel,
      currentEffect,
      nextEffect,
      deltaEffect,
      effectUnit: getUpgradeEffectUnit(type),
      currentEffectLabel: formatUpgradeEffectLabel(locale, strings, type, currentEffect),
      nextEffectLabel: formatUpgradeEffectLabel(locale, strings, type, nextEffect),
      deltaEffectLabel: formatUpgradeEffectLabel(locale, strings, type, deltaEffect),
      price: discountedPrice,
      originalPrice,
      discountPercent,
      isAffordable: walletBalance >= discountedPrice,
      coinsNeeded: Math.max(0, discountedPrice - walletBalance),
    };
  });

  return {
    totalCount: allCards.length,
    discountPercent,
    groups: UPGRADE_CATEGORY_ORDER.map((category) => {
      const items = allCards.filter((card) => card.category === category);
      return {
        key: category,
        title: getUpgradeCategoryTitle(locale, strings, category),
        items,
      };
    }).filter((group) => group.items.length > 0),
  };
}

function buildGamesState(
  readOnly: boolean,
  recordsInput: unknown,
  dailyStatusResults: JsonResult[]
): {
  items: ActivityGameCard[];
  playableGameId: string;
} {
  const records = asObject(recordsInput);

  return {
    items: ACTIVITY_GAME_CATALOG.map((game, index) => ({
      id: game.id,
      title: game.title,
      emoji: game.emoji,
      status: game.status,
      playable: !readOnly && game.id === "2048" && game.status === "playable",
      highScore: toNumber(asObject(records[game.id]).highScore, 0),
      dailyStatus: dailyStatusResults[index]?.ok ? asObject(dailyStatusResults[index]?.data) : null,
    })),
    playableGameId: "2048",
  };
}

function buildMarriageStatus(statusInput: unknown): ActivityMarriageStatus | null {
  const statusRecord = asObject(statusInput);
  const status = String(statusRecord.status || "").trim().toUpperCase();
  if (!status) {
    return null;
  }

  const partnerId =
    typeof statusRecord.partnerId === "string" && statusRecord.partnerId.length > 0
      ? statusRecord.partnerId
      : undefined;
  const createdAt =
    typeof statusRecord.createdAt === "number" || typeof statusRecord.createdAt === "string"
      ? statusRecord.createdAt
      : null;

  return {
    status,
    partnerId,
    createdAt,
  };
}

function toLevelCalculation(input: unknown): LevelCalculation | null {
  const record = asObject(input);
  if (!record || typeof record !== "object") {
    return null;
  }

  const level = toNumber(record.level, 0);
  const currentXP = toNumber(record.currentXP, 0);
  const requiredXP = Math.max(1, toNumber(record.requiredXP, 1));
  const totalXP = toNumber(record.totalXP, 0);

  if (!Number.isFinite(level) || level <= 0) {
    return null;
  }

  return {
    level,
    currentXP,
    requiredXP,
    totalXP,
  };
}

function computeRank(
  usersInput: unknown,
  userId: string,
  extractor: (user: Record<string, unknown>) => number
): number | null {
  const users = asArray(usersInput);
  if (!users.length) {
    return null;
  }

  const ranked = users
    .map((entry) => asObject(entry))
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id:
        typeof entry.id === "string"
          ? entry.id
          : typeof entry.userId === "string"
          ? entry.userId
          : "",
      score: extractor(entry),
    }))
    .filter((entry) => entry.id.length > 0)
    .sort((a, b) => b.score - a.score);

  const rankIndex = ranked.findIndex((entry) => entry.id === userId);
  return rankIndex >= 0 ? rankIndex + 1 : null;
}

function buildLevelProgress(
  levelsInput: unknown,
  usersInput: unknown,
  userId: string
): ActivityLevelProgress | null {
  const levels = asObject(levelsInput);
  const chat = toLevelCalculation(levels.text);
  const voice = toLevelCalculation(levels.voice);
  const game = toLevelCalculation(levels.gaming);

  if (!chat && !voice && !game) {
    return null;
  }

  const chatRank = computeRank(usersInput, userId, (user) => {
    const level = asObject(user.Level);
    return toNumber(level.xp, 0);
  });
  const voiceRank = computeRank(usersInput, userId, (user) => {
    const level = asObject(user.Level);
    return toNumber(level.voiceXp, 0);
  });
  const gameRank = computeRank(usersInput, userId, (user) => {
    const level = asObject(user.Level);
    return toNumber(level.gameXp, 0);
  });

  const withRank = (
    level: LevelCalculation | null,
    rank: number | null
  ): ActivityLevelProgressEntry | null =>
    level
      ? {
          ...level,
          rank,
        }
      : null;

  return {
    chat: withRank(chat, chatRank),
    voice: withRank(voice, voiceRank),
    game: withRank(game, gameRank),
  };
}

function normalizeRoleMode(input: unknown): string {
  const raw = String(input || "").trim().toLowerCase();
  if (LEVEL_ROLE_MODES.has(raw)) {
    return raw;
  }
  return "text";
}

function roleColorFromId(roleId: string): string {
  let hash = 0;
  for (let index = 0; index < roleId.length; index += 1) {
    hash = (hash * 31 + roleId.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 72%, 62%, 0.95)`;
}

function buildUpcomingRoles(
  levelRolesInput: unknown,
  levelProgress: ActivityLevelProgress | null,
  discordRoleMap: Record<string, { name: string; color?: string }>
): ActivityProgressionRole[] {
  type UpcomingRoleCandidate = {
    roleId: string;
    roleName: string | undefined;
    mode: string;
    requiredLevel: number;
    color: string;
    delta: number;
  };
  const chatLevel = Math.max(1, toNumber(levelProgress?.chat?.level, 1));
  const voiceLevel = Math.max(1, toNumber(levelProgress?.voice?.level, 1));
  const gameLevel = Math.max(1, toNumber(levelProgress?.game?.level, 1));
  const levelByMode: Record<string, number> = {
    text: chatLevel,
    voice: voiceLevel,
    gaming: gameLevel,
    combined_activity: chatLevel + voiceLevel,
    combined_all: chatLevel + voiceLevel + gameLevel,
  };

  const candidates: UpcomingRoleCandidate[] = [];
  for (const rawEntry of asArray(levelRolesInput)) {
    const entry = asObject(rawEntry);
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const roleId = String(entry.roleId || "").trim();
    const mode = normalizeRoleMode(entry.mode);
    const requiredLevel = Math.max(0, toNumber(entry.requiredLevel, 0));
    const currentLevel = Math.max(1, toNumber(levelByMode[mode], chatLevel));

    if (!roleId || requiredLevel <= 0 || requiredLevel <= currentLevel) {
      continue;
    }

    candidates.push({
      roleId,
      roleName: discordRoleMap[roleId]?.name,
      mode,
      requiredLevel,
      color: discordRoleMap[roleId]?.color || roleColorFromId(roleId),
      delta: requiredLevel - currentLevel,
    });
  }

  const upcoming = candidates
    .sort(
      (left, right) =>
        left.delta - right.delta ||
        left.requiredLevel - right.requiredLevel ||
        left.roleId.localeCompare(right.roleId)
    )
    .slice(0, 4)
    .map(({ roleId, roleName, mode, requiredLevel, color }) => ({
      roleId,
      roleName,
      mode,
      requiredLevel,
      color,
    }));

  return upcoming;
}

function buildLevelProgression(
  levelsInput: unknown,
  levelProgress: ActivityLevelProgress | null,
  seasonInput: unknown,
  levelRolesInput: unknown,
  discordRoleMap: Record<string, { name: string; color?: string }>
): ActivityLevelProgression | null {
  const levels = asObject(levelsInput);
  const chat = levelProgress?.chat || toLevelCalculation(levels.text);
  const voice = levelProgress?.voice || toLevelCalculation(levels.voice);
  const game = levelProgress?.game || toLevelCalculation(levels.gaming);
  const season = toLevelCalculation(levels.season);
  const seasonRecord = asObject(seasonInput);
  const seasonNumber = toSerializedNumber(seasonRecord.seasonNumber, 0);
  const seasonEnds = toSerializedNumber(seasonRecord.seasonEnds, 0);
  const upcomingRoles = buildUpcomingRoles(levelRolesInput, {
    chat: chat || null,
    voice: voice || null,
    game: game || null,
  }, discordRoleMap);

  const hasAnyData =
    Boolean(chat) ||
    Boolean(voice) ||
    Boolean(game) ||
    Boolean(season) ||
    seasonNumber > 0 ||
    seasonEnds > 0 ||
    upcomingRoles.length > 0;

  if (!hasAnyData) {
    return null;
  }

  return {
    chat: chat || null,
    voice: voice || null,
    game: game || null,
    season: season || null,
    seasonXp: Math.max(0, toNumber(season?.totalXP, 0)),
    seasonNumber: seasonNumber > 0 ? seasonNumber : null,
    seasonEnds: seasonEnds > 0 ? seasonEnds : null,
    upcomingRoles,
  };
}

function buildLauncherHints(
  cases: ActivityCasesState,
  upgrades: ActivityUpgradesState,
  games: { items: ActivityGameCard[] },
  crimeCooldownInput: unknown
): ActivityLauncherHints {
  const dailyCard = cases.cards.find((card) => card.type === "daily");
  const weeklyCard = cases.cards.find((card) => card.type === "weekly");
  const dailyRemainingMs = Math.max(0, toNumber(dailyCard?.cooldownRemainingMs, 0));
  const weeklyRemainingMs = Math.max(0, toNumber(weeklyCard?.cooldownRemainingMs, 0));
  const positiveCooldowns = [dailyRemainingMs, weeklyRemainingMs].filter((ms) => ms > 0);
  const closestRemainingMs =
    positiveCooldowns.length > 0 ? Math.min(...positiveCooldowns) : 0;
  const upgradesAffordable = upgrades.groups.reduce((count, group) => {
    return count + group.items.filter((item) => item.isAffordable).length;
  }, 0);
  const workStats = games.items.reduce(
    (acc, game) => {
      const status = asObject(game.dailyStatus);
      const cap = Math.max(0, toNumber(status.cap, 0));
      const earned = Math.max(0, toNumber(status.earnedToday, 0));
      acc.totalCap += cap;
      acc.earnedToday += earned;
      return acc;
    },
    { totalCap: 0, earnedToday: 0 }
  );
  const workRemaining = Math.max(0, workStats.totalCap - workStats.earnedToday);
  const workProgress =
    workStats.totalCap > 0 ? clamp(0, workStats.earnedToday / workStats.totalCap, 1) : 0;

  const crimeRemainingMs = Math.max(0, toNumber(asObject(crimeCooldownInput).cooldown, 0));

  return {
    dailyAvailable: cases.availableCount,
    casesCooldowns: {
      dailyRemainingMs,
      dailyCooldownMs: Math.max(1, toNumber(dailyCard?.cooldownDurationMs, 24 * 60 * 60 * 1000)),
      weeklyRemainingMs,
      weeklyCooldownMs: Math.max(1, toNumber(weeklyCard?.cooldownDurationMs, 7 * 24 * 60 * 60 * 1000)),
      closestRemainingMs,
    },
    upgradesAffordable,
    workAvailable: workRemaining > 0,
    workEarnings: {
      totalCap: workStats.totalCap,
      earnedToday: workStats.earnedToday,
      remaining: workRemaining,
      progress: workProgress,
    },
    crimeAvailable: crimeRemainingMs <= 0,
    crimeRemainingMs,
    crimeCooldownMs: CRIME_COOLDOWN_MS,
  };
}

export async function buildReadOnlyLauncherPayload(
  guildId: string,
  authUser: ActivityAuthUser | undefined,
  unsupportedReason: string
): Promise<ActivityLauncherPayload> {
  const locale = normalizeActivityLocale(authUser?.locale);
  const avatarUrl = getAvatarUrl(authUser?.id, authUser?.avatar || null);
  const strings = buildActivityStrings(locale);

  return {
    locale,
    strings,
    palette: await fetchRenderingPalette(avatarUrl),
    user: {
      id: authUser?.id || "guest",
      username: authUser?.username || "Guest",
      displayName: authUser?.global_name || authUser?.username || authUser?.id || "Guest",
      avatar: authUser?.avatar || null,
      avatarUrl,
      locale,
    },
    guild: guildId ? { id: guildId, name: `Guild ${guildId}` } : null,
    marriage: null,
    levelProgress: null,
    progression: null,
    hints: null,
    readOnly: true,
    unsupportedReason,
    balance: buildEmptyBalanceSnapshot(),
    cases: buildCasesState(locale, strings, [], null, 0),
    upgrades: buildUpgradesState(locale, strings, [], 0, 0),
    games: buildGamesState(
      true,
      {},
      ACTIVITY_GAME_CATALOG.map(() => ({
        ok: true,
        status: 200,
        data: null,
      }))
    ),
    refreshedAt: Date.now(),
  };
}

export async function buildActivityLauncherPayload(
  guildId: string,
  authUser: ActivityAuthUser
): Promise<ActivityLauncherPayload> {
  await ensureGuildUser(guildId, authUser.id);

  const [
    userResult,
    guildResult,
    recordsResult,
    dailyCaseStatusResult,
    weeklyCooldownResult,
    marriageStatusResult,
    levelsResult,
    guildUsersResult,
    seasonResult,
    levelRolesResult,
    discordRoleMap,
    crimeCooldownResult,
    ...dailyStatusResults
  ] = await Promise.all([
    fetchDatabase(`/users/${guildId}/${authUser.id}`),
    fetchDatabase(`/guilds/${guildId}`),
    fetchDatabase(`/games/records/${guildId}/${authUser.id}`),
    fetchDatabase(`/crates/status/${guildId}/${authUser.id}/daily`),
    fetchDatabase(`/cooldowns/crate/${guildId}/${authUser.id}/weekly`),
    fetchDatabase(`/marriage/status/${authUser.id}?guildId=${guildId}`),
    fetchDatabase(`/xp/levels/${guildId}/${authUser.id}`),
    fetchDatabase(`/guilds/${guildId}/users`),
    fetchDatabase(`/seasons/current`),
    fetchDatabase(`/levels/roles/${guildId}`),
    fetchDiscordGuildRoleMap(guildId),
    fetchDatabase(`/cooldowns/${guildId}/${authUser.id}/crime`),
    ...ACTIVITY_GAME_CATALOG.map((game) =>
      fetchDatabase(`/games/earnings/${guildId}/${authUser.id}/${normalizeGameId(game.id)}`)
    ),
  ]);

  if (!userResult.ok) {
    throw new Error(`Failed to load user activity data: ${userResult.status}`);
  }

  const user = asObject(userResult.data) as ActivityUserRecord;
  const locale = normalizeActivityLocale(user.locale || authUser.locale);
  const strings = buildActivityStrings(locale);
  const avatarUrl = getAvatarUrl(authUser.id, authUser.avatar || null);

  const [palette, bankProjectionResult] = await Promise.all([
    fetchRenderingPalette(avatarUrl),
    fetchDatabase("/economy/bank/calculate", {
      method: "POST",
      body: JSON.stringify({ user: userResult.data }),
    }),
  ]);

  const balance = buildBalanceSnapshot(user, bankProjectionResult.ok ? bankProjectionResult.data : null);
  const cases = buildCasesState(
    locale,
    strings,
    asArray(user.crates),
    dailyCaseStatusResult.ok ? dailyCaseStatusResult.data : null,
    weeklyCooldownResult.data
  );
  const upgrades = buildUpgradesState(
    locale,
    strings,
    asArray(user.upgrades),
    balance.walletBalance,
    balance.upgradeDiscount
  );
  const games = buildGamesState(false, recordsResult.data, dailyStatusResults);
  const levelProgress = levelsResult.ok
    ? buildLevelProgress(levelsResult.data, guildUsersResult.ok ? guildUsersResult.data : null, authUser.id)
    : null;
  const progression = buildLevelProgression(
    levelsResult.ok ? levelsResult.data : null,
    levelProgress,
    seasonResult.ok ? seasonResult.data : null,
    levelRolesResult.ok ? levelRolesResult.data : null,
    discordRoleMap
  );
  const hints = buildLauncherHints(cases, upgrades, games, crimeCooldownResult.data);

  return {
    locale,
    strings,
    palette,
    user: {
      id: authUser.id,
      username: authUser.username,
      displayName: authUser.global_name || authUser.username || authUser.id,
      avatar: authUser.avatar || null,
      avatarUrl,
      locale,
    },
    guild: guildResult.ok
      ? {
          id: guildId,
          name:
            typeof asObject(guildResult.data).name === "string"
              ? String(asObject(guildResult.data).name)
              : `Guild ${guildId}`,
        }
      : { id: guildId, name: `Guild ${guildId}` },
    marriage: marriageStatusResult.ok ? buildMarriageStatus(marriageStatusResult.data) : null,
    levelProgress,
    progression,
    hints,
    readOnly: false,
    balance,
    cases,
    upgrades,
    games,
    refreshedAt: Date.now(),
  };
}

export async function buildLauncherResponse(
  guildId: string,
  authUser: ActivityAuthUser | undefined
): Promise<ActivityLauncherPayload> {
  if (!authUser?.id) {
    return buildReadOnlyLauncherPayload(
      guildId,
      authUser,
      "Discord authorization is unavailable for this launch. Reopen the activity after checking OAuth settings."
    );
  }

  if (!guildId) {
    return buildReadOnlyLauncherPayload(guildId, authUser, "Guild context is required for rewards.");
  }

  return buildActivityLauncherPayload(guildId, authUser);
}

export function resolveMoveAmount(
  balance: ActivityBalanceSnapshot,
  direction: "deposit" | "withdraw",
  amountMode: "fixed" | "percent",
  rawAmount: unknown
): number {
  const sourceAvailable =
    direction === "deposit" ? balance.walletBalance : balance.totalBankBalance;

  if (amountMode === "percent") {
    const percent = clamp(0, toNumber(rawAmount, 0), 100);
    return roundMoney(sourceAvailable * (percent / 100));
  }

  return roundMoney(clamp(0, toNumber(rawAmount, 0), sourceAvailable));
}
