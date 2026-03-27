import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../shared/src/serviceConfig.ts";
import { CRATE_TYPES, UPGRADES } from "../shared/src/domain.ts";
import { createHealthResponse } from "../shared/src/utils.ts";
import type {
  ActivityBalanceSnapshot,
  ActivityCasesState,
  ActivityGameCard,
  ActivityLauncherPayload,
  ActivityMutationEnvelope,
  ActivityPalette,
  ActivitySupportedLocale,
  ActivityUpgradeCard,
  ActivityUpgradesState,
} from "../shared/src/contracts/hub.ts";

import { ACTIVITY_GAME_CATALOG } from "./src/lib/gameCatalog.ts";
import {
  buildActivityStrings,
  getActivityLocaleValue,
  normalizeActivityLocale,
} from "./src/lib/activityI18n.ts";
import { IdempotencyStore } from "./src/lib/idempotencyStore.ts";
import {
  compute2048SessionReward,
  MAX_2048_SESSION_EARNING,
} from "./src/lib/rewardCalculator.ts";

const runtimeFilename = fileURLToPath(import.meta.url);
const runtimeDirname = path.dirname(runtimeFilename);
const hubEnvPath = path.resolve(runtimeDirname, "../.env");
const activitiesEnvPath = path.resolve(runtimeDirname, ".env");

dotenv.config({ path: hubEnvPath });
dotenv.config({ path: activitiesEnvPath, override: true });

const ACTIVITIES_SERVICE_PORT = Number(
  process.env.ACTIVITIES_SERVICE_PORT || DEFAULT_SERVICE_PORTS.activities
);
const DATABASE_SERVICE_URL = (
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database
).replace(/\/$/, "");
const RENDERING_SERVICE_URL = (
  process.env.RENDERING_SERVICE_URL || DEFAULT_SERVICE_URLS.rendering
).replace(/\/$/, "");

const ACTIVITY_CLIENT_ID =
  process.env.ACTIVITY_CLIENT_ID || process.env.DISCORD_CLIENT_ID || "";
const ACTIVITY_CLIENT_SECRET =
  process.env.ACTIVITY_CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || "";
const ACTIVITY_PUBLIC_BASE_URL = (process.env.ACTIVITY_PUBLIC_BASE_URL || "").replace(
  /\/$/,
  ""
);
const ACTIVITY_REDIRECT_URI =
  process.env.ACTIVITY_REDIRECT_URI ||
  (ACTIVITY_PUBLIC_BASE_URL
    ? `${ACTIVITY_PUBLIC_BASE_URL}/api/auth/discord/callback`
    : "https://127.0.0.1");
const ACTIVITY_SHARED_KEY =
  process.env.ACTIVITY_SHARED_KEY || process.env.ELEAZAR_ACTIVITIES_SHARED_KEY || "";

const TOKEN_CACHE_TTL_MS = 60 * 1000;
const PALETTE_CACHE_TTL_MS = 15 * 60 * 1000;
const tokenUserCache = new Map<
  string,
  {
    expiresAt: number;
    user: {
      id: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
      locale?: string;
    };
  }
>();
const paletteCache = new Map<string, { expiresAt: number; palette: ActivityPalette }>();

type JsonResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

type AuthenticatedRequest = express.Request & {
  authMode?: "bearer" | "activity_key" | "development";
  authUser?: {
    id: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
    locale?: string;
  };
};

type ActivityUserRecord = {
  id?: string;
  guildId?: string;
  locale?: string | null;
  economy?: Record<string, unknown> | null;
  crates?: Array<Record<string, unknown>> | null;
  upgrades?: Array<Record<string, unknown>> | null;
  stats?: Record<string, unknown> | null;
  Level?: Record<string, unknown> | null;
};

const completionStore = new IdempotencyStore<Record<string, unknown>>();
setInterval(() => completionStore.cleanup(), 5 * 60 * 1000);

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeGameId(gameId: string): string {
  return String(gameId || "").trim().toLowerCase();
}

function getDiscordOAuthErrorMessage(payload: any): string {
  if (!payload || typeof payload !== "object") {
    return "Discord OAuth token exchange failed.";
  }

  const error = typeof payload.error === "string" ? payload.error : "oauth_error";
  const description =
    typeof payload.error_description === "string" ? payload.error_description : "";

  return description ? `${error}: ${description}` : error;
}

