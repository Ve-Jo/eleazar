import type { CSSProperties } from "react";
import type { ActivityLauncherPayload } from "../../../../../../shared/src/contracts/hub.ts";
import type { CrateRevealState } from "../../../types/activityUi.ts";
import { buildCasesSectionProps } from "../../cases/buildCasesSectionProps.ts";
import { buildBalanceSectionProps } from "../../economy/buildBalanceSectionProps.ts";
import { buildGamesSectionProps } from "../../games/buildGamesSectionProps.ts";
import { buildLevelSectionProps } from "../../level/buildLevelSectionProps.ts";
import { buildUpgradesSectionProps } from "../../upgrades/buildUpgradesSectionProps.ts";
import type { MoneyMoveDirection } from "../../../lib/activityMath.ts";

export type LauncherActionModel = {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

export type LauncherStatModel = {
  key?: string;
  icon?: string;
  label: string;
  value: string;
  description?: string | null;
  background?: string;
  tone?: string;
};

export type LauncherProfileModel = {
  avatarUrl?: string;
  displayName?: string;
  guildName?: string;
  meta?: string;
  userId?: string;
};

export type LauncherBannerModel = {
  icon: string;
  label: string;
  value: string;
  background: string;
  dotColor?: string;
  captionTone?: string;
};

export type BalancePrimaryCardModel = LauncherStatModel & {
  action?: LauncherActionModel;
  supportingItems?: LauncherStatModel[];
};

export type BalanceSectionModel = {
  classicBanner?: LauncherBannerModel | null;
  classicMarriageBanner?: LauncherBannerModel | null;
  classicQuickChips?: Array<{
    key?: string;
    icon?: string;
    value: string;
    label: string;
    size?: "full" | "half";
    variant?: "icon";
    background?: string;
    valueTone?: string;
  }>;
  classicTopCards?: Array<
    LauncherStatModel & {
      suffix?: string;
      rank?: string;
      progress?: number;
      accentColor?: string;
      valueTone?: string;
    }
  >;
  layout?: "classic" | "default";
  compact?: boolean;
  coloring?: {
    textColor: string;
    secondaryTextColor: string;
    tertiaryTextColor: string;
    overlayBackground: string;
    accentColor: string;
    dominantColor: string;
  };
  eyebrow: string;
  title: string;
  titleMeta: string | null;
  profilePanel: LauncherProfileModel;
  banner: LauncherBannerModel | null;
  primaryCards: BalancePrimaryCardModel[];
  metricCards: LauncherStatModel[];
  progress: {
    label: string;
    value: string;
    subtitle: string | null;
    progress: number;
  };
  footerCards: LauncherStatModel[];
};

export type CasesCalendarDay = {
  id: string;
  display: string;
  opened: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isMuted: boolean;
};

export type CasesCalendarModel = {
  label: string;
  value: string;
  headline: string;
  subline: string;
  badgeIcon: string;
  badgeText: string;
  badgeTone: string;
  weekdays: string[];
  weeks: CasesCalendarDay[][];
  showTopFade: boolean;
  showBottomFade: boolean;
};

export type CasesCollectionCardModel = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  countLabel: string;
  isActive: boolean;
  disabled: boolean;
  onSelect: () => void;
};

export type CasesSectionModel = {
  compact?: boolean;
  coloring?: {
    textColor: string;
    secondaryTextColor: string;
    tertiaryTextColor: string;
    overlayBackground: string;
    accentColor: string;
    dominantColor: string;
  };
  eyebrow: string;
  title: string;
  subtitle: string;
  summaryCards: LauncherStatModel[];
  calendar: CasesCalendarModel | null;
  featuredCase: {
    kicker: string;
    title: string;
    description: string;
    emoji: string;
    countLabel: string;
    countValue: string;
    statusLabel: string;
    statusValue: string;
    statusTone: string;
    infoCards: LauncherStatModel[];
    action: LauncherActionModel;
  } | null;
  collectionTitle: string;
  collectionCountText: string;
  cases: CasesCollectionCardModel[];
  detailPanel: {
    title: string;
    subtitle: string;
    items: LauncherStatModel[];
    emptyText?: string;
  };
};

