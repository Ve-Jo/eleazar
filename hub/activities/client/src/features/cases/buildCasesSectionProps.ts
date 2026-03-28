import type { ActivityLauncherPayload } from "../../../../../shared/src/contracts/hub.ts";
import {
  buildCasesCalendarPresentation,
  formatNumber,
  getCrateByType,
  getRewardEntries,
} from "../../lib/activityView.ts";
import type { CrateRevealState } from "../../types/activityUi.ts";
import { createSectionColoring } from "../launcher/lib/createSectionColoring.ts";

type BuildCasesSectionPropsOptions = {
  crateReveal: CrateRevealState;
  focusedCrateType: string;
  isReadOnly: boolean;
  launcherData: ActivityLauncherPayload;
  pendingCrateType: string | null;
  setFocusedCrateType: (type: string) => void;
  shouldCompactPanels: boolean;
  onOpenCrate: (type: string) => void;
};

export function buildCasesSectionProps({
  crateReveal,
  focusedCrateType,
  isReadOnly,
  launcherData,
  pendingCrateType,
  setFocusedCrateType,
  shouldCompactPanels,
  onOpenCrate,
}: BuildCasesSectionPropsOptions) {
  const locale = launcherData.locale;
  const availableCasesCount = launcherData.cases.cards.filter((crate) => crate.available).length;
  const focusedCrate =
    getCrateByType(launcherData, focusedCrateType) ||
    launcherData.cases.cards.find((crate) => crate.available) ||
    launcherData.cases.cards[0];
  const casesCalendar = buildCasesCalendarPresentation(locale, launcherData.cases.dailyStatus, {
    monthStatus: launcherData.strings.cases.monthlyCalendar,
    streak: launcherData.strings.common.streak,
    rewardMultiplier: launcherData.strings.common.rewardMultiplier,
    dailyReady: launcherData.strings.cases.readyNow,
  });

  return {
    focusedCrate,
    sectionProps: {
      compact: shouldCompactPanels,
      eyebrow: launcherData.strings.nav.cases,
      title: launcherData.strings.cases.title,
      subtitle: launcherData.strings.cases.rewardTitle,
      coloring: createSectionColoring(launcherData),
      summaryCards: [
        {
          label: launcherData.strings.common.available,
          value: formatNumber(availableCasesCount, locale, 0),
        },
        {
          label: launcherData.strings.common.streak,
          value: formatNumber(launcherData.cases.dailyStatus?.streak || 0, locale, 0),
        },
      ],
      calendar: casesCalendar,
      featuredCase: focusedCrate
        ? {
            kicker: launcherData.strings.cases.rewardTitle,
            title: focusedCrate.name,
            description: focusedCrate.description,
            emoji: focusedCrate.emoji,
            countLabel: launcherData.strings.common.available,
            countValue: formatNumber(focusedCrate.count, locale, 0),
            statusLabel: launcherData.strings.cases.openButton,
            statusValue: focusedCrate.statusLabel,
            statusTone: focusedCrate.available ? "ready" : "cooldown",
            infoCards: [
              {
                icon: "💵",
                label: launcherData.strings.common.coins,
                value: `${formatNumber(
                  focusedCrate.rewardPreview.minCoins,
                  locale,
                  0
                )} - ${formatNumber(focusedCrate.rewardPreview.maxCoins, locale, 0)}`,
              },
              {
                icon: "✨",
                label: launcherData.strings.common.xpDiscount,
                value: `${formatNumber(
                  focusedCrate.rewardPreview.seasonXpAmount,
                  locale,
                  0
                )} / ${formatNumber(focusedCrate.rewardPreview.discountAmount, locale, 0)}%`,
              },
            ],
            action: {
              label:
                pendingCrateType === focusedCrate.type
                  ? "..."
                  : launcherData.strings.cases.openButton,
              disabled:
                isReadOnly ||
                !focusedCrate.available ||
                pendingCrateType === focusedCrate.type,
              onClick: () => onOpenCrate(focusedCrate.type),
            },
          }
        : null,
      collectionTitle: launcherData.strings.cases.title,
      collectionCountText: `${formatNumber(launcherData.cases.totalCount, locale, 0)} ${launcherData.strings.common.totalSuffix}`,
      cases: launcherData.cases.cards.map((crate) => ({
        id: crate.type,
        title: crate.name,
        subtitle: crate.available
          ? launcherData.strings.cases.readyNow
          : crate.statusLabel,
        emoji: crate.emoji,
        countLabel: formatNumber(crate.count, locale, 0),
        isActive: crate.type === focusedCrate?.type,
        disabled: isReadOnly,
        onSelect: () => setFocusedCrateType(crate.type),
      })),
      detailPanel: {
        title: crateReveal
          ? launcherData.strings.cases.rewardTitle
          : launcherData.strings.cases.title,
        subtitle: crateReveal ? crateReveal.type : focusedCrate?.name || "",
        items: crateReveal
          ? getRewardEntries(crateReveal.reward, locale, launcherData).map((entry) => ({
              icon: entry.emoji,
              label: entry.label,
              value: entry.value,
            }))
          : focusedCrate
          ? [
              {
                icon: "💵",
                label: launcherData.strings.common.coins,
                value: `${formatNumber(
                  focusedCrate.rewardPreview.minCoins,
                  locale,
                  0
                )} - ${formatNumber(focusedCrate.rewardPreview.maxCoins, locale, 0)}`,
              },
              {
                icon: "✨",
                label: launcherData.strings.common.seasonXp,
                value: `+${formatNumber(focusedCrate.rewardPreview.seasonXpAmount, locale, 0)}`,
              },
              {
                icon: "🏷️",
                label: launcherData.strings.common.discount,
                value: `${formatNumber(focusedCrate.rewardPreview.discountAmount, locale, 0)}%`,
              },
            ]
          : [],
        emptyText: launcherData.strings.cases.noCratesAvailable,
      },
    },
  };
}