async function parseJsonResponse(response: Response): Promise<JsonResult> {
  const text = await response.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function fetchDatabase(pathname: string, init?: RequestInit): Promise<JsonResult> {
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

async function resolveDiscordUser(accessToken: string) {
  const cached = tokenUserCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  const response = await fetch("https://discord.com/api/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const parsed = await parseJsonResponse(response);
  const parsedData = asObject(parsed.data);
  if (!parsed.ok || !parsedData.id) {
    throw new Error("Failed to resolve Discord user");
  }

  const user = {
    id: String(parsedData.id),
    username:
      typeof parsedData.username === "string" ? parsedData.username : undefined,
    global_name:
      typeof parsedData.global_name === "string"
        ? parsedData.global_name
        : null,
    avatar:
      typeof parsedData.avatar === "string" ? parsedData.avatar : null,
    locale: typeof parsedData.locale === "string" ? parsedData.locale : undefined,
  };

  tokenUserCache.set(accessToken, {
    user,
    expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
  });

  return user;
}

function createActivityAuthMiddleware(options?: { allowMissingAuth?: boolean }) {
  return async function activityAuthMiddleware(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ) {
    const allowMissingAuth = Boolean(options?.allowMissingAuth);

  if (process.env.NODE_ENV === "development" && process.env.SKIP_AUTH === "true") {
    const devUserId = String(req.headers["x-user-id"] || "preview-user");
    req.authMode = "development";
    req.authUser = {
      id: devUserId,
      username: "Preview User",
    };
    return next();
  }

  const authHeader = String(req.headers.authorization || "");
  if (!authHeader) {
    if (allowMissingAuth) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized: missing Authorization header" });
  }

  if (authHeader.startsWith("Activity ")) {
    const providedKey = authHeader.substring("Activity ".length);
    if (!ACTIVITY_SHARED_KEY || providedKey !== ACTIVITY_SHARED_KEY) {
      return res.status(403).json({ error: "Forbidden: invalid activity key" });
    }

    const fallbackUserId = req.headers["x-user-id"];
    if (!fallbackUserId) {
      return res.status(400).json({
        error: "x-user-id header is required when using Activity key auth",
      });
    }

    req.authMode = "activity_key";
    req.authUser = { id: String(fallbackUserId) };
    return next();
  }

  if (authHeader.startsWith("Bearer ")) {
    const accessToken = authHeader.substring("Bearer ".length).trim();

    try {
      const discordUser = await resolveDiscordUser(accessToken);
      req.authMode = "bearer";
      req.authUser = discordUser;
      return next();
    } catch (error) {
      console.error("[activities] failed to resolve bearer token", error);
      return res.status(401).json({ error: "Unauthorized: invalid bearer token" });
    }
  }

  if (allowMissingAuth) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized: unsupported auth scheme" });
  };
}

const requireActivityAuth = createActivityAuthMiddleware();
const optionalActivityAuth = createActivityAuthMiddleware({ allowMissingAuth: true });

async function ensureGuildUser(guildId: string, userId: string): Promise<void> {
  const ensureResult = await fetchDatabase(`/guilds/${guildId}/users/ensure`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  if (!ensureResult.ok) {
    throw new Error(`Failed to ensure guild user: ${ensureResult.status}`);
  }
}

function getUpgradeLevel(upgrades: any[], type: string): number {
  const upgrade = upgrades.find(
    (item) => String(item?.type || "").toLowerCase() === String(type).toLowerCase()
  );
  return Math.max(1, toNumber(upgrade?.level, 1));
}

const DEFAULT_ACTIVITY_PALETTE: ActivityPalette = {
  textColor: "#f8fbff",
  secondaryTextColor: "rgba(248,251,255,0.78)",
  tertiaryTextColor: "rgba(248,251,255,0.56)",
  overlayBackground: "rgba(255,255,255,0.08)",
  backgroundGradient: "linear-gradient(145deg, #0f4a68 0%, #173e78 45%, #2f215f 100%)",
  accentColor: "#ffb648",
  dominantColor: "rgb(70, 143, 201)",
  isDarkText: false,
};

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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry) => entry && typeof entry === "object") as Array<
    Record<string, unknown>
  >;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return false;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(5));
}

