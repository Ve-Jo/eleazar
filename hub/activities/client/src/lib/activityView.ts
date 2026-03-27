import type { CSSProperties } from "react";

import type {
  ActivityGameCard,
  ActivityLauncherPayload,
  ActivitySupportedLocale,
} from "../../../../shared/src/contracts/hub.ts";

export function getGuildIdFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("guildId") || params.get("guild_id") || params.get("guild") || "";
}

export function getLocaleTag(locale: ActivitySupportedLocale): string {
  if (locale === "ru") {
    return "ru-RU";
  }
  if (locale === "uk") {
    return "uk-UA";
  }
  return "en-US";
}

export function formatNumber(
  value: unknown,
  locale: ActivitySupportedLocale,
  digits = 1
): string {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return "0";
  }

  return numeric.toLocaleString(getLocaleTag(locale), {
    maximumFractionDigits: Number.isInteger(numeric) ? 0 : digits,
    minimumFractionDigits: 0,
  });
}

export function getStatusDailyRemaining(game: ActivityGameCard | undefined): number {
  return Number(game?.dailyStatus?.remainingToday || 0);
}

export function getGameById(launcherData: ActivityLauncherPayload | null, gameId: string) {
  return launcherData?.games.items.find((entry) => entry.id === gameId);
}

export function getCrateByType(
  launcherData: ActivityLauncherPayload | null,
  crateType: string
) {
  return launcherData?.cases.cards.find((entry) => entry.type === crateType);
}

export function getUpgradeByType(
  launcherData: ActivityLauncherPayload | null,
  upgradeType: string
) {
  for (const group of launcherData?.upgrades.groups || []) {
    const upgrade = group.items.find((entry) => entry.type === upgradeType);
    if (upgrade) {
      return upgrade;
    }
  }

  return undefined;
}

