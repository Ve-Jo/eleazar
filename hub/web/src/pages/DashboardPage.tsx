import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, Navigate } from "react-router-dom";
import { getSiteCopy } from "../content/siteContent";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";
import type { ManageableGuild, GuildListResponse } from "../types/guild";
import type { GuildOverviewResponse } from "../types/guildSettings";

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).dashboard;
  const [guilds, setGuilds] = useState<ManageableGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(true);
  const [overview, setOverview] = useState<GuildOverviewResponse | null>(null);

  useEffect(() => {
    if (!session.authenticated) {
      setGuilds([]);
      setGuildsLoading(false);
      return;
    }

    void (async () => {
      setGuildsLoading(true);
      try {
        const response = await apiRequest<GuildListResponse>("/api/guilds");
        const manageableGuilds = response.guilds || [];
        setGuilds(manageableGuilds);

        if (manageableGuilds.length > 0) {
          const firstGuildId = manageableGuilds[0]?.id;
          if (firstGuildId) {
            const overviewResponse = await apiRequest<GuildOverviewResponse>(`/api/guilds/${firstGuildId}/overview`);
            setOverview(overviewResponse);
          }
        } else {
          setOverview(null);
        }
      } catch {
        setGuilds([]);
        setOverview(null);
      } finally {
        setGuildsLoading(false);
      }
    })();
  }, [session.authenticated]);

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

      <div className="app-grid app-grid-3">
        <motion.article
          className="app-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35 }}
          whileHover={{ y: -2 }}
        >
          <span className="badge-soft">{copy.guildsLabel}</span>
          <h3>{copy.guildsTitle}</h3>
          {guildsLoading ? (
            <p>{copy.guildsLoading}</p>
          ) : guilds.length > 0 ? (
            <div className="stack">
              {guilds.slice(0, 6).map((guild) => (
                <Link key={guild.id} to={`/app/guild/${guild.id}`} className="stack-link">
                  <strong>{guild.name}</strong>
                  <small>{guild.id}</small>
                </Link>
              ))}
            </div>
          ) : (
            <p>{copy.guildsEmpty}</p>
          )}
        </motion.article>

        <motion.article
          className="app-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35 }}
          whileHover={{ y: -2 }}
        >
          <span className="badge-soft">{copy.statsLabel}</span>
          <h3>{copy.statsTitle}</h3>
          {overview ? (
            <div className="metric-row">
              <p>
                {copy.activeGuild}: <strong>{overview.guild.name}</strong>
              </p>
              <p>
                {copy.levelRoles}: <strong>{overview.levelRolesCount}</strong>
              </p>
            </div>
          ) : (
            <p>{copy.statsEmpty}</p>
          )}
        </motion.article>

        <motion.article
          className="app-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
          whileHover={{ y: -2 }}
        >
          <span className="badge-soft">{copy.settingsLabel}</span>
          <h3>{copy.settingsTitle}</h3>
          {overview ? (
            <p>
              {copy.voiceMode}: <strong>{overview.voiceRoomsEnabled ? copy.enabled : copy.disabled}</strong>
            </p>
          ) : (
            <p>{copy.settingsEmpty}</p>
          )}
        </motion.article>
      </div>
    </section>
  );
}
