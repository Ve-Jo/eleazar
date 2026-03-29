import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import botLogo from "../assets/bot-logo.png";
import { getSiteCopy } from "../content/siteContent";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";

const localeOptions = ["en", "ru", "uk"] as const;
const marketingRoutes = new Set(["/", "/features", "/pricing"]);

export default function AppLayout() {
  const { session, loading, logout } = useAuth();
  const { locale, setLocale } = useI18n();
  const location = useLocation();
  const copy = getSiteCopy(locale);
  const isMarketingRoute = marketingRoutes.has(location.pathname);

  return (
    <div className={`site-shell ${isMarketingRoute ? "site-shell--marketing" : "site-shell--app"}`}>
      <header className={`site-header ${isMarketingRoute ? "site-header--overlay" : "site-header--sticky"}`}>
        <div className="site-nav">
          <Link to="/" className="brand-link">
            <img src={botLogo} alt="Eleazar logo" className="brand-logo" />
            <span>ELEAZAR</span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/features">
              {copy.nav.features}
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/app">
              {copy.nav.dashboard}
            </NavLink>
            {session.authenticated ? (
              <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/app/account">
                {copy.nav.account}
              </NavLink>
            ) : null}
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/pricing">
              {copy.nav.pricing}
            </NavLink>
          </nav>

          <div className="nav-controls">
            <select
              aria-label={copy.nav.localeLabel}
              value={locale}
              onChange={(event) => setLocale(event.target.value as (typeof localeOptions)[number])}
              className="locale-select"
            >
              {localeOptions.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>

            {loading ? null : session.authenticated ? (
              <motion.button
                whileHover={{ y: -1.5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void logout()}
                className="ui-btn ui-btn-danger"
              >
                {copy.nav.logout}
              </motion.button>
            ) : (
              <Link to="/login">
                <motion.span whileHover={{ y: -1.5 }} whileTap={{ scale: 0.98 }} className="ui-btn ui-btn-primary">
                  {copy.nav.login}
                </motion.span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`site-main ${isMarketingRoute ? "site-main--marketing" : "site-main--app"}`}>
        <Outlet />
      </main>
    </div>
  );
}
