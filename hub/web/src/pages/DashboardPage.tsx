import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";
import type { GuildListResponse, ManageableGuild } from "../types/guild";
import type { GuildOverviewResponse } from "../types/guildSettings";

export default function DashboardPage() {
  const { session, loading } = useAuth();
  const { t } = useI18n();
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
            const overviewResponse = await apiRequest<GuildOverviewResponse>(
              `/api/guilds/${firstGuildId}/overview`
            );
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
    return <section className="container page">Loading...</section>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <section className="container page prestige-page-shell">
      <article className="card prestige-content-hero">
        <span className="badge">Operations</span>
        <h1>{t("dashboard.title")}</h1>
        <p>{t("dashboard.subtitle")}</p>
      </article>

      <div className="grid cols-3 prestige-grid-gap">
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Guilds</span>
          <h3>Manageable servers</h3>
          {guildsLoading ? (
            <p>Loading manageable guilds...</p>
          ) : guilds.length > 0 ? (
            <div className="prestige-list-stack">
              {guilds.slice(0, 6).map((guild) => (
                <Link key={guild.id} to={`/app/guild/${guild.id}`}>
                  <div className="list-link prestige-list-link">
                    <strong>{guild.name}</strong>
                    <small>{guild.id}</small>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p>No manageable guilds found for this account.</p>
          )}
        </article>
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Stats</span>
          <h3>Guild snapshot</h3>
          {overview ? (
            <>
              <p className="prestige-inline-field">
                Active guild: <strong>{overview.guild.name}</strong>
              </p>
              <p className="prestige-inline-field">
                Level roles: <strong>{overview.levelRolesCount}</strong>
              </p>
            </>
          ) : (
            <p>No guild overview data available yet.</p>
          )}
        </article>
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Settings</span>
          <h3>Voice room status</h3>
          {overview ? (
            <p className="prestige-inline-field">
              Voice rooms waiting mode: <strong>{overview.voiceRoomsEnabled ? "enabled" : "disabled"}</strong>
            </p>
          ) : (
            <p>Settings summary unavailable.</p>
          )}
        </article>
      </div>
    </section>
  );
}
