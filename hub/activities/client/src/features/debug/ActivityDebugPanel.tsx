import { formatDebugPx } from "../launcher/lib/layoutMath.ts";
import type { SetupDiagnostics, LayoutDebugSnapshot } from "../../types/activityUi.ts";
import type { ActivitySection } from "../../lib/activityConstants.ts";

type ActivityDebugPanelProps = {
  activeDiagnostics: SetupDiagnostics;
  localeTag: string;
  activeSection: ActivitySection;
  adaptiveFitProgress: number;
  shouldCompactBalance: boolean;
  shouldCompactPanels: boolean;
  layoutDebug: LayoutDebugSnapshot | null;
};

export default function ActivityDebugPanel({
  activeDiagnostics,
  localeTag,
  activeSection,
  adaptiveFitProgress,
  shouldCompactBalance,
  shouldCompactPanels,
  layoutDebug,
}: ActivityDebugPanelProps) {
  const activeCardHasOverflow = Boolean(layoutDebug && layoutDebug.activeCardOverflow > 1);
  const baselineStatusLabel = layoutDebug
    ? `${layoutDebug.baselineWidthDelta >= 0 ? "+" : ""}${layoutDebug.baselineWidthDelta} x ${
        layoutDebug.baselineHeightDelta >= 0 ? "+" : ""
      }${layoutDebug.baselineHeightDelta}`
    : "n/a";

  return (
    <details className="debug-panel" open>
      <summary>Activity Debug</summary>
      <div className="debug-grid">
        <div className="debug-row">
          <span className="debug-key">step</span>
          <span className="debug-value">{activeDiagnostics.currentStep}</span>
        </div>
        <div className="debug-row">
          <span className="debug-key">guild</span>
          <span className="debug-value">{activeDiagnostics.guildId || "missing"}</span>
        </div>
        <div className="debug-row">
          <span className="debug-key">client</span>
          <span className="debug-value">{activeDiagnostics.clientId || "missing"}</span>
        </div>
        <div className="debug-row">
          <span className="debug-key">multiplayer</span>
          <span className="debug-value">
            {activeDiagnostics.multiplayerStatus || "disabled"}
            {activeDiagnostics.colyseusUrl ? ` · ${activeDiagnostics.colyseusUrl}` : ""}
          </span>
        </div>
        <div className="debug-row">
          <span className="debug-key">locale</span>
          <span className="debug-value">{localeTag}</span>
        </div>
        <div className="debug-row">
          <span className="debug-key">section</span>
          <span className="debug-value">{activeSection}</span>
        </div>
        <div className="debug-row">
          <span className="debug-key">adaptive</span>
          <span className="debug-value">
            {`fit ${Math.round(adaptiveFitProgress * 100)}%`}
            <span className={`debug-badge ${shouldCompactBalance ? "warn" : ""}`}>
              {shouldCompactBalance ? "balance compact" : "balance full"}
            </span>
            <span className={`debug-badge ${shouldCompactPanels ? "warn" : ""}`}>
              {shouldCompactPanels ? "menus compact" : "menus full"}
            </span>
          </span>
        </div>

        {layoutDebug ? (
          <>
            <div className="debug-row">
              <span className="debug-key">window</span>
              <span className="debug-value">
                {`${Math.round(layoutDebug.windowWidth)}x${Math.round(layoutDebug.windowHeight)} @${layoutDebug.devicePixelRatio.toFixed(2)}`}
                <span className="debug-badge">{layoutDebug.viewportTier}</span>
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">visual vp</span>
              <span className="debug-value">
                {`${Math.round(layoutDebug.visualViewportWidth)}x${Math.round(layoutDebug.visualViewportHeight)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">vs 1280x720</span>
              <span className="debug-value">{baselineStatusLabel}</span>
            </div>
            <div className="debug-row">
              <span className="debug-key">scale</span>
              <span className="debug-value">
                {`height ${layoutDebug.launcherHeightScale.toFixed(3)} | base ${layoutDebug.sectionScaleBase.toFixed(3)} | section ${layoutDebug.sectionScale.toFixed(3)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">target h</span>
              <span className="debug-value">
                {`${formatDebugPx(layoutDebug.launcherTargetMinHeight)} - ${formatDebugPx(layoutDebug.launcherTargetMaxHeight)} | target ${formatDebugPx(layoutDebug.launcherTargetHeight)} | actual ${formatDebugPx(layoutDebug.launcherActualHeight)} | gap ${formatDebugPx(layoutDebug.launcherHeightGap)}`}
                <span className={`debug-badge ${layoutDebug.isTargetHeightSatisfied ? "" : "warn"}`}>
                  {layoutDebug.isTargetHeightSatisfied ? "within range" : "out of range"}
                </span>
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">spacing</span>
              <span className="debug-value">
                {`peek ${formatDebugPx(layoutDebug.carouselPeek)} | gap ${formatDebugPx(layoutDebug.carouselGap)} | clear ${formatDebugPx(layoutDebug.launcherBottomClearance)} | card pb ${formatDebugPx(layoutDebug.sectionCardPaddingBottom)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">heights</span>
              <span className="debug-value">
                {`frame ${formatDebugPx(layoutDebug.screenHeight)} | carousel ${formatDebugPx(layoutDebug.carouselHeight)} | css target ${formatDebugPx(layoutDebug.launcherTargetCssHeight)} | css actual ${formatDebugPx(layoutDebug.launcherActualCssHeight)} | fit delta ${formatDebugPx(layoutDebug.heightFitGap)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">carousel x</span>
              <span className="debug-value">
                {`client ${formatDebugPx(layoutDebug.carouselWidth)} | scroll ${formatDebugPx(layoutDebug.carouselScrollWidth)} | max ${formatDebugPx(layoutDebug.carouselMaxScrollLeft)} | overflow ${formatDebugPx(layoutDebug.carouselHorizontalOverflow)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">frame y</span>
              <span className="debug-value">
                {`scroll overflow ${formatDebugPx(layoutDebug.shellScrollOverflow)}`}
                <span className={`debug-badge ${layoutDebug.shellScrollOverflow > 1 ? "warn" : ""}`}>
                  {layoutDebug.shellScrollOverflow > 1 ? "clipped" : "stable"}
                </span>
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">nav reserve</span>
              <span className="debug-value">
                {`nav ${formatDebugPx(layoutDebug.navHeight)} + bottom ${formatDebugPx(layoutDebug.navBottom)} = ${formatDebugPx(layoutDebug.navReservedHeight)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">budget</span>
              <span className="debug-value">
                {`content budget ${formatDebugPx(layoutDebug.contentHeightBudget)}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">active card</span>
              <span className="debug-value">
                {`${formatDebugPx(layoutDebug.activeCardClientHeight)} / ${formatDebugPx(layoutDebug.activeCardScrollHeight)} | overflow ${formatDebugPx(layoutDebug.activeCardOverflow)}`}
                <span className={`debug-badge ${activeCardHasOverflow ? "warn" : ""}`}>
                  {activeCardHasOverflow ? "needs scroll" : "fits"}
                </span>
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">motion</span>
              <span className="debug-value">
                {`${layoutDebug.motionPhase} · zone ${layoutDebug.motionPagingZone}`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">snap</span>
              <span className="debug-value">
                {`target ${layoutDebug.motionTargetSection || "none"} · progress ${(layoutDebug.motionProgress * 100).toFixed(0)}%`}
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-key">scroll</span>
              <span className="debug-value">
                {`left ${formatDebugPx(layoutDebug.motionScrollLeft)} · velocity ${layoutDebug.motionReleaseVelocity.toFixed(3)} px/ms`}
              </span>
            </div>
          </>
        ) : (
          <div className="debug-row">
            <span className="debug-key">layout</span>
            <span className="debug-value">collecting...</span>
          </div>
        )}
      </div>
    </details>
  );
}
