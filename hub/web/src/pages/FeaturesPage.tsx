export default function FeaturesPage() {
  const pillars = [
    {
      label: "Command Surface",
      title: "Guild controls with role-safe workflows",
      body: "Moderation-adjacent settings, role progression, and voice-room flows designed for real operators.",
    },
    {
      label: "Unified Signals",
      title: "Dashboard metrics linked to bot systems",
      body: "Guild context, settings summary, and account data stay connected to the live Discord experience.",
    },
    {
      label: "Localization Ready",
      title: "English, Russian, and Ukrainian support",
      body: "Core interface flows are locale-aware and aligned with the bot's multilingual ecosystem.",
    },
    {
      label: "Scalable Core",
      title: "Architecture prepared for premium modules",
      body: "The web layer is structured to grow into automation, subscriptions, and advanced governance.",
    },
  ];

  const tracks = [
    "AI workflows and media tooling",
    "Economy and progression control panels",
    "Voice-room orchestration and waiting flows",
    "Guild-level policy and permission guardrails",
  ];

  return (
    <section className="container page prestige-page-shell">
      <article className="card prestige-content-hero">
        <span className="badge">Feature Atlas</span>
        <h1>Built as a bot-first control layer</h1>
        <p>
          The web app extends Eleazar with focused management workflows while the primary community experience stays
          in Discord.
        </p>

        <div className="prestige-chip-strip">
          {tracks.map((track) => (
            <span key={track} className="prestige-chip">
              {track}
            </span>
          ))}
        </div>
      </article>

      <div className="grid cols-2 prestige-grid-gap">
        {pillars.map((item) => (
          <article key={item.title} className="card prestige-info-card">
            <span className="prestige-section-label">{item.label}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
