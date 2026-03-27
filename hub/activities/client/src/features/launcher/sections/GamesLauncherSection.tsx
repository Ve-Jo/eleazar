import {
  ActionButton,
  EmptyState,
  ProgressPanel,
  SectionHeader,
  StatList,
} from "./LauncherSectionPrimitives.tsx";
import type { GamesSectionModel } from "../lib/buildLauncherViewModels.ts";

type GamesLauncherSectionProps = {
  model: GamesSectionModel;
};

export default function GamesLauncherSection({ model }: GamesLauncherSectionProps) {
  return (
    <div className="launcher-section">
      <SectionHeader
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
      />

      {model.featuredGame ? (
        <article className="hero-card launcher-feature-panel" data-launcher-page-zone="chrome">
          <div className="game-card-top">
            <div>
              <div className="micro-label">{model.featuredGame.kicker}</div>
              <h3>{model.featuredGame.title}</h3>
              <p>{model.featuredGame.subtitle}</p>
            </div>
            <span className="icon-badge launcher-hero-emoji">{model.featuredGame.emoji}</span>
          </div>

          <div className="case-status-row">
            <span className="availability-dot ready" />
            <span>{model.featuredGame.statusLabel}</span>
            <strong>{model.featuredGame.statusValue}</strong>
          </div>

          <StatList items={model.featuredGame.statCards} />

          {model.featuredGame.progress ? (
            <ProgressPanel
              label={model.featuredGame.progress.label}
              value={model.featuredGame.progress.value}
              percent={model.featuredGame.progress.percent}
            />
          ) : null}

          <ActionButton action={model.featuredGame.action} />
        </article>
      ) : null}

      <div className="games-grid launcher-panel-grid" data-launcher-page-zone="content">
        <section className="reward-sheet launcher-list-panel">
          <div className="reward-sheet-head">
            <div>
              <h3>{model.collectionTitle}</h3>
              <p>{model.collectionCountText}</p>
            </div>
            <span className="muted">{model.collectionHintText}</span>
          </div>
          {model.games.length ? (
            <div className="launcher-card-grid">
              {model.games.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className={`game-card launcher-select-card ${!game.isMuted ? "is-playable" : ""}`}
                  onClick={game.onSelect}
                  data-launcher-page-zone="interactive"
                >
                  <div className="game-card-top">
                    <span className="icon-badge">{game.emoji}</span>
                    <span className="launcher-mini-badge">{game.statusLabel}</span>
                  </div>
                  <div>
                    <h3>{game.title}</h3>
                    <p>{game.meta}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState message="No games configured yet." />
          )}
        </section>
      </div>
    </div>
  );
}
