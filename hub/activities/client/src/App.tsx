import type { CSSProperties } from "react";
import { motion } from "motion/react";

import Game2048Scene from "./components/Game2048Scene.tsx";
import { useActivityBootstrap } from "./features/bootstrap/useActivityBootstrap.ts";
import { useLayoutDebug } from "./features/debug/useLayoutDebug.ts";
import { useMoneyModalController } from "./features/economy/useMoneyModalController.ts";
import { useGame2048Controller } from "./features/games/2048/useGame2048Controller.ts";
import LauncherScene from "./features/launcher/components/LauncherScene.tsx";
import { useActivityLauncherData } from "./features/launcher/hooks/useActivityLauncherData.ts";
import { useLauncherActions } from "./features/launcher/hooks/useLauncherActions.ts";
import { useLauncherCarousel } from "./features/launcher/hooks/useLauncherCarousel.ts";
import { useLauncherSelections } from "./features/launcher/hooks/useLauncherSelections.ts";
import { useLauncherViewport } from "./features/launcher/hooks/useLauncherViewport.ts";
import { LAUNCHER_SCENE_TRANSITION } from "./features/launcher/lib/launcherMotion.ts";
import { buildLauncherViewModels } from "./features/launcher/lib/buildLauncherViewModels.ts";
import ActivityStatusScreen from "./features/shared/ActivityStatusScreen.tsx";
import { useNowTicker } from "./features/shared/useNowTicker.ts";
import { getLocaleTag } from "./lib/activityView.ts";
import { useActivityUiStore } from "./store/activityUiStore.ts";