export function formatCooldownClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function buildCasesCalendarPresentation(
  locale: ActivitySupportedLocale,
  dailyStatusInput: Record<string, unknown> | null | undefined,
  labels: {
    monthStatus: string;
    streak: string;
    rewardMultiplier: string;
    dailyReady: string;
  }
) {
  const dailyStatus =
    dailyStatusInput && typeof dailyStatusInput === "object" ? dailyStatusInput : null;

  if (!dailyStatus) {
    return null;
  }

  const weekdayLabels =
    locale === "ru"
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
      : locale === "uk"
      ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const streak = Number(dailyStatus.streak || 0);
  const rewardMultiplier = Number(dailyStatus.rewardMultiplier || 1);
  const cooldownRemainingMs = Math.max(0, Number(dailyStatus.cooldownRemainingMs || 0));
  const referenceDate = dailyStatus.nextAvailableAt
    ? new Date(Number(dailyStatus.nextAvailableAt) - cooldownRemainingMs)
    : new Date();
  const monthLabel = `${String(referenceDate.getUTCMonth() + 1).padStart(2, "0")}.${referenceDate.getUTCFullYear()}`;
  const history = Array.isArray(dailyStatus.history)
    ? dailyStatus.history.filter((entry): entry is string => typeof entry === "string")
    : [];
  const currentWeekOpenedSet = new Set(
    Array.isArray(dailyStatus.currentWeek)
      ? dailyStatus.currentWeek
          .filter(
            (entry): entry is { opened?: unknown; dateKey?: string } =>
              Boolean(entry) && typeof entry === "object"
          )
          .filter((entry) => entry.opened && typeof entry.dateKey === "string")
          .map((entry) => String(entry.dateKey))
      : []
  );
  const openedHistorySet = new Set([
    ...history,
    ...(typeof dailyStatus.lastOpenedDay === "string" ? [dailyStatus.lastOpenedDay] : []),
    ...currentWeekOpenedSet,
  ]);
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(
    today.getUTCDate()
  ).padStart(2, "0")}`;
  const year = referenceDate.getUTCFullYear();
  const monthIndex = referenceDate.getUTCMonth();
  const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingOffset = (firstDayUtc.getUTCDay() + 6) % 7;
  const monthEntries: Array<{
    id: string;
    dayNumber: number;
    inCurrentMonth: boolean;
  }> = [];

  for (let index = 0; index < leadingOffset; index += 1) {
    const date = new Date(Date.UTC(year, monthIndex, 1 - (leadingOffset - index)));
    monthEntries.push({
      id: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    monthEntries.push({
      id: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dayNumber: day,
      inCurrentMonth: true,
    });
  }

  while (monthEntries.length % 7 !== 0 || monthEntries.length < 35) {
    const date = new Date(
      Date.UTC(
        year,
        monthIndex,
        daysInMonth + (monthEntries.length - (leadingOffset + daysInMonth)) + 1
      )
    );
    monthEntries.push({
      id: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
      dayNumber: date.getUTCDate(),
      inCurrentMonth: false,
    });
  }

  const calendarWeeks: typeof monthEntries[] = [];
  for (let index = 0; index < monthEntries.length; index += 7) {
    calendarWeeks.push(monthEntries.slice(index, index + 7));
  }

  const currentWeekIndex = Math.max(
    calendarWeeks.findIndex((week) => week.some((entry) => entry.id === todayKey)),
    0
  );
  const visibleWeekCount = 3;
  const maxCalendarStart = Math.max(calendarWeeks.length - visibleWeekCount, 0);
  const visibleCalendarStart = Math.min(Math.max(currentWeekIndex - 1, 0), maxCalendarStart);
  const visibleCalendarWeeks = calendarWeeks.slice(
    visibleCalendarStart,
    visibleCalendarStart + visibleWeekCount
  );

  return {
    label: labels.monthStatus,
    value: monthLabel,
    headline: `${labels.streak}: ${streak}`,
    subline: `${labels.rewardMultiplier}: x${rewardMultiplier.toFixed(2)}`,
    badgeIcon: Boolean(dailyStatus.available) ? "✅" : "⏳",
    badgeText: Boolean(dailyStatus.available)
      ? labels.dailyReady
      : formatCooldownClock(cooldownRemainingMs),
    badgeTone: Boolean(dailyStatus.available) ? "ready" : "cooldown",
    weekdays: weekdayLabels,
    weeks: visibleCalendarWeeks.map((week) =>
      week.map((entry) => {
        const opened = openedHistorySet.has(entry.id);
        return {
          id: entry.id,
          display: opened ? "✓" : String(entry.dayNumber),
          opened,
          isCurrent: entry.id === todayKey,
          isFuture: entry.id > todayKey,
          isMuted: !entry.inCurrentMonth,
        };
      })
    ),
    showTopFade: visibleCalendarStart > 0,
    showBottomFade: visibleCalendarStart + visibleWeekCount < calendarWeeks.length,
  };
}

export function getDailyProgress(game: ActivityGameCard | undefined) {
  const cap = Number(game?.dailyStatus?.cap || 0);
  const earnedToday = Number(game?.dailyStatus?.earnedToday || 0);

  if (cap <= 0) {
    return null;
  }

  return {
    cap,
    earnedToday,
    percent: Math.max(0, Math.min(100, Math.round((earnedToday / cap) * 100))),
  };
}

export function getRewardEntries(
  reward: Record<string, unknown>,
  locale: ActivitySupportedLocale,
  launcherData: ActivityLauncherPayload
) {
  const entries: Array<{ emoji: string; label: string; value: string }> = [];
  const commonCoins = launcherData.strings.common.coins || "coins";

  if (Number(reward.coins || 0) > 0) {
    entries.push({
      emoji: "💵",
      label: commonCoins,
      value: `+${formatNumber(reward.coins, locale)}`,
    });
  }
  if (Number(reward.seasonXp || 0) > 0) {
    entries.push({
      emoji: "✨",
      label: "XP",
      value: `+${formatNumber(reward.seasonXp, locale, 0)}`,
    });
  }
  if (Number(reward.discount || 0) > 0) {
    entries.push({
      emoji: "🏷️",
      label: launcherData.balance.upgradeDiscount > 0 ? "Discount" : "Discount",
      value: `${formatNumber(reward.discount, locale, 0)}%`,
    });
  }

  const cooldownReductions = reward.cooldownReductions;
  if (
    cooldownReductions &&
    typeof cooldownReductions === "object" &&
    !Array.isArray(cooldownReductions)
  ) {
    Object.entries(cooldownReductions).forEach(([key, value]) => {
      const minutes = Math.floor(Number(value || 0) / 60000);
      if (minutes > 0) {
        entries.push({
          emoji: "⏱️",
          label: key,
          value: `-${minutes}m`,
        });
      }
    });
  }

  return entries;
}

export function createPaletteStyle(
  launcherData: ActivityLauncherPayload | null
): CSSProperties {
  if (!launcherData) {
    return {};
  }

  return {
    ["--activity-bg" as string]: launcherData.palette.backgroundGradient,
    ["--activity-text" as string]: launcherData.palette.textColor,
    ["--activity-text-soft" as string]: launcherData.palette.secondaryTextColor,
    ["--activity-text-faint" as string]: launcherData.palette.tertiaryTextColor,
    ["--activity-overlay" as string]: launcherData.palette.overlayBackground,
    ["--activity-accent" as string]: launcherData.palette.accentColor,
    ["--activity-dominant" as string]:
      launcherData.palette.dominantColor || launcherData.palette.accentColor,
  };
}
