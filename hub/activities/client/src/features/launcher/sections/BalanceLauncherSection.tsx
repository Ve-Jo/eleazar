import { ActionButton, ProgressPanel, SectionHeader } from "./LauncherSectionPrimitives.tsx";
import type { BalanceSectionModel } from "../lib/buildLauncherViewModels.ts";

type BalanceLauncherSectionProps = {
  model: BalanceSectionModel;
};

export default function BalanceLauncherSection({ model }: BalanceLauncherSectionProps) {
  return (
    <div className="launcher-section">
      <SectionHeader
        eyebrow={model.eyebrow}
        title={model.title}
        subtitle={model.titleMeta}
        summaryCards={model.footerCards}
      />

      <div className="balance-grid">
        <article className="hero-card launcher-profile-card" data-launcher-page-zone="chrome">
          <div className="hero-card-head">
            <div className="launcher-profile-block">
              <div className="launcher-avatar">
                {model.profilePanel.avatarUrl ? (
                  <img
                    src={model.profilePanel.avatarUrl}
                    alt={model.profilePanel.displayName || model.title}
                  />
                ) : (
                  <span>{(model.profilePanel.displayName || "?").slice(0, 1)}</span>
                )}
              </div>
              <div className="launcher-profile-copy">
                <strong>{model.profilePanel.displayName || model.title}</strong>
                <span>{model.profilePanel.meta || model.profilePanel.guildName || "Launcher"}</span>
              </div>
            </div>
            <div className="launcher-banner-chip" style={{ background: model.banner.background }}>
              <span>{model.banner.icon}</span>
              <div>
                <strong>{model.banner.value}</strong>
                <span>{model.banner.label}</span>
              </div>
            </div>
          </div>

          <div className="reward-list launcher-account-cards">
            {model.primaryCards.map((card) => (
              <div key={card.key || card.label} className="reward-row launcher-account-card">
                <span className="icon-badge">{card.icon || "•"}</span>
                <div>
                  <strong>{card.label}</strong>
                  {card.description ? <p className="muted">{card.description}</p> : null}
                  {card.supportingItems?.length ? (
                    <div className="case-rewards">
                      {card.supportingItems.map((item) => (
                        <span key={item.key || item.label}>
                          {item.icon ? `${item.icon} ` : ""}
                          {item.label}: {item.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="launcher-account-side">
                  <strong>{card.value}</strong>
                  <ActionButton action={card.action} className="launcher-inline-action" />
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="metrics-grid" data-launcher-page-zone="content">
          {model.metricCards.map((card) => (
            <article key={card.key || card.label} className="hero-card launcher-stat-card">
              <div className="micro-label">{card.label}</div>
              <strong>{card.value}</strong>
              <p>{card.icon ? `${card.icon} ` : ""}{card.description || "Current live value"}</p>
            </article>
          ))}
        </div>
      </div>

      <ProgressPanel
        label={model.progress.label}
        value={model.progress.value}
        subtitle={model.progress.subtitle}
        percent={Math.round(model.progress.progress * 100)}
      />
    </div>
  );
}
