import type { CSSProperties } from "react";

import type {
  ActivityLauncherPayload,
  ActivitySupportedLocale,
} from "../../../../shared/src/contracts/hub.ts";
import type { Direction } from "../lib/game2048.ts";
import { formatNumber } from "../lib/activityView.ts";
import type { GameState } from "../types/activityUi.ts";
import MetricPill from "./MetricPill.tsx";

type Game2048SceneProps = {
  launcherData: ActivityLauncherPayload;
  gameState: GameState;
  locale: ActivitySupportedLocale;
  paletteStyle: CSSProperties;
  highScore: number;
  networkError: string | null;
  onBack: () => void;
  onMove: (direction: Direction) => void;
  onStopAndSubmit: () => void;
};

export default function Game2048Scene({
  launcherData,
  gameState,
  locale,
  paletteStyle,
  highScore,
  networkError,
  onBack,
  onMove,
  onStopAndSubmit,
}: Game2048SceneProps) {
  return (
    <div className="screen game-scene" style={paletteStyle}>
      <div className="ambient-layer" />
      <header className="scene-header">
        <div>
          <div className="micro-label">{launcherData.strings.nav.launcher}</div>
          <h1>{launcherData.strings.games.sceneTitle}</h1>
        </div>
        <button className="ghost-button" onClick={onBack}>
          {launcherData.strings.nav.backToLauncher}
        </button>
      </header>

      <div className="scene-stats">
        <MetricPill
          label={launcherData.strings.games.score}
          value={formatNumber(gameState.score, locale, 0)}
        />
        <MetricPill
          label={launcherData.strings.games.moves}
          value={formatNumber(gameState.moves, locale, 0)}
        />
        <MetricPill
          label={launcherData.strings.games.best}
          value={formatNumber(highScore || 0, locale, 0)}
        />
      </div>

      <div className="board-shell">
        <div className="board">
          {gameState.board.flatMap((row, rowIndex) =>
            row.map((cell, cellIndex) => (
              <div key={`${rowIndex}-${cellIndex}`} className={`tile tile-${cell || 0}`}>
                {cell > 0 ? cell : ""}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="controls">
        <button className="action-button" onClick={() => onMove("up")}>
          {launcherData.strings.games.controlUp}
        </button>
        <div className="control-row">
          <button className="action-button" onClick={() => onMove("left")}>
            {launcherData.strings.games.controlLeft}
          </button>
          <button className="action-button" onClick={() => onMove("down")}>
            {launcherData.strings.games.controlDown}
          </button>
          <button className="action-button" onClick={() => onMove("right")}>
            {launcherData.strings.games.controlRight}
          </button>
        </div>
        <button className="ghost-button danger" onClick={onStopAndSubmit}>
          {launcherData.strings.games.stopAndSubmit}
        </button>
      </div>

      {networkError ? <p className="inline-error">{networkError}</p> : null}
      {gameState.submitting ? (
        <p className="muted center-text">{launcherData.strings.games.submitting}</p>
      ) : null}

      {gameState.submission ? (
        <div className="result-sheet">
          <h3>{launcherData.strings.games.runSubmitted}</h3>
          <p>
            {formatNumber(gameState.submission.reward?.visualAwardedAmount || 0, locale)}{" "}
            {launcherData.strings.common.coins}
            {" · "}
            {launcherData.strings.common.xp} {formatNumber(gameState.submission.reward?.gameXp || 0, locale, 0)}
          </p>
          <p>
            {launcherData.strings.games.best}:{" "}
            {formatNumber(gameState.submission.progression?.highScore || 0, locale, 0)}
            {gameState.submission.progression?.isNewRecord
              ? ` • ${launcherData.strings.common.newRecord}`
              : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
