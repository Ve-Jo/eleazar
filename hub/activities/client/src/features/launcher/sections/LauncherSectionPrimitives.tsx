import type { ReactNode } from "react";

import MetricPill from "../../../components/MetricPill.tsx";
import type { LauncherActionModel, LauncherStatModel } from "../lib/buildLauncherViewModels.ts";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string | null;
  summaryCards?: LauncherStatModel[];
};

export function SectionHeader({
  eyebrow,
  title,
  subtitle = null,
  summaryCards = [],
}: SectionHeaderProps) {
  return (
    <div className="section-stage" data-launcher-page-zone="chrome">
      <div className="section-hero">
        <div className="micro-label">{eyebrow}</div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {summaryCards.length > 0 ? (
        <div className="section-rail" data-launcher-page-zone="chrome">
          {summaryCards.map((card, index) => (
            <MetricPill
              key={card.key || `${card.label}-${index}`}
              label={card.label}
              value={card.value}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ActionButtonProps = {
  action: LauncherActionModel | null | undefined;
  className?: string;
  variant?: "primary" | "ghost";
};

export function ActionButton({
  action,
  className = "",
  variant = "primary",
}: ActionButtonProps) {
  if (!action) {
    return null;
  }

  return (
    <button
      type="button"
      className={`${variant === "primary" ? "action-button" : "ghost-button"} ${className}`.trim()}
      disabled={Boolean(action.disabled)}
      onClick={action.onClick}
      data-launcher-page-zone="interactive"
    >
      {action.label}
    </button>
  );
}

type ProgressPanelProps = {
  label: string;
  value: string;
  subtitle?: string | null;
  percent: number;
  tone?: string | null;
};

export function ProgressPanel({
  label,
  value,
  subtitle = null,
  percent,
  tone = null,
}: ProgressPanelProps) {
  return (
    <div className="progress-panel" data-launcher-page-zone="chrome">
      <div className="progress-copy">
        <div>
          <div className="micro-label">{label}</div>
          <strong>{value}</strong>
        </div>
        {subtitle ? <span style={tone ? { color: tone } : undefined}>{subtitle}</span> : null}
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />
      </div>
    </div>
  );
}

type StatListProps = {
  items: LauncherStatModel[];
  renderValue?: (item: LauncherStatModel) => ReactNode;
};

export function StatList({ items, renderValue }: StatListProps) {
  return (
    <div className="reward-list">
      {items.map((item, index) => (
        <div key={item.key || `${item.label}-${index}`} className="reward-row">
          <span className="icon-badge">{item.icon || "•"}</span>
          <div>
            <strong>{item.label}</strong>
            {item.description ? <p className="muted">{item.description}</p> : null}
          </div>
          <strong>{renderValue ? renderValue(item) : item.value}</strong>
        </div>
      ))}
    </div>
  );
}

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return <div className="empty-state">{message}</div>;
}
