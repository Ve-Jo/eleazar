import { useEffect, useState, type RefObject } from "react";

import { parseNumericCssValue } from "../launcher/lib/layoutMath.ts";
import type { LauncherMotionState } from "../launcher/hooks/useLauncherCarousel.ts";
import type {
  ActivityScene,
  LayoutDebugSnapshot,
  NoticeState,
  ViewportState,
} from "../../types/activityUi.ts";
import type { ActivitySection } from "../../lib/activityConstants.ts";

type UseLayoutDebugOptions = {
  activeScene: ActivityScene;
  activeSection: ActivitySection;
  isNavExpanded: boolean;
  launcherHeightScale: number;
  notice: NoticeState;
  setupError: string | null;
  viewport: ViewportState;
  showDebugPanel: boolean;
  launcherShellRef: RefObject<HTMLDivElement | null>;
  carouselRef: RefObject<HTMLDivElement | null>;
  motionState: LauncherMotionState;
  navRef: RefObject<HTMLElement | null>;
  sectionRefs: RefObject<Record<string, HTMLElement | null>>;
};

export function useLayoutDebug({
  activeScene,
  activeSection,
  isNavExpanded,
  launcherHeightScale,
  notice,
  setupError,
  viewport,
  showDebugPanel,
  launcherShellRef,
  carouselRef,
  motionState,
  navRef,
  sectionRefs,
}: UseLayoutDebugOptions) {
  const [layoutDebug, setLayoutDebug] = useState<LayoutDebugSnapshot | null>(null);

  useEffect(() => {
    if (!showDebugPanel || activeScene !== "launcher") {
      setLayoutDebug(null);
      return;
    }

    let frameId: number | null = null;
    const visualViewport = window.visualViewport;

    const collectDebugSnapshot = () => {
      const shell = launcherShellRef.current;
      const carousel = carouselRef.current;
      const nav = navRef.current;
      const activeCard = sectionRefs.current[activeSection];
      if (!shell || !carousel || !nav || !activeCard) {
        return;
      }

      const shellStyle = window.getComputedStyle(shell);
      const carouselStyle = window.getComputedStyle(carousel);
      const navStyle = window.getComputedStyle(nav);
      const activeCardStyle = window.getComputedStyle(activeCard);

      const navBottom = parseNumericCssValue(navStyle.bottom);
      const navHeight = nav.getBoundingClientRect().height;
      const navReservedHeight = navHeight + navBottom;
      const sectionScale = parseNumericCssValue(shellStyle.getPropertyValue("--section-scale"));
      const sectionScaleBase = parseNumericCssValue(
        shellStyle.getPropertyValue("--section-scale-base")
      );
      const launcherBottomClearance = parseNumericCssValue(
        shellStyle.getPropertyValue("--launcher-bottom-clearance")
      );

      const activeCardClientHeight = activeCard.clientHeight;
      const activeCardScrollHeight = activeCard.scrollHeight;
      const activeCardOverflow = Math.max(0, activeCardScrollHeight - activeCardClientHeight);

      setLayoutDebug({
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        visualViewportWidth: visualViewport?.width ?? window.innerWidth,
        visualViewportHeight: visualViewport?.height ?? window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        baselineWidthDelta: window.innerWidth - 1280,
        baselineHeightDelta: window.innerHeight - 720,
        launcherHeightScale,
        sectionScale,
        sectionScaleBase,
        launcherBottomClearance,
        sectionCardPaddingBottom: parseNumericCssValue(activeCardStyle.paddingBottom),
        carouselGap: parseNumericCssValue(carouselStyle.columnGap || carouselStyle.gap),
        carouselPeek: parseNumericCssValue(carouselStyle.paddingLeft),
        carouselWidth: carousel.clientWidth,
        carouselScrollWidth: carousel.scrollWidth,
        carouselMaxScrollLeft: Math.max(0, carousel.scrollWidth - carousel.clientWidth),
        screenHeight: shell.clientHeight,
        carouselHeight: carousel.clientHeight,
        navHeight,
        navBottom,
        navReservedHeight,
        contentHeightBudget: Math.max(0, shell.clientHeight - navReservedHeight),
        activeCardClientHeight,
        activeCardScrollHeight,
        activeCardOverflow,
        motionPhase: motionState.phase,
        motionTargetSection: motionState.targetSection,
        motionProgress: motionState.progress,
        motionReleaseVelocity: motionState.releaseVelocity,
        motionPagingZone: motionState.pagingZone,
        motionScrollLeft: motionState.scrollLeft,
      });
    };

    const scheduleSnapshot = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        collectDebugSnapshot();
      });
    };

    scheduleSnapshot();
    window.addEventListener("resize", scheduleSnapshot);
    visualViewport?.addEventListener("resize", scheduleSnapshot);
    visualViewport?.addEventListener("scroll", scheduleSnapshot);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", scheduleSnapshot);
      visualViewport?.removeEventListener("resize", scheduleSnapshot);
      visualViewport?.removeEventListener("scroll", scheduleSnapshot);
    };
  }, [
    activeScene,
    activeSection,
    isNavExpanded,
    launcherHeightScale,
    notice,
    setupError,
    motionState.pagingZone,
    motionState.phase,
    motionState.progress,
    motionState.releaseVelocity,
    motionState.scrollLeft,
    motionState.targetSection,
    viewport.height,
    viewport.width,
    showDebugPanel,
  ]);

  return layoutDebug;
}
