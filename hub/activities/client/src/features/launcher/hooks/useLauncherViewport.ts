import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { ViewportState } from "../../../types/activityUi.ts";
import { clamp01, interpolateRange } from "../lib/layoutMath.ts";

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
    const heightProgress = clamp01((viewport.height - 500) / 260);
    const widthProgress = clamp01((viewport.width - 820) / 500);
    const adaptiveFitProgress = Math.min(heightProgress, widthProgress);

    const launcherHeightScale = interpolateRange(0.72, 1, heightProgress);
    const sectionScaleBase = interpolateRange(0.85, 0.95, adaptiveFitProgress);
    const launcherBottomClearancePx = Math.round(interpolateRange(0, 6, heightProgress));
    const sectionCardPaddingPx = Math.round(interpolateRange(12, 22, adaptiveFitProgress));
    const sectionCardBottomExtraPx = Math.round(interpolateRange(4, 9, heightProgress));

    const sectionNavBottomPx = Math.round(interpolateRange(6, 12, heightProgress));
    const sectionNavMinHeightPx = Math.round(interpolateRange(42, 52, heightProgress));
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

    const launcherStyle = {
      "--launcher-height-scale": launcherHeightScale,
      "--section-scale-base": sectionScaleBase,
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
      launcherStyle,
      sectionScaleBase,
      shouldCompactBalance: adaptiveFitProgress < 0.52,
      shouldCompactPanels: adaptiveFitProgress < 0.82,
      viewport,
    };
  }, [viewport]);
}
