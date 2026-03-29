import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { getSiteCopy } from "../content/siteContent";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";
import type { ManageableGuild, GuildListResponse } from "../types/guild";
import type { LinkedRolesStatus } from "../types/linkedRoles";

export default function AccountPage() {
  const { session, loading } = useAuth();
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).account;
  const [linkedRolesStatus, setLinkedRolesStatus] = useState<LinkedRolesStatus | null>(null);
  const [linkedRolesLoading, setLinkedRolesLoading] = useState(true);
  const [linkedRolesError, setLinkedRolesError] = useState<string | null>(null);
  const [manageableGuilds, setManageableGuilds] = useState<ManageableGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const [guildMutationLoading, setGuildMutationLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  const connectHref = useMemo(() => {
    if (typeof window === "undefined") {
      return "/api/linked-roles/oauth/start";
    }

    return `/api/linked-roles/oauth/start?returnTo=${encodeURIComponent(window.location.href)}`;
  }, []);

  async function loadLinkedRolesState() {
    if (!session.authenticated || !session.user?.id) {
      return;
    }

    setLinkedRolesLoading(true);
    setLinkedRolesError(null);

    try {
      const [status, guildsPayload] = await Promise.all([
        apiRequest<LinkedRolesStatus>("/api/linked-roles/status"),
        apiRequest<GuildListResponse>("/api/guilds"),
      ]);

      const guilds = guildsPayload.guilds || [];
      setLinkedRolesStatus(status);
      setManageableGuilds(guilds);

      if (status.selectedGuildId) {
        setSelectedGuildId(status.selectedGuildId);
      } else if (guilds[0]?.id) {
        setSelectedGuildId(guilds[0].id);
      } else {
        setSelectedGuildId("");
      }
    } catch (error) {
      setLinkedRolesError(error instanceof Error ? error.message : "Failed to load linked roles");
      setLinkedRolesStatus(null);
      setManageableGuilds([]);
      setSelectedGuildId("");
    } finally {
      setLinkedRolesLoading(false);
    }
  }

  useEffect(() => {
    if (!session.authenticated) {
      return;
    }

    void loadLinkedRolesState();
  }, [session.authenticated, session.user?.id]);

  async function updateSelectedGuild(nextGuildId: string) {
    if (!nextGuildId) {
      return;
    }

    setSelectedGuildId(nextGuildId);
    setGuildMutationLoading(true);
    setLinkedRolesError(null);

    try {
      await apiRequest<{ success: boolean }>("/api/linked-roles/selected-guild", {
        method: "PUT",
        body: { selectedGuildId: nextGuildId },
      });
      await loadLinkedRolesState();
    } catch (error) {
      setLinkedRolesError(error instanceof Error ? error.message : "Failed to update selected guild");
    } finally {
      setGuildMutationLoading(false);
    }
  }

  async function syncNow() {
    setSyncLoading(true);
    setLinkedRolesError(null);

    try {
      await apiRequest<{ queued: boolean }>("/api/linked-roles/sync-now", {
        method: "POST",
      });
      await loadLinkedRolesState();
    } catch (error) {
      setLinkedRolesError(error instanceof Error ? error.message : "Failed to sync linked roles");
    } finally {
      setSyncLoading(false);
    }
  }

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

        <motion.article className="app-panel" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.35 }}>
          <span className="badge-soft">{copy.linkedRolesLabel}</span>
          <h3>{copy.linkedRolesTitle}</h3>
          <p>{copy.linkedRolesDescription}</p>

          {linkedRolesError ? <p className="feedback-error">{linkedRolesError}</p> : null}
          {linkedRolesLoading ? <p>Loading...</p> : null}

          {!linkedRolesLoading ? (
            <div className="form-stack">
              <p>
                {linkedRolesStatus?.connected ? copy.linkedRolesConnected : copy.linkedRolesDisconnected}
              </p>
              <p>
                {copy.linkedRolesStatus}:{" "}
                <strong>{linkedRolesStatus?.syncStatus || "disconnected"}</strong>
              </p>
              <a className="ui-btn ui-btn-primary" href={connectHref}>
                {linkedRolesStatus?.connected
                  ? copy.reconnectLinkedRoles
                  : copy.connectLinkedRoles}
              </a>

              {manageableGuilds.length > 0 ? (
                <select
                  className="field"
                  value={selectedGuildId}
                  disabled={!linkedRolesStatus?.connected || guildMutationLoading}
                  onChange={(event) => {
                    void updateSelectedGuild(event.target.value);
                  }}
                >
                  {manageableGuilds.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name} ({guild.id})
                    </option>
                  ))}
                </select>
              ) : (
                <p>{copy.linkedRolesNoGuilds}</p>
              )}

              <button
                className="ui-btn ui-btn-secondary"
                onClick={() => void syncNow()}
                disabled={!linkedRolesStatus?.connected || syncLoading}
              >
                {copy.linkedRolesSyncNow}
              </button>
              <button
                className="ui-btn ui-btn-secondary"
                onClick={() => void loadLinkedRolesState()}
                disabled={linkedRolesLoading}
              >
                {copy.linkedRolesRefresh}
              </button>

              <p>
                {copy.linkedRolesSelectedGuild}:{" "}
                <strong>{linkedRolesStatus?.selectedGuildId || "-"}</strong>
              </p>
              <p>
                {copy.linkedRolesLastSync}:{" "}
                <strong>
                  {linkedRolesStatus?.lastSyncAt
                    ? new Date(linkedRolesStatus.lastSyncAt).toLocaleString()
                    : "-"}
                </strong>
              </p>
              <p>
                {copy.linkedRolesLastError}:{" "}
                <strong>{linkedRolesStatus?.lastSyncError || "-"}</strong>
              </p>

              <div>
                <strong>{copy.linkedRolesMetadataPreview}</strong>
                <p>
                  {copy.walletBalance}:{" "}
                  <strong>{linkedRolesStatus?.metadataPreview?.wallet_balance ?? "-"}</strong>
                </p>
                <p>
                  {copy.chatLevel}:{" "}
                  <strong>{linkedRolesStatus?.metadataPreview?.chat_level ?? "-"}</strong>
                </p>
                <p>
                  {copy.voiceLevel}:{" "}
                  <strong>{linkedRolesStatus?.metadataPreview?.voice_level ?? "-"}</strong>
                </p>
                <p>
                  {copy.totalXp}:{" "}
                  <strong>{linkedRolesStatus?.metadataPreview?.total_xp ?? "-"}</strong>
                </p>
              </div>
            </div>
          ) : null}
        </motion.article>
      </div>
    </section>
  );
}
