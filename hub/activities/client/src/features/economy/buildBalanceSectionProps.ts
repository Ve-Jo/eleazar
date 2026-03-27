import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import { projectBankSnapshot, type MoneyMoveDirection } from "../../lib/activityMath.ts";
import {
  createPaletteStyle,
  formatCooldownClock,
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
  const balanceClassicBanner = {
    icon: isReadOnly ? "🔒" : projectedBalance.cycleComplete ? "✅" : "🏦",
    dotColor: "rgba(24, 22, 20, 0.82)",
    label: isReadOnly
      ? launcherData.strings.common.readOnly || "Read-only preview"
      : launcherData.strings.common.liveGrowth || "Live bank growth",
    value: isReadOnly
      ? launcherData.guild?.name || getLocaleTag(locale)
      : projectedBalance.cycleComplete
      ? "done"
      : formatCooldownClock(balanceCycleRemainingMs),
    background: isReadOnly
      ? "linear-gradient(90deg, rgba(108, 108, 116, 0.94), rgba(77, 77, 83, 0.82))"
      : projectedBalance.cycleComplete
      ? "linear-gradient(90deg, rgba(104, 130, 115, 0.94), rgba(74, 98, 84, 0.82))"
      : "linear-gradient(90deg, rgba(216, 65, 55, 0.94), rgba(181, 42, 37, 0.82))",
    captionTone: "rgba(255,255,255,0.54)",
  };

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
      classicBanner: balanceClassicBanner,
      coloring: createSectionColoring(launcherData),
      summaryCards: [],
      primaryCards: [
        {
          key: "wallet-card",
          icon: "💵",
          label: launcherData.strings.common.wallet || "Wallet",
          value: formatNumber(launcherData.balance.walletBalance, locale),
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
          value: formatNumber(projectedBalance.projectedTotalBankBalance, locale),
          description: launcherData.strings.balance.depositHint,
          action: {
            label: "+",
            disabled: isReadOnly,
            onClick: () => onOpenMoneyModal("deposit"),
          },
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
        {
          key: "discount-metric",
          label: launcherData.strings.balance.discountTitle || "Upgrade Discount",
          value: `${formatNumber(launcherData.balance.upgradeDiscount, locale, 0)}%`,
          icon: "🛍️",
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
