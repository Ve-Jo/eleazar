import type { CSSProperties, MutableRefObject, ReactNode, RefObject } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";

import type { ActivityLauncherPayload } from "../../../../../../shared/src/contracts/hub.ts";
import MoneyModal from "../../../components/MoneyModal.tsx";
import UiIcon from "../../../components/UiIcon.tsx";
import type { ActivitySection } from "../../../lib/activityConstants.ts";
import type {
  LayoutDebugSnapshot,
  MoneyModalState,
  NoticeState,
  SetupDiagnostics,
} from "../../../types/activityUi.ts";
import ActivityDebugPanel from "../../debug/ActivityDebugPanel.tsx";
import {
  type BalanceSectionModel,
  type CasesSectionModel,
  type GamesSectionModel,
  type LevelSectionModel,
  type UpgradesSectionModel,
} from "../lib/buildLauncherViewModels.ts";
import {
  LAUNCHER_DOCK_TRANSITION,
  LAUNCHER_INDICATOR_TRANSITION,
  LAUNCHER_NOTICE_TRANSITION,
  LAUNCHER_SCENE_TRANSITION,
} from "../lib/launcherMotion.ts";
import BalanceLauncherSection from "../sections/BalanceLauncherSection.tsx";
import CasesLauncherSection from "../sections/CasesLauncherSection.tsx";
import GamesLauncherSection from "../sections/GamesLauncherSection.tsx";
import LevelLauncherSection from "../sections/LevelLauncherSection.tsx";
import UpgradesLauncherSection from "../sections/UpgradesLauncherSection.tsx";
import type { LauncherMotionState } from "../hooks/useLauncherCarousel.ts";

type LauncherSceneProps = {
  activeDiagnostics: SetupDiagnostics;
  activeSection: ActivitySection;
  adaptiveFitProgress: number;
  balanceSection: BalanceSectionModel;
  levelSection: LevelSectionModel;
  carouselRef: RefObject<HTMLDivElement | null>;
  casesSection: CasesSectionModel;
  collapseNavDock: () => void;
  debugLayout: LayoutDebugSnapshot | null;
  gamesSection: GamesSectionModel;
  isCarouselSettled: boolean;
  isNavExpanded: boolean;
  jumpToSection: (section: ActivitySection) => void;
  launcherData: ActivityLauncherPayload;
  launcherShellRef: RefObject<HTMLDivElement | null>;
  launcherStyle: CSSProperties;
  localeTag: string;
  moneyModal: MoneyModalState;
  motionState: LauncherMotionState;
  navRef: RefObject<HTMLElement | null>;
  notice: NoticeState;
  onCloseMoneyModal: () => void;
  onMoneyInputChange: (value: string) => void;
  onMoneyPresetSelect: (value: number) => void;
  onMoneySubmit: () => void;
  openNavDock: () => void;
  scheduleNavDockCollapse: (delay?: number) => void;
  sectionRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  setupError: string | null;
  shouldCompactBalance: boolean;
  shouldCompactPanels: boolean;
  showDebugPanel: boolean;
  upgradesSection: UpgradesSectionModel;
};

type SectionCardProps = {
  activeSection: ActivitySection;
  children: ReactNode;
  isCarouselSettled: boolean;
  section: ActivitySection;
  sectionFocus: number;
  sectionRefs: MutableRefObject<Record<string, HTMLElement | null>>;
};

function SectionCard({
  activeSection,
  children,
  isCarouselSettled,
  section,
  sectionFocus,
  sectionRefs,
}: SectionCardProps) {
  const focus = Math.max(0, Math.min(sectionFocus, 1));
  const isActive = activeSection === section;

  return (
    <section
      className={`section-card ${isActive ? "is-active" : "is-inactive"} ${isCarouselSettled ? "is-scroll-ready" : "is-scroll-locked"}`}
      ref={(node) => {
        sectionRefs.current[section] = node;
      }}
      style={
        {
          "--section-focus": focus.toFixed(3),
          "--section-distance": (1 - focus).toFixed(3),
        } as CSSProperties
      }
    >
      <div className="section-content">{children}</div>
    </section>
  );
}

const SECTION_ICON_BY_ID: Record<ActivitySection, "wallet" | "level" | "gift" | "spark" | "gamepad"> = {
  balance: "wallet",
  level: "level",
  cases: "gift",
  upgrades: "spark",
  games: "gamepad",
};

