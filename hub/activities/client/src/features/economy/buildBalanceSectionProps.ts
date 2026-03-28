import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import { projectBankSnapshot, type MoneyMoveDirection } from "../../lib/activityMath.ts";
import {
  createPaletteStyle,
  formatNumber,
  getLocaleTag,
} from "../../lib/activityView.ts";
import { createSectionColoring } from "../launcher/lib/createSectionColoring.ts";

type BuildBalanceSectionPropsOptions = {
  launcherData: ActivityLauncherPayload;
  isReadOnly: boolean;
  now: number;
  onOpenMoneyModal: (direction: MoneyMoveDirection) => void;
  shouldCompactBalance: boolean;
};

function formatCompactDuration(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalMinutes = Math.floor(safeMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (safeMs <= 0) {
    return "0m";
  }
  if (totalHours <= 0) {
    return `${Math.max(1, totalMinutes)}m`;
  }
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
}

function formatElapsedDuration(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (totalHours > 0) {
    return `${totalHours}h ${minutes}m ${seconds}s`;
  }
  if (totalMinutes > 0) {
    return `${totalMinutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function getMarriedLabel(locale: ActivityLauncherPayload["locale"]): string {
  if (locale === "uk") {
    return "У шлюбі";
  }
  if (locale === "ru") {
    return "В браке";
  }
  return "Married";
}

function getLevelTitles(locale: ActivityLauncherPayload["locale"]) {
  if (locale === "uk") {
    return {
      chat: "Чатинг",
      voice: "Голос",
      gaming: "Геймінг",
    };
  }
  if (locale === "ru") {
    return {
      chat: "Чатинг",
      voice: "Голос",
      gaming: "Гейминг",
    };
  }
  return {
    chat: "Chatting",
    voice: "Voice",
    gaming: "Gaming",
  };
}

export function buildBalanceSectionProps({
  launcherData,
  isReadOnly,
  now,
  onOpenMoneyModal,
  shouldCompactBalance,
}: BuildBalanceSectionPropsOptions) {
  const locale = launcherData.locale;
  const projectedBalance = projectBankSnapshot(launcherData.balance, now);
  const balanceCycleRemainingMs = Math.max(
    0,
    launcherData.balance.maxInactiveMs - projectedBalance.timeIntoCycleMs
  );
  const projectedGain = Math.max(
    0,
    projectedBalance.projectedTotalBankBalance - launcherData.balance.totalBankBalance
  );
  const levelTitles = getLevelTitles(locale);
  const levelProgress = launcherData.levelProgress || null;
  const chatLevelData = levelProgress?.chat || null;
  const voiceLevelData = levelProgress?.voice || null;
  const gameLevelData = levelProgress?.game || null;
  const chatLevelFill = chatLevelData
    ? Math.max(
        0,
        Math.min(
          1,
          Number(chatLevelData.currentXP || 0) / Math.max(1, Number(chatLevelData.requiredXP || 1))
        )
      )
    : 0;
  const voiceLevelFill = voiceLevelData
    ? Math.max(
        0,
        Math.min(
          1,
          Number(voiceLevelData.currentXP || 0) / Math.max(1, Number(voiceLevelData.requiredXP || 1))
        )
      )
    : 0;
  const gameLevelFill = gameLevelData
    ? Math.max(
        0,
        Math.min(
          1,
          Number(gameLevelData.currentXP || 0) / Math.max(1, Number(gameLevelData.requiredXP || 1))
        )
      )
    : 0;
  const hints = launcherData.hints || null;
  const dailyCaseCard = launcherData.cases.cards.find((card) => card.type === "daily");
  const allUpgradeCards = launcherData.upgrades.groups.flatMap((group) => group.items);
  const affordableUpgrades = allUpgradeCards.filter((item) => item.isAffordable).length;
  const caseReadyLabel = launcherData.strings.cases.readyNow || "Ready";
  const marriageCreatedAtRaw = launcherData.marriage?.createdAt;
  const marriageCreatedAtMs =
    marriageCreatedAtRaw === null || marriageCreatedAtRaw === undefined
      ? 0
      : Number(new Date(marriageCreatedAtRaw).getTime());
  const isMarried = String(launcherData.marriage?.status || "").toUpperCase() === "MARRIED";
  const marriageElapsed =
    isMarried && marriageCreatedAtMs > 0 ? formatElapsedDuration(now - marriageCreatedAtMs) : null;
  const casesCooldowns = hints?.casesCooldowns || {};
  const caseAvailableCount =
    typeof hints?.dailyAvailable === "number"
      ? hints.dailyAvailable
      : hints?.dailyAvailable
      ? 1
      : 0;
  const closestCaseRemainingMs = Math.max(
    0,
    Number(casesCooldowns.closestRemainingMs || 0)
  );
  const caseHintValue =
    caseAvailableCount > 0
      ? formatNumber(caseAvailableCount, locale, 0)
      : formatCompactDuration(closestCaseRemainingMs);
  const upgradesAffordable =
    typeof hints?.upgradesAffordable === "number"
      ? hints.upgradesAffordable
      : hints?.upgradesAffordable
      ? 1
      : affordableUpgrades;
  const workProgress = Math.max(
    0,
    Math.min(1, Number(hints?.workEarnings?.progress || 0))
  );
  const workProgressLabel = `${Math.round(workProgress * 100)}%`;
  const crimeRemainingMs = Math.max(0, Number(hints?.crimeRemainingMs || 0));
  const crimeHintValue =
    crimeRemainingMs > 0
      ? formatCompactDuration(crimeRemainingMs)
      : "1";

  const balanceClassicTopCards = [
    {
      key: "chat-level",
      size: "half",
      icon: "💬",
      label: levelTitles.chat,
      value: formatNumber(chatLevelData?.level || 1, locale, 0),
      suffix: "lvl",
      rank: chatLevelData?.rank ? `#${chatLevelData.rank}` : undefined,
      progress: chatLevelFill,
      accentColor: "rgba(101, 174, 236, 0.88)",
      background:
        "linear-gradient(180deg, rgba(134, 188, 232, 0.35), rgba(97, 142, 176, 0.24))",
    },
    {
      key: "voice-level",
      size: "half",
      icon: "🎤",
      label: levelTitles.voice,
      value: formatNumber(voiceLevelData?.level || 1, locale, 0),
      suffix: "lvl",
      rank: voiceLevelData?.rank ? `#${voiceLevelData.rank}` : undefined,
      progress: voiceLevelFill,
      accentColor: "rgba(118, 202, 212, 0.84)",
      background:
        "linear-gradient(180deg, rgba(144, 208, 212, 0.33), rgba(104, 146, 153, 0.22))",
    },
    {
      key: "gaming-level",
      size: "full",
      icon: "🎮",
      label: levelTitles.gaming,
      value: formatNumber(gameLevelData?.level || 1, locale, 0),
      suffix: "lvl",
      rank: gameLevelData?.rank ? `#${gameLevelData.rank}` : undefined,
      progress: gameLevelFill,
      accentColor: "rgba(118, 183, 112, 0.86)",
      background:
        "linear-gradient(180deg, rgba(129, 194, 115, 0.33), rgba(92, 141, 84, 0.24))",
    },
  ] satisfies Array<{
    key: string;
    size: "half" | "full";
    icon: string;
    label: string;
    value: string;
    suffix?: string;
    rank?: string;
    progress?: number;
    accentColor?: string;
    background?: string;
    valueTone?: string;
  }>;
  const balanceClassicQuickChips = [
    {
      key: "hint-cases",
      size: "half",
      icon: dailyCaseCard?.emoji || "🎁",
      value: caseHintValue,
      label: launcherData.strings.nav.cases || "Cases",
      variant: "icon",
      background:
        "linear-gradient(180deg, rgba(139, 132, 190, 0.42), rgba(104, 100, 143, 0.30))",
    },
    {
      key: "hint-upgrades",
      size: "half",
      icon: "🛠️",
      value: formatNumber(upgradesAffordable, locale, 0),
      label: launcherData.strings.nav.upgrades || "Shop",
      variant: "icon",
      background:
        "linear-gradient(180deg, rgba(129, 185, 118, 0.42), rgba(93, 137, 87, 0.30))",
    },
    {
      key: "hint-work",
      size: "half",
      icon: "🎮",
      value: workProgressLabel,
      label: launcherData.strings.common.dailyLeft || "Daily",
      variant: "icon",
      background:
        "linear-gradient(180deg, rgba(106, 170, 114, 0.42), rgba(78, 129, 86, 0.30))",
    },
    {
      key: "hint-crime",
      size: "half",
      icon: "🦹",
      value: crimeHintValue,
      label: "Crime",
      variant: "icon",
      background:
        "linear-gradient(180deg, rgba(164, 164, 164, 0.38), rgba(118, 118, 118, 0.26))",
    },
  ] satisfies Array<{
    key: string;
    size: "half" | "full";
    icon: string;
    label: string;
    value: string;
    variant?: "icon";
    background?: string;
    valueTone?: string;
  }>;
  const balanceFooterCards = launcherData.cases.dailyStatus
    ? [
        {
          key: "streak",
          label: launcherData.strings.common.streak || "Streak",
          value: formatNumber(launcherData.cases.dailyStatus.streak || 0, locale, 0),
          icon: "🔥",
        },
        {
          key: "multiplier",
          label: launcherData.strings.common.rewardMultiplier || "Reward Multiplier",
          value: `${formatNumber(
            launcherData.cases.dailyStatus.rewardMultiplier || 1,
            locale,
            2
          )}x`,
          icon: "✨",
        },
      ]
    : [];
  const balanceProfilePanel = {
    avatarUrl: launcherData.user.avatarUrl || launcherData.user.avatar || undefined,
    userId: launcherData.user.id || undefined,
    displayName: launcherData.user.displayName || launcherData.user.username || undefined,
    meta:
      launcherData.guild?.name ||
      (isReadOnly ? launcherData.strings.common.readOnly || "Read-only preview" : getLocaleTag(locale)),
    guildName: launcherData.guild?.name || undefined,
  };
  const balanceClassicMarriageBanner =
    isMarried
      ? {
          icon: "💍",
          dotColor: "rgba(27, 16, 14, 0.86)",
          label: getMarriedLabel(locale),
          value: marriageElapsed ? `(${marriageElapsed})` : "",
          background:
            "linear-gradient(90deg, rgba(215, 68, 58, 0.97), rgba(177, 36, 30, 0.90))",
          captionTone: "rgba(255, 210, 210, 0.78)",
        }
      : null;

  return {
    paletteStyle: createPaletteStyle(launcherData),
    projectedBalance,
    sectionProps: {
      layout: "classic",
      compact: shouldCompactBalance,
      eyebrow: launcherData.strings.nav.balance,
      title: launcherData.strings.balance.title || launcherData.strings.nav.balance,
      titleMeta: launcherData.user.displayName || launcherData.user.username || null,
      subtitle: null,
      profilePanel: balanceProfilePanel,
      classicTopCards: balanceClassicTopCards,
      classicQuickChips: balanceClassicQuickChips,
      classicBanner: null,
      classicMarriageBanner: balanceClassicMarriageBanner,
      coloring: createSectionColoring(launcherData),
      summaryCards: [],
      primaryCards: [
        {
          key: "wallet-card",
          icon: "💵",
          label: launcherData.strings.common.wallet || "Wallet",
          value: formatNumber(launcherData.balance.walletBalance, locale, 2),
          description: launcherData.strings.balance.withdrawHint,
          action: {
            label: "+",
            disabled: isReadOnly,
            onClick: () => onOpenMoneyModal("withdraw"),
          },
        },
        {
          key: "bank-card",
          icon: "🏦",
          label: launcherData.strings.common.bank || "Bank",
          value: formatNumber(projectedBalance.projectedTotalBankBalance, locale, 2),
          subvalue: `(${launcherData.strings.common.total || "Total"}: ${formatNumber(
            launcherData.balance.totalBankBalance,
            locale,
            2
          )})`,
          description: launcherData.strings.balance.depositHint,
          action: {
            label: "+",
            disabled: isReadOnly,
            onClick: () => onOpenMoneyModal("deposit"),
          },
          footerSegments: [
            {
              key: "annual-rate-segment",
              value: `${formatNumber(launcherData.balance.annualRatePercent, locale, 2)}%`,
              label: launcherData.strings.common.annualRate || "Rate",
              background: "rgba(87, 137, 78, 0.56)",
            },
            {
              key: "cycle-segment",
              value: projectedBalance.cycleComplete
                ? caseReadyLabel
                : `~${formatCompactDuration(balanceCycleRemainingMs)}`,
              label: launcherData.strings.balance.cycleTitle || "Cycle",
              background: "rgba(53, 51, 48, 0.58)",
            },
            {
              key: "gain-segment",
              value: `+${formatNumber(projectedGain, locale, 2)}`,
              label: launcherData.strings.balance.projectedTitle || "Projected",
              background: "rgba(111, 187, 70, 0.56)",
            },
          ],
          supportingItems: [
            {
              key: "annual-rate",
              label: launcherData.strings.common.annualRate || "Annual Rate",
              value: `${formatNumber(launcherData.balance.annualRatePercent, locale, 2)}%`,
              icon: "↗",
            },
          ],
        },
      ],
      metricCards: [
        {
          key: "annual-metric",
          label: launcherData.strings.common.annualRate || "Annual Rate",
          value: `${formatNumber(launcherData.balance.annualRatePercent, locale, 2)}%`,
          icon: "📈",
        },
        {
          key: "projected-metric",
          label: launcherData.strings.balance.projectedTitle || "Projected Total",
          value: formatNumber(projectedBalance.projectedTotalBankBalance, locale),
          icon: "✨",
        },
      ],
      progress: {
        label: launcherData.strings.balance.cycleTitle,
        value: `${formatNumber(projectedBalance.timeIntoCycleMs / 60000, locale, 0)}m / ${formatNumber(
          launcherData.balance.maxInactiveMs / 60000,
          locale,
          0
        )}m`,
        subtitle: launcherData.strings.common.liveGrowth,
        progress: projectedBalance.cycleProgress,
      },
      footerCards: balanceFooterCards,
    },
  };
}