export type UpgradesCategoryModel = {
  id: string;
  label: string;
  isActive: boolean;
  onSelect: () => void;
};

export type UpgradesListItemModel = {
  id: string;
  title: string;
  emoji: string;
  levelLabel: string;
  priceLabel: string;
  statusLabel: string;
  statusTone: string;
  isActive: boolean;
  onSelect: () => void;
};

export type UpgradesSectionModel = {
  compact?: boolean;
  coloring?: {
    textColor: string;
    secondaryTextColor: string;
    tertiaryTextColor: string;
    overlayBackground: string;
    accentColor: string;
    dominantColor: string;
  };
  eyebrow: string;
  title: string;
  subtitle: string;
  summaryCards: LauncherStatModel[];
  featuredUpgrade: {
    kicker: string;
    title: string;
    subtitle: string;
    emoji: string;
    description: string;
    effectLabel: string;
    currentValue: string;
    nextValue: string;
    gainLabel: string;
    gainValue: string;
    gainTone: string;
    levelLabel: string;
    levelValue: string;
    levelHint: string;
    priceValue: string;
    progressPercent: number;
    progressText: string;
    progressTone: string;
    action: LauncherActionModel;
  } | null;
  categoriesTitle: string;
  categoriesHint: string;
  categories: UpgradesCategoryModel[];
  upgrades: UpgradesListItemModel[];
};

export type GamesCollectionCardModel = {
  id: string;
  title: string;
  emoji: string;
  meta: string;
  statusLabel: string;
  isActive: boolean;
  isMuted: boolean;
  onSelect: () => void;
};

export type GamesSectionModel = {
  compact?: boolean;
  coloring?: {
    textColor: string;
    secondaryTextColor: string;
    tertiaryTextColor: string;
    overlayBackground: string;
    accentColor: string;
    dominantColor: string;
  };
  eyebrow: string;
  title: string;
  subtitle: string;
  summaryCards: LauncherStatModel[];
  featuredGame: {
    kicker: string;
    title: string;
    subtitle: string;
    emoji: string;
    statusLabel: string;
    statusValue: string;
    statCards: LauncherStatModel[];
    progress: {
      label: string;
      value: string;
      percent: number;
    } | null;
    note: {
      label: string;
      text: string;
      color: string;
    };
    action: LauncherActionModel;
  } | null;
  collectionTitle: string;
  collectionCountText: string;
  collectionHintText: string;
  games: GamesCollectionCardModel[];
};

export type LevelSectionModel = {
  compact?: boolean;
  coloring?: {
    textColor: string;
    secondaryTextColor: string;
    tertiaryTextColor: string;
    overlayBackground: string;
    accentColor: string;
    dominantColor: string;
  };
  eyebrow: string;
  title: string;
  titleMeta: string | null;
  subtitle: string | null;
  profilePanel: LauncherProfileModel | null;
  seasonCard: {
    title: string;
    xpValue: string;
    countdownLabel: string;
  } | null;
  levelCards: Array<{
    key: string;
    icon: string;
    label: string;
    value: string;
    suffix: string;
    xpLabel: string;
    rank: string | null;
    progress: number;
    accentColor: string;
    background: string;
  }>;
  rolesTitle: string;
  rolesEmptyText: string;
  upcomingRoles: Array<{
    key: string;
    roleId: string;
    roleName: string;
    mode: string;
    modeLabel: string;
    requiredLevel: number;
    requiredLabel: string;
    progress: number;
    color: string;
  }>;
};

export type BalanceLauncherViewModel = {
  paletteStyle: CSSProperties;
  section: BalanceSectionModel;
};

export type LevelLauncherViewModel = {
  section: LevelSectionModel;
};

