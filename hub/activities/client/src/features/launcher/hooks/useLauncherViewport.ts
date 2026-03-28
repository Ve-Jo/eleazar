import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { ViewportState, ViewportTier } from "../../../types/activityUi.ts";
import { clamp01, interpolateRange } from "../lib/layoutMath.ts";

const LAUNCHER_HEIGHT_MIN = 500;
const LAUNCHER_HEIGHT_MAX = 540;

export function useLauncherViewport() {
  const [viewport, setViewport] = useState<ViewportState>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return useMemo(() => {
    const launcherTargetHeight = Math.min(
      LAUNCHER_HEIGHT_MAX,
      Math.max(LAUNCHER_HEIGHT_MIN, viewport.height)
    );
    const launcherActualHeight = Math.min(viewport.height, launcherTargetHeight);
    const launcherHeightGap = Math.max(0, viewport.height - launcherActualHeight);

    const heightProgress = clamp01((launcherActualHeight - 420) / 120);
    const widthProgress = clamp01((viewport.width - 820) / 500);
    const adaptiveFitProgress = Math.min(heightProgress, widthProgress);

    const launcherHeightScale = interpolateRange(0.66, 1, heightProgress);
    const sectionScaleBase = interpolateRange(0.8, 0.95, adaptiveFitProgress);
    const launcherBottomClearancePx = Math.round(interpolateRange(0, 8, heightProgress));
    const sectionCardPaddingPx = Math.round(interpolateRange(10, 22, adaptiveFitProgress));
    const sectionCardBottomExtraPx = Math.round(interpolateRange(4, 11, heightProgress));

    const sectionNavBottomPx = Math.round(interpolateRange(8, 14, heightProgress));
    const sectionNavMinHeightPx = Math.round(interpolateRange(42, 54, heightProgress));
    const sectionNavPaddingPx = Math.round(interpolateRange(5, 8, heightProgress));
    const sectionNavCollapsedWidthPx = Math.round(interpolateRange(152, 196, widthProgress));
    const sectionNavCollapsedMinHeightPx = Math.round(interpolateRange(42, 48, heightProgress));
    const sectionNavCollapsedPaddingYpx = Math.round(interpolateRange(5, 7, heightProgress));
    const sectionNavCollapsedPaddingXpx = Math.round(interpolateRange(8, 12, widthProgress));

    const sectionChipPaddingYpx = Math.round(interpolateRange(6, 8, heightProgress));
    const sectionChipPaddingXpx = Math.round(interpolateRange(10, 14, widthProgress));

    const metricPillMinHeightPx = Math.round(interpolateRange(62, 78, heightProgress));
    const metricPillPaddingYpx = Math.round(interpolateRange(9, 12, heightProgress));
    const metricPillPaddingXpx = Math.round(interpolateRange(10, 14, widthProgress));
    const metricPillValueSizeRem = interpolateRange(1.34, 1.7, heightProgress).toFixed(3);

    const viewportTier: ViewportTier =
      launcherActualHeight < 430 || viewport.width < 560
        ? "micro"
        : launcherActualHeight < 480 || viewport.width < 720
        ? "dense"
        : adaptiveFitProgress < 0.76
        ? "compact"
        : "regular";

    const launcherStyle = {
      "--launcher-height-scale": launcherHeightScale,
      "--section-scale-base": sectionScaleBase,
      "--launcher-target-min-height": `${LAUNCHER_HEIGHT_MIN}px`,
      "--launcher-target-max-height": `${LAUNCHER_HEIGHT_MAX}px`,
      "--launcher-target-height": `${launcherTargetHeight}px`,
      "--launcher-actual-height": `${launcherActualHeight}px`,
      "--launcher-height-gap": `${launcherHeightGap}px`,
      "--launcher-bottom-clearance": `${launcherBottomClearancePx}px`,
      "--section-card-padding-inline": `${sectionCardPaddingPx}px`,
      "--section-card-padding-top": `${sectionCardPaddingPx}px`,
      "--section-card-padding-bottom-extra": `${sectionCardBottomExtraPx}px`,
      "--section-nav-bottom": `${sectionNavBottomPx}px`,
      "--section-nav-min-height": `${sectionNavMinHeightPx}px`,
      "--section-nav-padding": `${sectionNavPaddingPx}px`,
      "--section-nav-collapsed-width": `${sectionNavCollapsedWidthPx}px`,
      "--section-nav-collapsed-min-height": `${sectionNavCollapsedMinHeightPx}px`,
      "--section-nav-collapsed-padding-y": `${sectionNavCollapsedPaddingYpx}px`,
      "--section-nav-collapsed-padding-x": `${sectionNavCollapsedPaddingXpx}px`,
      "--section-chip-padding-y": `${sectionChipPaddingYpx}px`,
      "--section-chip-padding-x": `${sectionChipPaddingXpx}px`,
      "--metric-pill-min-height": `${metricPillMinHeightPx}px`,
      "--metric-pill-padding-y": `${metricPillPaddingYpx}px`,
      "--metric-pill-padding-x": `${metricPillPaddingXpx}px`,
      "--metric-pill-value-size": `${metricPillValueSizeRem}rem`,
    } as CSSProperties;

    return {
      adaptiveFitProgress,
      launcherHeightScale,
      launcherTargetHeight,
      launcherActualHeight,
      launcherHeightGap,
      launcherStyle,
      sectionScaleBase,
      shouldCompactBalance: adaptiveFitProgress < 0.58,
      shouldCompactPanels: adaptiveFitProgress < 0.7,
      viewportTier,
      viewport,
    };
  }, [viewport]);
}
