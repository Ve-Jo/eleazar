import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import { formatNumber, getUpgradeByType } from "../../lib/activityView.ts";
import { createSectionColoring } from "../launcher/lib/createSectionColoring.ts";

type BuildUpgradesSectionPropsOptions = {
  focusedUpgradeType: string;
  isReadOnly: boolean;
  launcherData: ActivityLauncherPayload;
  pendingUpgradeType: string | null;
  setFocusedUpgradeType: (type: string) => void;
  shouldCompactPanels: boolean;
  onPurchaseUpgrade: (type: string) => void;
};

export function buildUpgradesSectionProps({
  focusedUpgradeType,
  isReadOnly,
  launcherData,
  pendingUpgradeType,
  setFocusedUpgradeType,
  shouldCompactPanels,
  onPurchaseUpgrade,
}: BuildUpgradesSectionPropsOptions) {
  const locale = launcherData.locale;
  const focusedUpgrade =
    getUpgradeByType(launcherData, focusedUpgradeType) ||
    launcherData.upgrades.groups[0]?.items[0];
  const activeUpgradeGroup =
    launcherData.upgrades.groups.find((group) => group.key === focusedUpgrade?.category) ||
    launcherData.upgrades.groups[0];

  return {
    sectionProps: {
      compact: shouldCompactPanels,
      eyebrow: launcherData.strings.nav.upgrades,
      title: launcherData.strings.upgrades.title,
      subtitle: launcherData.strings.upgrades.focusTitle,
      coloring: createSectionColoring(launcherData),
      summaryCards: [
        {
          label: launcherData.strings.common.wallet,
          value: formatNumber(launcherData.balance.walletBalance, locale, 0),
        },
        {
          label: launcherData.strings.balance.discountTitle,
          value: `${formatNumber(launcherData.upgrades.discountPercent, locale, 0)}%`,
        },
      ],
      featuredUpgrade: focusedUpgrade
        ? {
            kicker: launcherData.strings.upgrades.focusTitle,
            title: focusedUpgrade.name,
            subtitle: `${focusedUpgrade.impactLabel} · ${activeUpgradeGroup?.title || ""}`,
            emoji: focusedUpgrade.emoji,
            description: focusedUpgrade.description,
            effectLabel: launcherData.strings.common.effectSummary,
            currentValue: focusedUpgrade.currentEffectLabel,
            nextValue: focusedUpgrade.nextEffectLabel,
            gainLabel: launcherData.strings.upgrades.gain,
            gainValue: `+${focusedUpgrade.deltaEffectLabel}`,
            gainTone: focusedUpgrade.isAffordable ? "positive" : "warning",
            levelLabel: launcherData.strings.upgrades.current,
            levelValue: `${launcherData.strings.common.levelShort} ${focusedUpgrade.currentLevel} → ${launcherData.strings.common.levelShort} ${focusedUpgrade.nextLevel}`,
            levelHint: launcherData.strings.upgrades.next,
            priceValue: `${formatNumber(focusedUpgrade.price, locale, 0)} 💵`,
            progressPercent: Math.max(
              0,
              Math.min(
                100,
                focusedUpgrade.price > 0
                  ? Math.round((launcherData.balance.walletBalance / focusedUpgrade.price) * 100)
                  : 0
              )
            ),
            progressText: focusedUpgrade.isAffordable
              ? launcherData.strings.upgrades.buyNow
              : `${launcherData.strings.upgrades.needMore} ${formatNumber(
                  focusedUpgrade.coinsNeeded,
                  locale,
                  0
                )}`,
            progressTone: focusedUpgrade.isAffordable ? "positive" : "warning",
            action: {
              label:
                pendingUpgradeType === focusedUpgrade.type
                  ? "..."
                  : launcherData.strings.upgrades.purchaseButton || launcherData.strings.upgrades.buyNow,
              disabled:
                isReadOnly ||
                !focusedUpgrade.isAffordable ||
                pendingUpgradeType === focusedUpgrade.type,
              onClick: () => onPurchaseUpgrade(focusedUpgrade.type),
            },
          }
        : null,
      categoriesTitle: activeUpgradeGroup?.title || launcherData.strings.nav.upgrades,
      categoriesHint: `${formatNumber(activeUpgradeGroup?.items.length || 0, locale, 0)} ${launcherData.strings.common.items}`,
      categories: launcherData.upgrades.groups.map((group) => ({
        id: group.key,
        label: group.title,
        isActive: group.key === activeUpgradeGroup?.key,
        onSelect: () => setFocusedUpgradeType(group.items[0]?.type || focusedUpgradeType),
      })),
      upgrades: (activeUpgradeGroup?.items || []).map((upgrade) => ({
        id: upgrade.type,
        title: upgrade.name,
        emoji: upgrade.emoji,
        levelLabel: `${launcherData.strings.common.levelShort} ${upgrade.currentLevel}`,
        priceLabel: `${formatNumber(upgrade.price, locale, 0)} 💵`,
        statusLabel: upgrade.isAffordable
          ? launcherData.strings.upgrades.buyNow
          : launcherData.strings.upgrades.needMore,
        statusTone: upgrade.isAffordable
          ? "#8ff0b7"
          : launcherData.palette.tertiaryTextColor,
        isActive: upgrade.type === focusedUpgrade?.type,
        onSelect: () => setFocusedUpgradeType(upgrade.type),
      })),
    },
  };
}
