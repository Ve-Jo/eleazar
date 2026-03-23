import { useI18n } from "../state/i18n";

const plans = [
  {
    name: "Free",
    desc: "Core dashboard, guild settings, and baseline controls.",
    tag: "Live",
    cta: "Current baseline",
  },
  {
    name: "Pro",
    desc: "Advanced operational modules, automation hooks, and richer analytics.",
    tag: "Planned",
    cta: "Coming soon",
  },
  {
    name: "Enterprise",
    desc: "Team governance, policy controls, and priority integration support.",
    tag: "Planned",
    cta: "Coming soon",
  },
];

export default function PricingPage() {
  const { t } = useI18n();

  return (
    <section className="container page prestige-page-shell">
      <article className="card prestige-content-hero">
        <span className="badge">Subscription Scaffold</span>
        <h1>{t("pricing.title")}</h1>
        <p>{t("pricing.subtitle")}</p>
      </article>

      <div className="grid cols-3 prestige-grid-gap">
        {plans.map((plan) => (
          <article key={plan.name} className="card prestige-plan-card">
            <div className="prestige-plan-head">
              <h3>{plan.name}</h3>
              <span className="prestige-plan-tag">{plan.tag}</span>
            </div>
            <p>{plan.desc}</p>
            <button className="btn-secondary">{plan.cta}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