export function App() {
  const { diagnostics, setup, showDebugPanel } = useActivityBootstrap();
  const activeScene = useActivityUiStore((state) => state.activeScene);
  const setActiveScene = useActivityUiStore((state) => state.setActiveScene);
  const viewport = useLauncherViewport();
  const now = useNowTicker();
  const launcher = useActivityLauncherData(setup);
  const selections = useLauncherSelections(launcher.launcherData);
  const launcherActions = useLauncherActions({
    launcherData: launcher.launcherData,
    performMutation: launcher.performMutation,
  });
  const moneyModal = useMoneyModalController({
    launcherData: launcher.launcherData,
    performMutation: launcher.performMutation,
    onNotice: launcherActions.setNotice,
  });
  const carousel = useLauncherCarousel({
    blocked: moneyModal.moneyModal.open,
  });
  const game2048 = useGame2048Controller({
    activeScene,
    auth: setup.auth,
    refreshLauncher: launcher.refreshLauncher,
    setActiveScene,
  });

  const layoutDebug = useLayoutDebug({
    activeScene,
    activeSection: carousel.activeSection,
    isNavExpanded: carousel.isNavExpanded,
    launcherHeightScale: viewport.launcherHeightScale,
    notice: launcherActions.notice,
    setupError: setup.error,
    viewport: viewport.viewport,
    showDebugPanel,
    launcherShellRef: carousel.launcherShellRef,
    carouselRef: carousel.carouselRef,
    motionState: carousel.motionState,
    navRef: carousel.navRef,
    sectionRefs: carousel.sectionRefs,
  });

  const launcherQueryError =
    launcher.launcherQuery.error instanceof Error ? launcher.launcherQuery.error.message : null;

  if (setup.loading || (launcher.launcherQuery.isPending && !launcher.launcherData)) {
    return <ActivityStatusScreen message="Loading Activity..." />;
  }

  if ((setup.error || launcherQueryError) && !launcher.launcherData) {
    const activeDiagnostics = setup.diagnostics || diagnostics;
    return (
      <ActivityStatusScreen
        className="error"
        message={setup.error || launcherQueryError || "Failed to load launcher."}
        meta={
          activeDiagnostics
            ? `${activeDiagnostics.clientId || "missing"} · ${activeDiagnostics.guildId || "missing"}`
            : null
        }
      />
    );
  }

  if (!launcher.launcherData) {
    return <ActivityStatusScreen className="error" message="Failed to load launcher." />;
  }

  const activeDiagnostics = setup.diagnostics || diagnostics;
  const isReadOnly = launcher.launcherData.readOnly;
  const localeTag = getLocaleTag(launcher.launcherData.locale);
  const viewModels = buildLauncherViewModels({
    crateReveal: launcherActions.crateReveal,
    focusedCrateType: selections.focusedCrateType,
    focusedGameId: selections.focusedGameId,
    focusedUpgradeType: selections.focusedUpgradeType,
    isReadOnly,
    launcherData: launcher.launcherData,
    now,
    pendingCrateType: launcherActions.pendingCrateType,
    pendingUpgradeType: launcherActions.pendingUpgradeType,
    setFocusedCrateType: selections.setFocusedCrateType,
    setFocusedGameId: selections.setFocusedGameId,
    setFocusedUpgradeType: selections.setFocusedUpgradeType,
    shouldCompactBalance: viewport.shouldCompactBalance,
    shouldCompactPanels: viewport.shouldCompactPanels,
    onOpenCrate: launcherActions.openCrate,
    onOpenMoneyModal: moneyModal.openMoneyModal,
    onPlay2048: game2048.startGame2048,
    onPurchaseUpgrade: launcherActions.purchaseUpgrade,
  });
  const paletteStyle = viewModels.balance.paletteStyle;
  const launcherStyle = {
    ...paletteStyle,
    ...viewport.launcherStyle,
  } as CSSProperties;

  if (activeScene === "2048" && game2048.gameState) {
    return (
      <motion.div
        className="screen"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={LAUNCHER_SCENE_TRANSITION}
      >
        <Game2048Scene
          launcherData={launcher.launcherData}
          gameState={game2048.gameState}
          locale={launcher.launcherData.locale}
          paletteStyle={paletteStyle}
          highScore={viewModels.games.highScore}
          networkError={game2048.networkError}
          onBack={game2048.backToLauncher}
          onMove={game2048.applyDirection}
          onStopAndSubmit={() => void game2048.completeCurrentGame()}
        />
      </motion.div>
    );
  }

  return (
    <LauncherScene
      activeDiagnostics={activeDiagnostics}
      activeSection={carousel.activeSection}
      adaptiveFitProgress={viewport.adaptiveFitProgress}
      balanceSection={viewModels.balance.section}
      carouselRef={carousel.carouselRef}
      casesSection={viewModels.cases.section}
      collapseNavDock={carousel.collapseNavDock}
      debugLayout={layoutDebug}
      gamesSection={viewModels.games.section}
      isCarouselSettled={carousel.isCarouselSettled}
      isNavExpanded={carousel.isNavExpanded}
      jumpToSection={carousel.jumpToSection}
      launcherData={launcher.launcherData}
      launcherShellRef={carousel.launcherShellRef}
      launcherStyle={launcherStyle}
      localeTag={localeTag}
      moneyModal={moneyModal.moneyModal}
      motionState={carousel.motionState}
      navRef={carousel.navRef}
      notice={launcherActions.notice}
      onCloseMoneyModal={moneyModal.closeMoneyModal}
      onMoneyInputChange={moneyModal.setMoneyInput}
      onMoneyPresetSelect={moneyModal.setMoneyPreset}
      onMoneySubmit={() => void moneyModal.submitMoneyMove()}
      openNavDock={carousel.openNavDock}
      scheduleNavDockCollapse={carousel.scheduleNavDockCollapse}
      sectionRefs={carousel.sectionRefs}
      setupError={setup.error}
      shouldCompactBalance={viewport.shouldCompactBalance}
      shouldCompactPanels={viewport.shouldCompactPanels}
      showDebugPanel={showDebugPanel}
      upgradesSection={viewModels.upgrades.section}
    />
  );
}
