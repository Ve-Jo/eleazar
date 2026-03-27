import {
  ActionButton,
  ProgressPanel,
  SectionHeader,
} from "./LauncherSectionPrimitives.tsx";
import type { UpgradesSectionModel } from "../lib/buildLauncherViewModels.ts";

type UpgradesLauncherSectionProps = {
  model: UpgradesSectionModel;
};

export default function UpgradesLauncherSection({ model }: UpgradesLauncherSectionProps) {
  return (
    <div className="launcher-section">
      <SectionHeader
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
      />

      {model.featuredUpgrade ? (
        <article className="hero-card launcher-feature-panel" data-launcher-page-zone="chrome">
          <div className="upgrade-head">
            <div className="launcher-feature-copy">
              <div className="micro-label">{model.featuredUpgrade.kicker}</div>
              <h3>{model.featuredUpgrade.title}</h3>
              <p>{model.featuredUpgrade.subtitle}</p>
            </div>
            <span className="icon-badge launcher-hero-emoji">{model.featuredUpgrade.emoji}</span>
          </div>

          <p className="upgrade-description">{model.featuredUpgrade.description}</p>

          <div className="upgrade-stats">
            <div>
              <span>{model.featuredUpgrade.effectLabel}</span>
              <strong>{model.featuredUpgrade.currentValue}</strong>
            </div>
            <div>
              <span>{model.featuredUpgrade.levelLabel}</span>
              <strong>{model.featuredUpgrade.levelValue}</strong>
            </div>
            <div>
              <span>{model.featuredUpgrade.gainLabel}</span>
              <strong>{model.featuredUpgrade.gainValue}</strong>
            </div>
          </div>

          <ProgressPanel
            label={model.featuredUpgrade.levelHint}
            value={model.featuredUpgrade.priceValue}
            subtitle={model.featuredUpgrade.progressText}
            percent={model.featuredUpgrade.progressPercent}
            tone={model.featuredUpgrade.progressTone}
          />

          <ActionButton action={model.featuredUpgrade.action} />
        </article>
      ) : null}

      <div className="upgrade-group-grid" data-launcher-page-zone="content">
        <section className="reward-sheet launcher-list-panel">
          <div className="reward-sheet-head">
            <div>
              <h3>{model.categoriesTitle}</h3>
              <p>{model.categoriesHint}</p>
            </div>
          </div>
          <div className="launcher-chip-row">
            {model.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`section-chip ${category.isActive ? "is-active" : ""}`}
                onClick={category.onSelect}
                data-launcher-page-zone="interactive"
              >
                <span className="section-chip-label">{category.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="reward-sheet launcher-list-panel">
          <div className="upgrade-groups">
            {model.upgrades.map((upgrade) => (
              <button
                key={upgrade.id}
                type="button"
                className={`upgrade-card ${upgrade.isActive ? "is-affordable" : ""}`}
                onClick={upgrade.onSelect}
                data-launcher-page-zone="interactive"
              >
                <div className="upgrade-head">
                  <div className="launcher-upgrade-head">
                    <span className="icon-badge">{upgrade.emoji}</span>
                    <div className="upgrade-head-copy">
                      <h4>{upgrade.title}</h4>
                      <p>{upgrade.levelLabel}</p>
                    </div>
                  </div>
                  <div className="upgrade-price">{upgrade.priceLabel}</div>
                </div>
                <p>{upgrade.statusLabel}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
