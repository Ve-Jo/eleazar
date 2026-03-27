import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getSiteCopy } from "../content/siteContent";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).authCallback;

  useEffect(() => {
    void (async () => {
      await refreshSession();
      navigate("/app", { replace: true });
    })();
  }, [navigate, refreshSession]);

  return (
    <section className="auth-page">
      <motion.div
        className="auth-shell"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <span className="label-kicker">{copy.kicker}</span>
        <h1>{copy.title}</h1>
        <p>{copy.subtitle}</p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </motion.div>
    </section>
  );
}