function formatCompactNumber(value: number, locale: ActivitySupportedLocale): string {
  return value.toLocaleString(locale === "uk" ? "uk-UA" : locale === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: value >= 100 ? 0 : 2,
    minimumFractionDigits: 0,
  });
}

function formatDurationCompact(valueMs: number, locale: ActivitySupportedLocale): string {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const labels =
    locale === "ru"
      ? { d: "д", h: "ч", m: "м" }
      : locale === "uk"
      ? { d: "д", h: "г", m: "хв" }
      : { d: "d", h: "h", m: "m" };

  if (days > 0) {
    return `${days}${labels.d} ${hours}${labels.h}`;
  }
  if (hours > 0) {
    return `${hours}${labels.h} ${minutes}${labels.m}`;
  }
  return `${Math.max(1, minutes)}${labels.m}`;
}

function interpolateTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replaceAll(`{{${key}}}`, String(value)).replaceAll(`{{ ${key} }}`, String(value)),
    template
  );
}

function getAvatarUrl(userId?: string, avatarHash?: string | null): string {
  if (!userId || !avatarHash) {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }

  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=128`;
}

async function fetchRenderingPalette(imageUrl?: string | null): Promise<ActivityPalette> {
  if (!imageUrl) {
    return DEFAULT_ACTIVITY_PALETTE;
  }

  const cached = paletteCache.get(imageUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.palette;
  }

  try {
    const response = await fetch(`${RENDERING_SERVICE_URL}/colors`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageUrl }),
    });

    const parsed = await parseJsonResponse(response);
    const candidate = asObject(parsed.data);
    const palette: ActivityPalette = {
      textColor:
        typeof candidate.textColor === "string"
          ? candidate.textColor
          : DEFAULT_ACTIVITY_PALETTE.textColor,
      secondaryTextColor:
        typeof candidate.secondaryTextColor === "string"
          ? candidate.secondaryTextColor
          : DEFAULT_ACTIVITY_PALETTE.secondaryTextColor,
      tertiaryTextColor:
        typeof candidate.tertiaryTextColor === "string"
          ? candidate.tertiaryTextColor
          : DEFAULT_ACTIVITY_PALETTE.tertiaryTextColor,
      overlayBackground:
        typeof candidate.overlayBackground === "string"
          ? candidate.overlayBackground
          : DEFAULT_ACTIVITY_PALETTE.overlayBackground,
      backgroundGradient:
        typeof candidate.backgroundGradient === "string"
          ? candidate.backgroundGradient
          : DEFAULT_ACTIVITY_PALETTE.backgroundGradient,
      accentColor:
        typeof candidate.accentColor === "string"
          ? candidate.accentColor
          : DEFAULT_ACTIVITY_PALETTE.accentColor,
      dominantColor:
        typeof candidate.dominantColor === "string"
          ? candidate.dominantColor
          : DEFAULT_ACTIVITY_PALETTE.dominantColor,
      isDarkText:
        typeof candidate.isDarkText === "boolean"
          ? candidate.isDarkText
          : DEFAULT_ACTIVITY_PALETTE.isDarkText,
    };

    paletteCache.set(imageUrl, {
      palette,
      expiresAt: Date.now() + PALETTE_CACHE_TTL_MS,
    });

    return palette;
  } catch (error) {
    console.warn("[activities] failed to fetch palette from rendering service", error);
    return DEFAULT_ACTIVITY_PALETTE;
  }
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
    return Math.max(0, safeLevel - 1) * Number(configRecord.effectValue || 0) / 3600000;
  }

  if (type === "crime_mastery") {
    return Math.max(0, safeLevel - 1) * Number(configRecord.effectValue || 0) / 60000;
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
  const projectedBankBalance = Math.max(
    bankBalance,
    toNumber(projection.balance, bankBalance)
  );
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
        description:
          strings.cases.dailyDescription ||
          strings.cases.dailyTitle ||
          "Daily Case",
        emoji: CRATE_TYPES.daily.emoji,
        count: dailyCount,
        available: dailyAvailable,
        cooldownRemainingMs: dailyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.daily.cooldown,
        nextAvailableAt:
          dailyCooldownRemainingMs > 0 ? now + dailyCooldownRemainingMs : null,
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
          strings.cases.weeklyDescription ||
          strings.cases.weeklyTitle ||
          "Weekly Case",
        emoji: CRATE_TYPES.weekly.emoji,
        count: weeklyCount,
        available: weeklyAvailable,
        cooldownRemainingMs: weeklyCooldownRemainingMs,
        cooldownDurationMs: CRATE_TYPES.weekly.cooldown,
        nextAvailableAt:
          weeklyCooldownRemainingMs > 0 ? now + weeklyCooldownRemainingMs : null,
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
        title: getActivityLocaleValue(
          locale,
          `commands.economy.shop.category_${category}`,
          category
        ),
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
      dailyStatus: dailyStatusResults[index]?.ok
        ? asObject(dailyStatusResults[index]?.data)
        : null,
    })),
    playableGameId: "2048",
  };
}

async function buildReadOnlyLauncherPayload(
  guildId: string,
  authUser: AuthenticatedRequest["authUser"] | undefined,
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
      displayName:
        authUser?.global_name || authUser?.username || authUser?.id || "Guest",
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
    games: buildGamesState(true, {}, ACTIVITY_GAME_CATALOG.map(() => ({
      ok: true,
      status: 200,
      data: null,
    }))),
    refreshedAt: Date.now(),
  };
}

async function buildActivityLauncherPayload(
  guildId: string,
  authUser: NonNullable<AuthenticatedRequest["authUser"]>
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

  const balance = buildBalanceSnapshot(
    user,
    bankProjectionResult.ok ? bankProjectionResult.data : null
  );

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

async function buildLauncherResponse(
  guildId: string,
  authUser: AuthenticatedRequest["authUser"]
): Promise<ActivityLauncherPayload> {
  if (!authUser?.id) {
    return buildReadOnlyLauncherPayload(
      guildId,
      authUser,
      "Discord authorization is unavailable for this launch. Reopen the activity after checking OAuth settings."
    );
  }

  if (!guildId) {
    return buildReadOnlyLauncherPayload(
      guildId,
      authUser,
      "Guild context is required for rewards."
    );
  }

  return buildActivityLauncherPayload(guildId, authUser);
}

function resolveMoveAmount(
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

export function createActivitiesApp() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json(createHealthResponse("activities", "1.0.0"));
  });

  app.get(["/api/config", "/.proxy/api/config"], (_req, res) => {
    res.json({
      clientId: ACTIVITY_CLIENT_ID,
      redirectUri: ACTIVITY_REDIRECT_URI,
      publicBaseUrl: ACTIVITY_PUBLIC_BASE_URL || null,
      max2048SessionEarning: MAX_2048_SESSION_EARNING,
      entryPointOnly: true,
      games: ACTIVITY_GAME_CATALOG,
    });
  });

  app.get(
    ["/api/auth/discord/callback", "/.proxy/api/auth/discord/callback"],
    (req, res) => {
      const params = new URLSearchParams();

      for (const [key, value] of Object.entries(req.query || {})) {
        if (value == null) {
          continue;
        }

        if (Array.isArray(value)) {
          for (const entry of value) {
            params.append(key, String(entry));
          }
          continue;
        }

        params.set(key, String(value));
      }

      res.setHeader("Cache-Control", "no-store");
      res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Discord Activity OAuth</title>
  </head>
  <body>
    <script>
      (function () {
        var payload = {
          type: "discord-activity-oauth-callback",
          query: Object.fromEntries(new URLSearchParams(${JSON.stringify(params.toString())}))
        };

        try {
          if (window.opener && window.opener !== window) {
            window.opener.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(payload, window.location.origin);
          }
        } catch (_error) {}

        window.location.replace("/");
      })();
    </script>
    <p>Discord authorization completed. Return to your Activity if this page stays open.</p>
  </body>
</html>`);
    }
  );

  app.post(["/api/token", "/.proxy/api/token"], async (req, res) => {
    try {
      if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
        return res.status(500).json({
          error: "Missing Activity OAuth env vars",
          required: ["ACTIVITY_CLIENT_ID", "ACTIVITY_CLIENT_SECRET"],
        });
      }

      const code = typeof req.body?.code === "string" ? req.body.code : "";
      if (!code) {
        return res.status(400).json({ error: "OAuth code is required" });
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: ACTIVITY_CLIENT_ID,
        client_secret: ACTIVITY_CLIENT_SECRET,
      });

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const parsed = await parseJsonResponse(tokenResponse);
      if (!parsed.ok) {
        const parsedData = asObject(parsed.data);
        return res.status(parsed.status).json({
          ...parsedData,
          error:
            typeof parsedData.error === "string"
              ? parsedData.error
              : "oauth_token_exchange_failed",
          message: getDiscordOAuthErrorMessage(parsed.data),
        });
      }

      return res.status(parsed.status).json(parsed.data);
    } catch (error: any) {
      console.error("[activities] token exchange failed", error);
      return res.status(500).json({
        error: "Token exchange failed",
        message: error?.message || "Unknown error",
      });
    }
  });

  app.get(
    ["/api/launcher-data", "/.proxy/api/launcher-data"],
    optionalActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const guildId = String(req.query.guildId || req.headers["x-guild-id"] || "").trim();
        const launcher = await buildLauncherResponse(guildId, req.authUser);
        return res.json(launcher);
      } catch (error: any) {
        console.error("[activities] launcher-data failed", error);
        return res.status(500).json({
          error: "Failed to load launcher data",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    ["/api/economy/move", "/.proxy/api/economy/move"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const direction =
          String(req.body?.direction || "").trim().toLowerCase() === "withdraw"
            ? "withdraw"
            : String(req.body?.direction || "").trim().toLowerCase() === "deposit"
            ? "deposit"
            : "";
        const amountMode =
          String(req.body?.amountMode || "").trim().toLowerCase() === "percent"
            ? "percent"
            : "fixed";

        if (!guildId) {
          return res.status(400).json({ error: "guildId is required" });
        }

        if (direction !== "deposit" && direction !== "withdraw") {
          return res.status(400).json({ error: "direction must be deposit or withdraw" });
        }

        const currentLauncher = await buildActivityLauncherPayload(guildId, authUser);
        const amount = resolveMoveAmount(
          currentLauncher.balance,
          direction,
          amountMode,
          req.body?.amount
        );

        if (amount <= 0) {
          return res.status(400).json({ error: "Amount must be greater than zero" });
        }

        const result = await fetchDatabase(`/economy/${direction}`, {
          method: "POST",
          body: JSON.stringify({
            guildId,
            userId: authUser.id,
            amount,
          }),
        });

        if (!result.ok) {
          return res.status(result.status).json({
            error:
              typeof asObject(result.data).error === "string"
                ? asObject(result.data).error
                : `Failed to ${direction} funds`,
          });
        }

        const launcher = await buildActivityLauncherPayload(guildId, authUser);
        const response: ActivityMutationEnvelope<{
          direction: "deposit" | "withdraw";
          amount: number;
          amountMode: "fixed" | "percent";
        }> = {
          success: true,
          action: {
            direction,
            amount,
            amountMode,
          },
          launcher,
        };

        return res.json(response);
      } catch (error: any) {
        console.error("[activities] economy move failed", error);
        return res.status(500).json({
          error: "Failed to move funds",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    ["/api/crates/open", "/.proxy/api/crates/open"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const type = String(req.body?.type || "").trim().toLowerCase();

        if (!guildId || !type) {
          return res.status(400).json({ error: "guildId and type are required" });
        }

        const result = await fetchDatabase("/crates/open", {
          method: "POST",
          body: JSON.stringify({
            guildId,
            userId: authUser.id,
            type,
          }),
        });

        if (!result.ok) {
          return res.status(result.status).json({
            error:
              typeof asObject(result.data).error === "string"
                ? asObject(result.data).error
                : "Failed to open crate",
          });
        }

        const launcher = await buildActivityLauncherPayload(guildId, authUser);
        const response: ActivityMutationEnvelope<{ type: string; reward: unknown }> = {
          success: true,
          action: {
            type,
            reward: result.data,
          },
          launcher,
        };

        return res.json(response);
      } catch (error: any) {
        console.error("[activities] crate open failed", error);
        return res.status(500).json({
          error: "Failed to open crate",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    ["/api/upgrades/purchase", "/.proxy/api/upgrades/purchase"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const upgradeType = String(req.body?.upgradeType || "").trim();

        if (!guildId || !upgradeType) {
          return res.status(400).json({ error: "guildId and upgradeType are required" });
        }

        const result = await fetchDatabase("/economy/upgrades/purchase", {
          method: "POST",
          body: JSON.stringify({
            guildId,
            userId: authUser.id,
            upgradeType,
          }),
        });

        if (!result.ok) {
          return res.status(result.status).json({
            error:
              typeof asObject(result.data).error === "string"
                ? asObject(result.data).error
                : "Failed to purchase upgrade",
          });
        }

        const launcher = await buildActivityLauncherPayload(guildId, authUser);
        const response: ActivityMutationEnvelope<{ upgradeType: string }> = {
          success: true,
          action: {
            upgradeType,
          },
          launcher,
        };

        return res.json(response);
      } catch (error: any) {
        console.error("[activities] upgrade purchase failed", error);
        return res.status(500).json({
          error: "Failed to purchase upgrade",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  app.post(
    ["/api/games/2048/complete", "/.proxy/api/games/2048/complete"],
    requireActivityAuth,
    async (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser;
        if (!authUser?.id) {
          return res.status(401).json({ error: "Unauthorized: missing resolved user" });
        }

        const submissionId = String(req.body?.submissionId || "").trim();
        const guildId = String(req.body?.guildId || req.headers["x-guild-id"] || "").trim();
        const requestedScore = toNumber(req.body?.score, 0);
        const requestedMoves = toNumber(req.body?.moves, 0);
        const requestedDurationMs = toNumber(req.body?.durationMs, 0);

        if (!submissionId) {
          return res.status(400).json({ error: "submissionId is required" });
        }

        if (!guildId) {
          return res.status(400).json({
            error: "guildId is required for rewarded gameplay",
          });
        }

        const score = clamp(0, requestedScore, 2_000_000);
        const moves = clamp(0, requestedMoves, 200_000);
        const durationMs = clamp(0, requestedDurationMs, 12 * 60 * 60 * 1000);

        const idempotencyKey = `2048:${guildId}:${authUser.id}:${submissionId}`;
        const existing = completionStore.get(idempotencyKey);
        if (existing) {
          return res.json({
            ...existing,
            idempotent: true,
          });
        }

        await ensureGuildUser(guildId, authUser.id);
        const userResult = await fetchDatabase(`/users/${guildId}/${authUser.id}`);
        const userData = asObject(userResult.data);
        const upgrades = asArray(userData.upgrades);
        const gamesEarningLevel = getUpgradeLevel(upgrades, "games_earning");

        const reward = compute2048SessionReward({
          score,
          moves,
          durationMs,
          gamesEarningLevel,
        });

        const gameXp = Math.max(0, Math.floor(score * 5));

        const highScoreResult = await fetchDatabase(`/games/records/update`, {
          method: "POST",
          body: JSON.stringify({
            userId: authUser.id,
            guildId,
            gameId: "2048",
            score,
          }),
        });

        const xpResult =
          gameXp > 0
            ? await fetchDatabase(`/games/xp/add`, {
                method: "POST",
                body: JSON.stringify({
                  userId: authUser.id,
                  guildId,
                  gameType: "2048",
                  xp: gameXp,
                }),
              })
            : { ok: true, status: 200, data: null };

        const payoutResult =
          reward.requestedEarning > 0
            ? await fetchDatabase(`/games/earnings/award`, {
                method: "POST",
                body: JSON.stringify({
                  userId: authUser.id,
                  guildId,
                  gameId: "2048",
                  amount: reward.requestedEarning,
                }),
              })
            : { ok: true, status: 200, data: null };

        const dailyStatusResult = await fetchDatabase(
          `/games/earnings/${guildId}/${authUser.id}/2048`
        );
        const balanceResult = await fetchDatabase(`/economy/balance/${guildId}/${authUser.id}`);

        const payout = asObject(payoutResult.data);
        const highScoreData = asObject(highScoreResult.data);
        const xpData = asObject(xpResult.data);
        const balanceData = asObject(balanceResult.data);
        const totalBlockedAmount = Math.max(0, toNumber(payout?.blockedAmount));
        const capBlockedAmount = Math.max(
          0,
          toNumber(payout?.capBlockedAmount, totalBlockedAmount)
        );
        const effectiveRequestedAmount = Math.max(
          0,
          toNumber(
            payout?.effectiveRequestedAmount,
            toNumber(payout?.requestedAmount, reward.requestedEarning)
          )
        );
        const visualAwardedAmount = Math.max(0, effectiveRequestedAmount - capBlockedAmount);

        const responsePayload = {
          idempotent: false,
          success: true,
          submissionId,
          gameId: "2048",
          userId: authUser.id,
          guildId,
          session: {
            score,
            moves,
            durationMs,
          },
          reward: {
            requestedEarning: Number(reward.requestedEarning.toFixed(4)),
            awardedAmount: toNumber(payout?.awardedAmount, 0),
            visualAwardedAmount,
            blockedAmount: capBlockedAmount,
            softLimitAwardAmount: toNumber(payout?.softLimitAwardAmount, 0),
            softLimitPayoutFactor: toNumber(payout?.softLimitPayoutFactor, 0),
            gameXp,
          },
          progression: {
            highScore: toNumber(highScoreData.highScore, score) || score,
            isNewRecord: Boolean(highScoreData.isNewRecord),
            levelUp: xpData.levelUp || null,
            type: xpData.type || null,
          },
          dailyStatus: dailyStatusResult.data || null,
          economy: {
            balance: toNumber(balanceData.balance, 0),
            totalBankBalance: toNumber(balanceData.totalBankBalance, 0),
          },
        };

        completionStore.set(idempotencyKey, responsePayload);
        return res.json(responsePayload);
      } catch (error: any) {
        console.error("[activities] 2048 completion failed", error);
        return res.status(500).json({
          error: "Failed to finalize 2048 session",
          message: error?.message || "Unknown error",
        });
      }
    }
  );

  // Compatibility routes used by old activity clients proxied through hub/client.
  app.post(
    ["/api/games/updateRecord", "/.proxy/api/games/updateRecord"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const result = await fetchDatabase(`/games/records/update`, {
          method: "POST",
          body: JSON.stringify(req.body || {}),
        });
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({
          error: error?.message || "Failed to update game record",
        });
      }
    }
  );

  app.get(
    ["/api/shop/upgrades/:guildId/:userId", "/.proxy/api/shop/upgrades/:guildId/:userId"],
    requireActivityAuth,
    async (req, res) => {
      try {
        const guildId = String(req.params.guildId || "");
        const userId = String(req.params.userId || "");
        const result = await fetchDatabase(`/economy/upgrades/${guildId}/${userId}`);
        return res.status(result.status).json(result.data);
      } catch (error: any) {
        return res.status(500).json({ error: error?.message || "Failed to load upgrades" });
      }
    }
  );

  const staticPath = path.join(runtimeDirname, "client", "dist");

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get(/^\/(?!api|\.proxy|health).*/, (_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send(
          "Activities API is running. Build the activity client with `bun --cwd client run build` to serve the web app from this process."
        );
    });
  }

  app.use(
    (
      error: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[activities] unhandled error", error);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}

if (import.meta.main) {
  if (!ACTIVITY_CLIENT_ID || !ACTIVITY_CLIENT_SECRET) {
    console.warn(
      "[activities] WARNING: ACTIVITY_CLIENT_ID / ACTIVITY_CLIENT_SECRET are not configured. OAuth token exchange will fail until configured."
    );
  }
  if (!ACTIVITY_PUBLIC_BASE_URL && !process.env.ACTIVITY_REDIRECT_URI) {
    console.warn(
      `[activities] WARNING: ACTIVITY_PUBLIC_BASE_URL is not set. Redirect URI falls back to Discord's recommended placeholder (${ACTIVITY_REDIRECT_URI}).`
    );
  }

  const app = createActivitiesApp();
  app.listen(ACTIVITIES_SERVICE_PORT, () => {
    console.log(`Activities service running on http://localhost:${ACTIVITIES_SERVICE_PORT}`);
    console.log(`Health check: http://localhost:${ACTIVITIES_SERVICE_PORT}/health`);
  });
}
