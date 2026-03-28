import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import { formatNumber, getLocaleTag } from "../../lib/activityView.ts";
import { createSectionColoring } from "../launcher/lib/createSectionColoring.ts";

type BuildLevelSectionPropsOptions = {
  launcherData: ActivityLauncherPayload;
  now: number;
  shouldCompactPanels: boolean;
  isReadOnly: boolean;
};

function pad2(value: number): string {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0");
}

function formatSeasonCountdown(
  ms: number,
  labels: { day: string; hour: string; minute: string; second: string }
): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return `${days}${labels.day} ${pad2(hours)}${labels.hour} ${pad2(minutes)}${labels.minute} ${pad2(seconds)}${labels.second}`;
  }

  return `${pad2(totalHours)}${labels.hour} ${pad2(minutes)}${labels.minute} ${pad2(seconds)}${labels.second}`;
}

function getModeLabel(mode: string, launcherData: ActivityLauncherPayload): string {
  const normalized = String(mode || "text").trim().toLowerCase();
  const levelStrings = launcherData.strings.level;

  if (normalized === "voice") {
    return levelStrings.voice;
  }
  if (normalized === "gaming") {
    return levelStrings.games;
  }
  if (normalized === "combined_activity") {
    return `${levelStrings.chat}+${levelStrings.voice}`;
  }
  if (normalized === "combined_all") {
    return levelStrings.all;
  }
  return levelStrings.chat;
}

function toProgress(currentXP: number, requiredXP: number): number {
  return Math.max(0, Math.min(1, currentXP / Math.max(1, requiredXP)));
}

export function buildLevelSectionProps({
  launcherData,
  now,
  shouldCompactPanels,
  isReadOnly,
}: BuildLevelSectionPropsOptions) {
  const locale = launcherData.locale;
  const progression = launcherData.progression || null;
  const levelStrings = launcherData.strings.level;
  const commonStrings = launcherData.strings.common;
  const durationLabels = {
    day: commonStrings.unitDayShort,
    hour: commonStrings.unitHourShort,
    minute: commonStrings.unitMinuteShort,
    second: commonStrings.unitSecondShort,
  };
  const chat = progression?.chat || launcherData.levelProgress?.chat || null;
  const voice = progression?.voice || launcherData.levelProgress?.voice || null;
  const game = progression?.game || launcherData.levelProgress?.game || null;
  const season = progression?.season || null;
  const seasonNumber = Math.max(1, Number(progression?.seasonNumber || 1));
  const seasonEnds = Number(progression?.seasonEnds || 0);
  const seasonRemainingMs = seasonEnds > 0 ? Math.max(0, seasonEnds - now) : 0;
  const seasonXp = Math.max(0, Number(progression?.seasonXp || season?.totalXP || 0));

  const levelCards = [
    {
      key: "chat",
      icon: "💬",
      label: levelStrings.chat,
      value: formatNumber(chat?.level || 1, locale, 0),
      suffix: levelStrings.lvlSuffix,
      xpLabel: `${formatNumber(chat?.currentXP || 0, locale, 0)} / ${formatNumber(
        chat?.requiredXP || 1,
        locale,
        0
      )} ${levelStrings.xp}`,
      progress: toProgress(Number(chat?.currentXP || 0), Number(chat?.requiredXP || 1)),
      rank: chat?.rank ? `#${chat.rank}` : null,
      accentColor: "rgba(67, 157, 242, 0.82)",
      background:
        "linear-gradient(180deg, rgba(104, 179, 242, 0.30), rgba(65, 116, 156, 0.22))",
    },
    {
      key: "games",
      icon: "🎮",
      label: levelStrings.games,
      value: formatNumber(game?.level || 1, locale, 0),
      suffix: levelStrings.lvlSuffix,
      xpLabel: `${formatNumber(game?.currentXP || 0, locale, 0)} / ${formatNumber(
        game?.requiredXP || 1,
        locale,
        0
      )} ${levelStrings.xp}`,
      progress: toProgress(Number(game?.currentXP || 0), Number(game?.requiredXP || 1)),
      rank: game?.rank ? `#${game.rank}` : null,
      accentColor: "rgba(99, 190, 92, 0.84)",
      background:
        "linear-gradient(180deg, rgba(118, 204, 108, 0.30), rgba(71, 132, 71, 0.22))",
    },
    {
      key: "voice",
      icon: "🎤",
      label: levelStrings.voice,
      value: formatNumber(voice?.level || 1, locale, 0),
      suffix: levelStrings.lvlSuffix,
      xpLabel: `${formatNumber(voice?.currentXP || 0, locale, 0)} / ${formatNumber(
        voice?.requiredXP || 1,
        locale,
        0
      )} ${levelStrings.xp}`,
      progress: toProgress(Number(voice?.currentXP || 0), Number(voice?.requiredXP || 1)),
      rank: voice?.rank ? `#${voice.rank}` : null,
      accentColor: "rgba(88, 198, 214, 0.84)",
      background:
        "linear-gradient(180deg, rgba(111, 211, 223, 0.30), rgba(67, 128, 138, 0.22))",
    },
  ];

  const modeLevels = {
    text: Number(chat?.level || 1),
    voice: Number(voice?.level || 1),
    gaming: Number(game?.level || 1),
    combined_activity: Number(chat?.level || 1) + Number(voice?.level || 1),
    combined_all:
      Number(chat?.level || 1) + Number(voice?.level || 1) + Number(game?.level || 1),
  } as const;

  const upcomingRoles = (progression?.upcomingRoles || []).map((role, index) => {
    const normalizedMode = String(role.mode || "text").trim().toLowerCase() as keyof typeof modeLevels;
    const currentLevel = modeLevels[normalizedMode] || modeLevels.text;
    const requiredLevel = Math.max(1, Number(role.requiredLevel || 1));

    return {
      key: `${role.roleId}-${index}`,
      roleId: role.roleId,
      roleName: String(role.roleName || "").trim() || role.roleId,
      mode: normalizedMode,
      modeLabel: getModeLabel(normalizedMode, launcherData),
      requiredLevel,
      requiredLabel: `${levelStrings.level} ${formatNumber(requiredLevel, locale, 0)}`,
      progress: Math.max(0, Math.min(1, currentLevel / Math.max(1, requiredLevel))),
      color: role.color,
    };
  });

  return {
    sectionProps: {
      compact: shouldCompactPanels,
      coloring: createSectionColoring(launcherData),
      eyebrow: launcherData.strings.nav.level,
      title: levelStrings.title,
      titleMeta: launcherData.user.displayName || launcherData.user.username || null,
      subtitle: isReadOnly
        ? launcherData.strings.nav.readOnly
        : getLocaleTag(locale),
      profilePanel: {
        avatarUrl: launcherData.user.avatarUrl || launcherData.user.avatar || undefined,
        userId: launcherData.user.id || undefined,
        displayName: launcherData.user.displayName || launcherData.user.username || undefined,
        meta: launcherData.guild?.name || undefined,
      },
      seasonCard: {
        title: `${levelStrings.season} ${seasonNumber}`,
        xpValue: `${formatNumber(seasonXp, locale, 0)} ${levelStrings.xp}`,
        countdownLabel: seasonEnds > 0 ? formatSeasonCountdown(seasonRemainingMs, durationLabels) : "00:00:00",
      },
      levelCards,
      rolesTitle: levelStrings.nextRole,
      rolesEmptyText: levelStrings.noNextRole,
      upcomingRoles,
    },
  };
}
