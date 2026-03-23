import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  useEffect(() => {
    void (async () => {
      await refreshSession();
      navigate("/app", { replace: true });
    })();
  }, [navigate, refreshSession]);

  return (
    <section className="container page prestige-page-shell">
      <div className="card prestige-auth-card">
        <span className="badge">Secure Session</span>
        <h1>Authenticating...</h1>
        <p>Completing Discord session handshake.</p>
        <div className="prestige-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}