export type CasesLauncherViewModel = {
  focusedCrate: ReturnType<typeof buildCasesSectionProps>["focusedCrate"];
  section: CasesSectionModel;
};

export type UpgradesLauncherViewModel = {
  section: UpgradesSectionModel;
};

export type GamesLauncherViewModel = {
  highScore: number;
  section: GamesSectionModel;
};

type BuildLauncherViewModelsOptions = {
  crateReveal: CrateRevealState;
  focusedCrateType: string;
  focusedGameId: string;
  focusedUpgradeType: string;
  isReadOnly: boolean;
  launcherData: ActivityLauncherPayload;
  now: number;
  pendingCrateType: string | null;
  pendingUpgradeType: string | null;
  setFocusedCrateType: (type: string) => void;
  setFocusedGameId: (gameId: string) => void;
  setFocusedUpgradeType: (type: string) => void;
  shouldCompactBalance: boolean;
  shouldCompactPanels: boolean;
  onOpenCrate: (type: string) => void;
  onOpenMoneyModal: (direction: MoneyMoveDirection) => void;
  onPlay2048: () => void;
  onPurchaseUpgrade: (type: string) => void;
};

export function buildLauncherViewModels(options: BuildLauncherViewModelsOptions) {
  const balanceSource = buildBalanceSectionProps({
    launcherData: options.launcherData,
    isReadOnly: options.isReadOnly,
    now: options.now,
    onOpenMoneyModal: options.onOpenMoneyModal,
    shouldCompactBalance: options.shouldCompactBalance,
  });
  const casesSource = buildCasesSectionProps({
    crateReveal: options.crateReveal,
    focusedCrateType: options.focusedCrateType,
    isReadOnly: options.isReadOnly,
    launcherData: options.launcherData,
    pendingCrateType: options.pendingCrateType,
    setFocusedCrateType: options.setFocusedCrateType,
    shouldCompactPanels: options.shouldCompactPanels,
    onOpenCrate: options.onOpenCrate,
  });
  const upgradesSource = buildUpgradesSectionProps({
    focusedUpgradeType: options.focusedUpgradeType,
    isReadOnly: options.isReadOnly,
    launcherData: options.launcherData,
    pendingUpgradeType: options.pendingUpgradeType,
    setFocusedUpgradeType: options.setFocusedUpgradeType,
    shouldCompactPanels: options.shouldCompactPanels,
    onPurchaseUpgrade: options.onPurchaseUpgrade,
  });
  const gamesSource = buildGamesSectionProps({
    focusedGameId: options.focusedGameId,
    isReadOnly: options.isReadOnly,
    launcherData: options.launcherData,
    setFocusedGameId: options.setFocusedGameId,
    shouldCompactPanels: options.shouldCompactPanels,
    onPlay2048: options.onPlay2048,
  });
  const levelSource = buildLevelSectionProps({
    launcherData: options.launcherData,
    now: options.now,
    shouldCompactPanels: options.shouldCompactPanels,
    isReadOnly: options.isReadOnly,
  });
  const balanceProps = balanceSource.sectionProps;
  const levelProps = levelSource.sectionProps;
  const casesProps = casesSource.sectionProps;
  const upgradesProps = upgradesSource.sectionProps;
  const gamesProps = gamesSource.sectionProps;

  const balance: BalanceLauncherViewModel = {
    paletteStyle: balanceSource.paletteStyle,
    section: {
      layout: balanceProps.layout === "classic" ? "classic" : "default",
      compact: balanceProps.compact,
      coloring: balanceProps.coloring,
      classicTopCards: balanceProps.classicTopCards,
      classicQuickChips: balanceProps.classicQuickChips,
      classicBanner: balanceProps.classicBanner,
      classicMarriageBanner: balanceProps.classicMarriageBanner,
      eyebrow: balanceProps.eyebrow ?? "",
      title: balanceProps.title ?? "",
      titleMeta: balanceProps.titleMeta ?? null,
      profilePanel: balanceProps.profilePanel,
      banner: balanceProps.classicBanner,
      primaryCards: balanceProps.primaryCards,
      metricCards: balanceProps.metricCards,
      progress: {
        label: balanceProps.progress.label ?? "",
        value: balanceProps.progress.value,
        subtitle: balanceProps.progress.subtitle ?? null,
        progress: balanceProps.progress.progress,
      },
      footerCards: balanceProps.footerCards,
    },
  };
  const cases: CasesLauncherViewModel = {
    focusedCrate: casesSource.focusedCrate,
    section: {
      compact: casesProps.compact,
      coloring: casesProps.coloring,
      eyebrow: casesProps.eyebrow ?? "",
      title: casesProps.title ?? "",
      subtitle: casesProps.subtitle ?? "",
      summaryCards: casesProps.summaryCards,
      calendar: casesProps.calendar,
      featuredCase: casesProps.featuredCase
        ? {
            ...casesProps.featuredCase,
            kicker: casesProps.featuredCase.kicker ?? "",
          }
        : null,
      collectionTitle: casesProps.collectionTitle ?? "",
      collectionCountText: casesProps.collectionCountText ?? "",
      cases: casesProps.cases,
      detailPanel: {
        ...casesProps.detailPanel,
        title: casesProps.detailPanel.title ?? "",
      },
    },
  };
  const level: LevelLauncherViewModel = {
    section: {
      compact: levelProps.compact,
      coloring: levelProps.coloring,
      eyebrow: levelProps.eyebrow ?? "",
      title: levelProps.title ?? "",
      titleMeta: levelProps.titleMeta ?? null,
      subtitle: levelProps.subtitle ?? null,
      profilePanel: levelProps.profilePanel ?? null,
      seasonCard: levelProps.seasonCard ?? null,
      levelCards: levelProps.levelCards || [],
      rolesTitle: levelProps.rolesTitle ?? "",
      rolesEmptyText: levelProps.rolesEmptyText ?? "",
      upcomingRoles: (levelProps.upcomingRoles || []).map((role) => ({
        ...role,
        roleName: role.roleName || role.roleId,
      })),
    },
  };
  const upgrades: UpgradesLauncherViewModel = {
    section: {
      compact: upgradesProps.compact,
      coloring: upgradesProps.coloring,
      eyebrow: upgradesProps.eyebrow ?? "",
      title: upgradesProps.title ?? "",
      subtitle: upgradesProps.subtitle ?? "",
      summaryCards: upgradesProps.summaryCards,
      featuredUpgrade: upgradesProps.featuredUpgrade
        ? {
            ...upgradesProps.featuredUpgrade,
            kicker: upgradesProps.featuredUpgrade.kicker ?? "",
          }
        : null,
      categoriesTitle: upgradesProps.categoriesTitle ?? "",
      categoriesHint: upgradesProps.categoriesHint ?? "",
      categories: upgradesProps.categories,
      upgrades: upgradesProps.upgrades,
    },
  };
  const games: GamesLauncherViewModel = {
    highScore: gamesSource.highScore,
    section: {
      compact: gamesProps.compact,
      coloring: gamesProps.coloring,
      eyebrow: gamesProps.eyebrow ?? "",
      title: gamesProps.title ?? "",
      subtitle: gamesProps.subtitle ?? "",
      summaryCards: gamesProps.summaryCards,
      featuredGame: gamesProps.featuredGame
        ? {
            ...gamesProps.featuredGame,
            kicker: gamesProps.featuredGame.kicker ?? "",
            note: {
              ...gamesProps.featuredGame.note,
              label: gamesProps.featuredGame.note.label ?? "",
              text: gamesProps.featuredGame.note.text ?? "",
            },
          }
        : null,
      collectionTitle: gamesProps.collectionTitle ?? "",
      collectionCountText: gamesProps.collectionCountText ?? "",
      collectionHintText: gamesProps.collectionHintText ?? "",
      games: gamesProps.games,
    },
  };

  return {
    balance,
    cases,
    games,
    level,
    upgrades,
  };
}
