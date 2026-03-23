import { Link, NavLink, Outlet } from "react-router-dom";
import botLogo from "../assets/bot-logo.png";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";

const localeOptions = ["en", "ru", "uk"] as const;

export default function AppLayout() {
  const { session, loading, logout } = useAuth();
  const { locale, setLocale, t } = useI18n();

  return (
    <>
      <header className="container" style={{ padding: "1rem 0" }}>
        <div className="card nav-shell prestige-nav-shell">
          <Link to="/" className="brand">
            <img src={botLogo} alt="Eleazar logo" className="brand-logo-image" />
            <span>ELEAZAR</span>
          </Link>

          <nav className="nav-links">
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/features">
              {t("nav.features")}
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/app">
              {t("nav.dashboard")}
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/pricing">
              {t("nav.pricing")}
            </NavLink>

            <select
              aria-label="Select locale"
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
              <button onClick={() => void logout()} className="btn-danger">
                Logout
              </button>
            ) : (
              <Link to="/login">
                <button className="btn-primary">{t("nav.login")}</button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
