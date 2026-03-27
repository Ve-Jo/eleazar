import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { getSiteCopy } from "../content/siteContent";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";

export default function AccountPage() {
  const { session, loading } = useAuth();
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).account;

  if (loading) {
    return <section className="app-page">Loading...</section>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="app-page">
      <motion.header
        className="app-page-header"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="label-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
      </motion.header>

      <div className="app-grid app-grid-2">
        <motion.article className="app-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }}>
          <span className="badge-soft">{copy.identityLabel}</span>
          <h3>{copy.identityTitle}</h3>
          <p>
            {copy.userId} <strong>{session.user?.id ?? "unknown"}</strong>
          </p>
        </motion.article>

        <motion.article className="app-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.35 }}>
          <span className="badge-soft">{copy.localeLabel}</span>
          <h3>{copy.localeTitle}</h3>
          <p>
            {copy.activeLocale} <strong>{locale.toUpperCase()}</strong>
          </p>
        </motion.article>
      </div>
    </section>
  );
}
