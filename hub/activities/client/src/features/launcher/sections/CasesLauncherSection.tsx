import {
  ActionButton,
  EmptyState,
  SectionHeader,
  StatList,
} from "./LauncherSectionPrimitives.tsx";
import type { CasesSectionModel } from "../lib/buildLauncherViewModels.ts";

type CasesLauncherSectionProps = {
  model: CasesSectionModel;
};

export default function CasesLauncherSection({ model }: CasesLauncherSectionProps) {
  return (
    <div className="launcher-section">
      <SectionHeader
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.subtitle}
        summaryCards={model.summaryCards}
      />

      <div className="cases-grid launcher-panel-grid">
        {model.calendar ? (
          <article className="hero-card launcher-calendar-panel" data-launcher-page-zone="chrome">
            <div className="hero-card-head">
              <div>
                <div className="micro-label">{model.calendar.label}</div>
                <strong>{model.calendar.headline}</strong>
                <p>{model.calendar.subline}</p>
              </div>
              <div className={`launcher-status-pill is-${model.calendar.badgeTone}`}>
                <span>{model.calendar.badgeIcon}</span>
                <strong>{model.calendar.badgeText}</strong>
              </div>
            </div>
            <div className="launcher-calendar">
              {model.calendar.weekdays.map((label) => (
                <span key={label} className="launcher-calendar-weekday">
                  {label}
                </span>
              ))}
              {model.calendar.weeks.flatMap((week) =>
                week.map((day) => (
                  <span
                    key={day.id}
                    className={`launcher-calendar-day ${day.opened ? "is-opened" : ""} ${day.isCurrent ? "is-current" : ""} ${day.isMuted ? "is-muted" : ""}`}
                  >
                    {day.display}
                  </span>
                ))
              )}
            </div>
          </article>
        ) : null}

        {model.featuredCase ? (
          <article className="hero-card launcher-feature-panel" data-launcher-page-zone="chrome">
            <div className="hero-card-head">
              <div>
                <div className="micro-label">{model.featuredCase.kicker}</div>
                <h3>{model.featuredCase.title}</h3>
                <p>{model.featuredCase.description}</p>
              </div>
              <span className="icon-badge launcher-hero-emoji">{model.featuredCase.emoji}</span>
            </div>
            <div className="case-status-row">
              <span className={`availability-dot ${model.featuredCase.statusTone === "ready" ? "ready" : ""}`} />
              <span>{model.featuredCase.statusLabel}</span>
              <strong>{model.featuredCase.statusValue}</strong>
            </div>
            <div className="case-rewards">
              <span>{model.featuredCase.countLabel}: {model.featuredCase.countValue}</span>
              {model.featuredCase.infoCards.map((item) => (
                <span key={item.key || item.label}>
                  {item.icon ? `${item.icon} ` : ""}
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
            <ActionButton action={model.featuredCase.action} />
          </article>
        ) : null}
      </div>

      <div className="cases-grid launcher-panel-grid" data-launcher-page-zone="content">
        <section className="reward-sheet launcher-list-panel">
          <div className="reward-sheet-head">
            <div>
              <h3>{model.collectionTitle}</h3>
              <p>{model.collectionCountText}</p>
            </div>
          </div>
          <div className="launcher-card-grid">
            {model.cases.map((crate) => (
              <button
                key={crate.id}
                type="button"
                className={`case-card launcher-select-card ${crate.isActive ? "is-ready" : ""}`}
                onClick={crate.onSelect}
                data-launcher-page-zone="interactive"
              >
                <div className="case-card-top">
                  <span className="icon-badge">{crate.emoji}</span>
                  <span className="launcher-mini-badge">{crate.countLabel}</span>
                </div>
                <div>
                  <h3>{crate.title}</h3>
                  <p>{crate.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="reward-sheet launcher-detail-panel">
          <div className="reward-sheet-head">
            <div>
              <h3>{model.detailPanel.title}</h3>
              <p>{model.detailPanel.subtitle}</p>
            </div>
          </div>
          {model.detailPanel.items.length ? (
            <StatList items={model.detailPanel.items} />
          ) : (
            <EmptyState message={model.detailPanel.emptyText || "Nothing to reveal yet."} />
          )}
        </section>
      </div>
    </div>
  );
}
