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
      title: launcherData.strings.upgrades.title || launcherData.strings.nav.upgrades,
      subtitle: launcherData.strings.upgrades.focusTitle || launcherData.strings.nav.upgrades,
      coloring: createSectionColoring(launcherData),
      summaryCards: [
        {
          label: launcherData.strings.common.wallet || "Wallet",
          value: formatNumber(launcherData.balance.walletBalance, locale, 0),
        },
        {
          label: launcherData.strings.balance.discountTitle || "Upgrade Discount",
          value: `${formatNumber(launcherData.upgrades.discountPercent, locale, 0)}%`,
        },
      ],
      featuredUpgrade: focusedUpgrade
        ? {
            kicker:
              launcherData.strings.upgrades.focusTitle ||
              launcherData.strings.nav.upgrades,
            title: focusedUpgrade.name,
            subtitle: `${focusedUpgrade.impactLabel} · ${activeUpgradeGroup?.title || ""}`,
            emoji: focusedUpgrade.emoji,
            description: focusedUpgrade.description,
            effectLabel: "Effect summary",
            currentValue: focusedUpgrade.currentEffectLabel,
            nextValue: focusedUpgrade.nextEffectLabel,
            gainLabel: launcherData.strings.upgrades.gain || "Gain",
            gainValue: `+${focusedUpgrade.deltaEffectLabel}`,
            gainTone: focusedUpgrade.isAffordable ? "positive" : "warning",
            levelLabel: launcherData.strings.upgrades.current || "Current",
            levelValue: `L${focusedUpgrade.currentLevel} → L${focusedUpgrade.nextLevel}`,
            levelHint: launcherData.strings.upgrades.next || "Next",
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
              ? launcherData.strings.upgrades.buyNow || "Buy now"
              : `${launcherData.strings.upgrades.needMore || "Need"} ${formatNumber(
                  focusedUpgrade.coinsNeeded,
                  locale,
                  0
                )}`,
            progressTone: focusedUpgrade.isAffordable ? "positive" : "warning",
            action: {
              label:
                pendingUpgradeType === focusedUpgrade.type
                  ? "..."
                  : launcherData.strings.upgrades.purchaseButton ||
                    launcherData.strings.upgrades.buyNow ||
                    "Purchase",
              disabled:
                isReadOnly ||
                !focusedUpgrade.isAffordable ||
                pendingUpgradeType === focusedUpgrade.type,
              onClick: () => onPurchaseUpgrade(focusedUpgrade.type),
            },
          }
        : null,
      categoriesTitle: activeUpgradeGroup?.title || launcherData.strings.nav.upgrades,
      categoriesHint: `${formatNumber(activeUpgradeGroup?.items.length || 0, locale, 0)} items`,
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
        levelLabel: `LVL ${upgrade.currentLevel}`,
        priceLabel: `${formatNumber(upgrade.price, locale, 0)} 💵`,
        statusLabel: upgrade.isAffordable
          ? launcherData.strings.upgrades.buyNow || "Buy now"
          : launcherData.strings.upgrades.needMore || "Need more",
        statusTone: upgrade.isAffordable
          ? "#8ff0b7"
          : launcherData.palette.tertiaryTextColor,
        isActive: upgrade.type === focusedUpgrade?.type,
        onSelect: () => setFocusedUpgradeType(upgrade.type),
      })),
    },
  };
}
