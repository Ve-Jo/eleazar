import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useParams } from "react-router-dom";
import { getSiteCopy } from "../content/siteContent";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import { useI18n } from "../state/i18n";
import type { GuildSettingsResponse, LevelRoleRecord, VoiceRoomsSettings } from "../types/guildSettings";

const ROLE_MODES = ["text", "voice", "gaming", "combined_activity", "combined_all"] as const;

export default function GuildPage() {
  const { session, loading } = useAuth();
  const { locale } = useI18n();
  const copy = getSiteCopy(locale).guild;
  const { guildId } = useParams();
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [voiceRooms, setVoiceRooms] = useState<VoiceRoomsSettings>({});
  const [levelRoles, setLevelRoles] = useState<LevelRoleRecord[]>([]);
  const [savingVoiceRooms, setSavingVoiceRooms] = useState(false);
  const [newRoleId, setNewRoleId] = useState("");
  const [newRoleLevel, setNewRoleLevel] = useState("1");
  const [newRoleMode, setNewRoleMode] = useState<(typeof ROLE_MODES)[number]>("text");
  const [newRoleReplaceLower, setNewRoleReplaceLower] = useState(true);
  const [roleMutationLoading, setRoleMutationLoading] = useState(false);

  async function loadGuildSettings(targetGuildId: string) {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const response = await apiRequest<GuildSettingsResponse>(`/api/guilds/${targetGuildId}/settings`);
      setVoiceRooms(response.settings.voiceRooms || {});
      setLevelRoles(response.levelRoles || []);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : copy.loadError);
      setVoiceRooms({});
      setLevelRoles([]);
    } finally {
      setSettingsLoading(false);
    }
  }

  useEffect(() => {
    if (!session.authenticated || !guildId) {
      return;
    }

    void loadGuildSettings(guildId);
  }, [session.authenticated, guildId]);

  if (loading) {
    return <section className="app-page">Loading...</section>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!guildId) {
    return <section className="app-page">{copy.guildIdMissing}</section>;
  }

  const activeGuildId = guildId;

  async function saveVoiceRoomSettings() {
    setSavingVoiceRooms(true);
    setSettingsError(null);
    try {
      await apiRequest<{ success: boolean }>(`/api/guilds/${guildId}/settings/voice-rooms`, {
        method: "PUT",
        body: {
          voiceRooms,
        },
      });
      await loadGuildSettings(activeGuildId);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : copy.saveVoiceError);
    } finally {
      setSavingVoiceRooms(false);
    }
  }

  async function addLevelRole() {
    const parsedLevel = Number(newRoleLevel);
    if (!newRoleId.trim() || Number.isNaN(parsedLevel) || parsedLevel < 1) {
      setSettingsError(copy.roleValidationError);
      return;
    }

    setRoleMutationLoading(true);
    setSettingsError(null);
    try {
      await apiRequest(`/api/guilds/${guildId}/level-roles`, {
        method: "POST",
        body: {
          roleId: newRoleId.trim(),
          level: parsedLevel,
          mode: newRoleMode,
          replaceLowerRoles: newRoleReplaceLower,
        },
      });
      setNewRoleId("");
      setNewRoleLevel("1");
      await loadGuildSettings(activeGuildId);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : copy.addRoleError);
    } finally {
      setRoleMutationLoading(false);
    }
  }

  async function removeLevelRole(roleId: string) {
    setRoleMutationLoading(true);
    setSettingsError(null);
    try {
      await apiRequest(`/api/guilds/${guildId}/level-roles/${roleId}`, {
        method: "DELETE",
      });
      await loadGuildSettings(activeGuildId);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : copy.removeRoleError);
    } finally {
      setRoleMutationLoading(false);
    }
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
        <p className="inline-note">Guild ID: {guildId}</p>
        {settingsError ? <p className="feedback-error">{settingsError}</p> : null}
      </motion.header>

      <div className="app-grid app-grid-2">
        <motion.article
          className="app-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.35 }}
        >
          <span className="badge-soft">{copy.roleProgressLabel}</span>
          <h3>{copy.roleProgressTitle}</h3>

          {settingsLoading ? (
            <p>{copy.roleLoading}</p>
          ) : (
            <>
              <div className="stack">
                {levelRoles.length === 0 ? <p>{copy.roleEmpty}</p> : null}
                {levelRoles.map((item) => (
                  <div key={`${item.roleId}-${item.mode || "text"}-${item.requiredLevel}`} className="inline-row stack-link">
                    <span>
                      <strong>{item.roleId}</strong> - {copy.levelWord} {item.requiredLevel} ({copy.modeLabel}: {item.mode || "text"})
                    </span>
                    <button
                      className="ui-btn ui-btn-secondary"
                      onClick={() => void removeLevelRole(item.roleId)}
                      disabled={roleMutationLoading}
                    >
                      {copy.removeRole}
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-stack">
                <input
                  className="field"
                  value={newRoleId}
                  onChange={(event) => setNewRoleId(event.target.value)}
                  placeholder={copy.roleIdPlaceholder}
                />
                <input
                  className="field"
                  value={newRoleLevel}
                  onChange={(event) => setNewRoleLevel(event.target.value)}
                  placeholder={copy.roleLevelPlaceholder}
                  type="number"
                  min={1}
                />
                <select
                  className="field"
                  value={newRoleMode}
                  onChange={(event) => setNewRoleMode(event.target.value as (typeof ROLE_MODES)[number])}
                >
                  {ROLE_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={newRoleReplaceLower}
                    onChange={(event) => setNewRoleReplaceLower(event.target.checked)}
                  />
                  {copy.replaceLowerRoles}
                </label>
                <button className="ui-btn ui-btn-primary" onClick={() => void addLevelRole()} disabled={roleMutationLoading}>
                  {copy.addRoleRule}
                </button>
              </div>
            </>
          )}
        </motion.article>

        <motion.article
          className="app-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.35 }}
        >
          <span className="badge-soft">{copy.voiceLabel}</span>
          <h3>{copy.voiceTitle}</h3>

          {settingsLoading ? (
            <p>{copy.voiceLoading}</p>
          ) : (
            <div className="form-stack">
              <input
                className="field"
                value={String(voiceRooms.joinToCreateChannelId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({
                    ...current,
                    joinToCreateChannelId: event.target.value,
                  }))
                }
                placeholder={copy.joinChannelPlaceholder}
              />
              <input
                className="field"
                value={String(voiceRooms.categoryId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({
                    ...current,
                    categoryId: event.target.value || null,
                  }))
                }
                placeholder={copy.categoryPlaceholder}
              />
              <input
                className="field"
                value={String(voiceRooms.panelChannelId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({
                    ...current,
                    panelChannelId: event.target.value || null,
                  }))
                }
                placeholder={copy.panelPlaceholder}
              />
              <input
                className="field"
                value={String(voiceRooms.waitingRoomCategoryId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({
                    ...current,
                    waitingRoomCategoryId: event.target.value || null,
                  }))
                }
                placeholder={copy.waitingCategoryPlaceholder}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={Boolean(voiceRooms.waitingRoomsEnabled)}
                  onChange={(event) =>
                    setVoiceRooms((current) => ({
                      ...current,
                      waitingRoomsEnabled: event.target.checked,
                    }))
                  }
                />
                {copy.enableWaitingRooms}
              </label>
              <button className="ui-btn ui-btn-primary" onClick={() => void saveVoiceRoomSettings()} disabled={savingVoiceRooms}>
                {copy.saveVoice}
              </button>
            </div>
          )}
        </motion.article>
      </div>
    </section>
  );
}
