import { Navigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";

export default function AccountPage() {
  const { session, loading } = useAuth();
  const { locale } = useI18n();

  if (loading) {
    return <section className="container page">Loading...</section>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="container page prestige-page-shell">
      <article className="card prestige-content-hero">
        <span className="badge">Profile</span>
        <h1>Account</h1>
        <p>Session identity and interface preferences currently active in the dashboard.</p>
      </article>

      <div className="grid cols-2 prestige-grid-gap">
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Identity</span>
          <h3>Connected user</h3>
          <p className="prestige-inline-field">
            User ID <strong>{session.user?.id ?? "unknown"}</strong>
          </p>
        </article>

        <article className="card prestige-info-card">
          <span className="prestige-section-label">Locale</span>
          <h3>Current web language</h3>
          <p className="prestige-inline-field">
            Active locale <strong>{locale.toUpperCase()}</strong>
          </p>
        </article>
      </div>
    </section>
  );
}
