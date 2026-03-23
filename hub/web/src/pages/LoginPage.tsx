import { useI18n } from "../state/i18n";

export default function LoginPage() {
  const { t } = useI18n();

  const authNotes = [
    "Discord OAuth with secure callback flow",
    "Session-aware dashboard and guild controls",
    "Localized interface after sign-in",
  ];

  return (
    <section className="container page prestige-page-shell">
      <div className="card prestige-auth-card">
        <span className="badge">Secure Access</span>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>

        <a href="/api/auth/discord/login" className="prestige-button-link btn-primary prestige-auth-button">
          Continue with Discord
        </a>

        <div className="prestige-auth-notes">
          {authNotes.map((note) => (
            <div key={note} className="prestige-auth-note">
              {note}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
