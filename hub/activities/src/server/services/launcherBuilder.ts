import { CRATE_TYPES, UPGRADES } from "../../../../shared/src/domain.ts";
import type {
  ActivityBalanceSnapshot,
  ActivityCasesState,
  ActivityGameCard,
  ActivityLauncherPayload,
  ActivityPalette,
  ActivitySupportedLocale,
  ActivityUpgradeCard,
  ActivityUpgradesState,
} from "../../../../shared/src/contracts/hub.ts";

import { ACTIVITY_GAME_CATALOG } from "../../lib/gameCatalog.ts";
import {
  buildActivityStrings,
  getActivityLocaleValue,
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

const UNIT_LABELS: Record<ActivitySupportedLocale, Record<string, string>> = {
  en: {
    percent: "%",
    minutes: "min",
    hours: "h",
  },
  ru: {
    percent: "%",
    minutes: "мин",
    hours: "ч",
  },
  uk: {
    percent: "%",
    minutes: "хв",
    hours: "год",
  },
};

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
  type: string,
  effectValue: number
): string {
  const unit = getUpgradeEffectUnit(type);
  const unitLabel = UNIT_LABELS[locale][unit];
  const formatted = effectValue.toLocaleString(
    locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US",
    {
      maximumFractionDigits: effectValue >= 10 ? 0 : 2,
      minimumFractionDigits: 0,
    }
  );

  return unit === "percent" ? `${formatted}%` : `${formatted} ${unitLabel}`;
}

function getFallbackImpactLabel(type: string): string {
  switch (type) {
    case "daily_bonus":
      return "Daily rewards";
    case "games_earning":
      return "Game payouts";
    case "crime_mastery":
      return "Crime success & fines";
    case "time_wizard":
      return "Daily/Weekly cooldowns";
    case "vault_guard":
      return "Defense & fees";
    case "bank_vault":
      return "Bank max time";
    default:
      return "Upgrade";
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

  return {
    totalCount: dailyCount + weeklyCount,
    availableCount: Number(dailyAvailable) + Number(weeklyAvailable),
    dailyStatus: Object.keys(dailyStatus).length > 0 ? dailyStatus : null,
    cards: [
      {
        type: "daily",
        name: strings.cases.dailyName || strings.cases.dailyTitle || "Daily Case",
        description: strings.cases.dailyDescription || strings.cases.dailyTitle || "Daily Case",
        emoji: CRATE_TYPES.daily.emoji,
        count: dailyCount,
        available: dailyAvailable,
        cooldownRemainingMs: dailyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.daily.cooldown,
        nextAvailableAt: dailyCooldownRemainingMs > 0 ? now + dailyCooldownRemainingMs : null,
        statusLabel: dailyAvailable
          ? strings.cases.readyNow || "Ready"
          : formatDurationCompact(dailyCooldownRemainingMs, locale),
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
        name: strings.cases.weeklyName || strings.cases.weeklyTitle || "Weekly Case",
        description:
          strings.cases.weeklyDescription || strings.cases.weeklyTitle || "Weekly Case",
        emoji: CRATE_TYPES.weekly.emoji,
        count: weeklyCount,
        available: weeklyAvailable,
        cooldownRemainingMs: weeklyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.weekly.cooldown,
        nextAvailableAt: weeklyCooldownRemainingMs > 0 ? now + weeklyCooldownRemainingMs : null,
        statusLabel: weeklyAvailable
          ? strings.cases.readyNow || "Ready"
          : formatDurationCompact(weeklyCooldownRemainingMs, locale),
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
      getFallbackImpactLabel(type)
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
      currentEffectLabel: formatUpgradeEffectLabel(locale, type, currentEffect),
      nextEffectLabel: formatUpgradeEffectLabel(locale, type, nextEffect),
      deltaEffectLabel: formatUpgradeEffectLabel(locale, type, deltaEffect),
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
        title: getActivityLocaleValue(locale, `commands.economy.shop.category_${category}`, category),
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
    readOnly: true,
    unsupportedReason,
    balance: buildEmptyBalanceSnapshot(),
    cases: buildCasesState(locale, strings, [], null, 0),
    upgrades: buildUpgradesState(locale, [], 0, 0),
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
    ...dailyStatusResults
  ] = await Promise.all([
    fetchDatabase(`/users/${guildId}/${authUser.id}`),
    fetchDatabase(`/guilds/${guildId}`),
    fetchDatabase(`/games/records/${guildId}/${authUser.id}`),
    fetchDatabase(`/crates/status/${guildId}/${authUser.id}/daily`),
    fetchDatabase(`/cooldowns/crate/${guildId}/${authUser.id}/weekly`),
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
    readOnly: false,
    balance,
    cases: buildCasesState(
      locale,
      strings,
      asArray(user.crates),
      dailyCaseStatusResult.ok ? dailyCaseStatusResult.data : null,
      weeklyCooldownResult.data
    ),
    upgrades: buildUpgradesState(
      locale,
      asArray(user.upgrades),
      balance.walletBalance,
      balance.upgradeDiscount
    ),
    games: buildGamesState(false, recordsResult.data, dailyStatusResults),
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