export default function LauncherScene({
  activeDiagnostics,
  activeSection,
  adaptiveFitProgress,
  balanceSection,
  levelSection,
  carouselRef,
  casesSection,
  collapseNavDock,
  debugLayout,
  gamesSection,
  isCarouselSettled,
  isNavExpanded,
  jumpToSection,
  launcherData,
  launcherShellRef,
  launcherStyle,
  localeTag,
  moneyModal,
  motionState,
  navRef,
  notice,
  onCloseMoneyModal,
  onMoneyInputChange,
  onMoneyPresetSelect,
  onMoneySubmit,
  openNavDock,
  scheduleNavDockCollapse,
  sectionRefs,
  setupError,
  shouldCompactBalance,
  shouldCompactPanels,
  showDebugPanel,
  upgradesSection,
}: LauncherSceneProps) {
  const prefersReducedMotion = useReducedMotion();
  const navSections = ["balance", "level", "cases", "upgrades", "games"] as ActivitySection[];
  const activeSectionLabel = launcherData.strings.nav[activeSection];
  const shellTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : LAUNCHER_SCENE_TRANSITION;
  const dockTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : LAUNCHER_DOCK_TRANSITION;
  const indicatorTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : LAUNCHER_INDICATOR_TRANSITION;
  const noticeTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : LAUNCHER_NOTICE_TRANSITION;

  return (
    <motion.div
      className="screen launcher-shell"
      style={launcherStyle}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shellTransition}
    >
      <div className="ambient-layer" />
      <div ref={launcherShellRef} className="launcher-frame" data-launcher-page-zone="chrome">
        <LayoutGroup id="launcher-section-dock">
          <motion.nav
            ref={navRef}
            className={`section-nav ${isNavExpanded ? "is-expanded" : "is-collapsed"} ${motionState.phase !== "idle" ? "is-engaged" : ""}`}
            onPointerEnter={() => openNavDock()}
            onPointerLeave={() => scheduleNavDockCollapse(280)}
            onFocusCapture={() => openNavDock()}
            onBlurCapture={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && (event.currentTarget as HTMLElement).contains(nextTarget)) {
                return;
              }

              scheduleNavDockCollapse(220);
            }}
            transition={dockTransition}
            data-launcher-page-zone="chrome"
          >
            <button
              type="button"
              className={`section-nav-summary ${isNavExpanded ? "is-expanded" : "is-collapsed"}`}
              aria-expanded={isNavExpanded}
              aria-label={
                isNavExpanded
                  ? launcherData.strings.nav.collapseNavigation
                  : launcherData.strings.nav.expandNavigation
              }
              onClick={() => {
                if (isNavExpanded) {
                  collapseNavDock();
                } else {
                  openNavDock();
                }
              }}
              data-launcher-page-zone="interactive"
            >
              {!isNavExpanded ? (
                <motion.span
                  layoutId="section-nav-active-indicator"
                  className="section-nav-active-indicator section-nav-active-indicator-summary"
                  transition={indicatorTransition}
                />
              ) : null}
              <span className="section-nav-summary-icon" aria-hidden="true">
                <UiIcon name={SECTION_ICON_BY_ID[activeSection]} size={14} />
              </span>
              <span className="section-nav-summary-text">{activeSectionLabel}</span>
              <span className="section-nav-summary-chevron" aria-hidden="true">
                <UiIcon name={isNavExpanded ? "chevron-up" : "chevron-down"} size={14} />
              </span>
            </button>

            <div className="section-nav-track-shell">
              <div className="section-nav-track">
                {navSections.map((section) => {
                  const label = launcherData.strings.nav[section];
                  const isActive = activeSection === section;

                  return (
                    <button
                      key={section}
                      type="button"
                      className={`section-chip ${isActive ? "is-active" : ""}`}
                      onClick={() => jumpToSection(section)}
                      data-launcher-page-zone="interactive"
                    >
                      {isNavExpanded && isActive ? (
                        <motion.span
                          layoutId="section-nav-active-indicator"
                          className="section-nav-active-indicator"
                          transition={indicatorTransition}
                        />
                      ) : null}
                      <span className="section-chip-icon" aria-hidden="true">
                        <UiIcon name={SECTION_ICON_BY_ID[section]} size={13} />
                      </span>
                      <span className="section-chip-label">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.nav>
        </LayoutGroup>

        {setupError ? <div className="notice warning">{setupError}</div> : null}
        {launcherData.unsupportedReason ? (
          <div className="notice warning">{launcherData.unsupportedReason}</div>
        ) : null}

        <AnimatePresence mode="wait">
          {notice ? (
            <motion.div
              key={`${notice.kind}:${notice.message}`}
              className={`notice ${notice.kind}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={noticeTransition}
            >
              {notice.message}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="carousel-shell" ref={carouselRef}>
          <SectionCard
            activeSection={activeSection}
            isCarouselSettled={isCarouselSettled}
            section="balance"
            sectionFocus={motionState.sectionFocus.balance}
            sectionRefs={sectionRefs}
          >
            <BalanceLauncherSection model={balanceSection} />
          </SectionCard>

          <SectionCard
            activeSection={activeSection}
            isCarouselSettled={isCarouselSettled}
            section="level"
            sectionFocus={motionState.sectionFocus.level}
            sectionRefs={sectionRefs}
          >
            <LevelLauncherSection model={levelSection} />
          </SectionCard>

          <SectionCard
            activeSection={activeSection}
            isCarouselSettled={isCarouselSettled}
            section="cases"
            sectionFocus={motionState.sectionFocus.cases}
            sectionRefs={sectionRefs}
          >
            <CasesLauncherSection model={casesSection} />
          </SectionCard>

          <SectionCard
            activeSection={activeSection}
            isCarouselSettled={isCarouselSettled}
            section="upgrades"
            sectionFocus={motionState.sectionFocus.upgrades}
            sectionRefs={sectionRefs}
          >
            <UpgradesLauncherSection model={upgradesSection} />
          </SectionCard>

          <SectionCard
            activeSection={activeSection}
            isCarouselSettled={isCarouselSettled}
            section="games"
            sectionFocus={motionState.sectionFocus.games}
            sectionRefs={sectionRefs}
          >
            <GamesLauncherSection model={gamesSection} />
          </SectionCard>
        </div>
      </div>

      <AnimatePresence>
        {moneyModal.open ? (
          <MoneyModal
            launcherData={launcherData}
            state={moneyModal}
            onClose={onCloseMoneyModal}
            onInputChange={onMoneyInputChange}
            onPresetSelect={onMoneyPresetSelect}
            onSubmit={onMoneySubmit}
          />
        ) : null}
      </AnimatePresence>

      {showDebugPanel ? (
        <ActivityDebugPanel
          activeDiagnostics={activeDiagnostics}
          activeSection={activeSection}
          adaptiveFitProgress={adaptiveFitProgress}
          layoutDebug={debugLayout}
          localeTag={localeTag}
          shouldCompactBalance={shouldCompactBalance}
          shouldCompactPanels={shouldCompactPanels}
        />
      ) : null}
    </motion.div>
  );
}
