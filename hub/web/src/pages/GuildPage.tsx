import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { useAuth } from "../state/auth";
import type {
  GuildSettingsResponse,
  LevelRoleRecord,
  VoiceRoomsSettings,
} from "../types/guildSettings";

const ROLE_MODES = ["text", "voice", "gaming", "combined_activity", "combined_all"] as const;

export default function GuildPage() {
  const { session, loading } = useAuth();
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
      setSettingsError(error instanceof Error ? error.message : "Failed to load guild settings");
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
    return <section className="container page">Loading...</section>;
  }

  if (!session.authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!guildId) {
    return <section className="container page">Guild ID is missing.</section>;
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
      setSettingsError(error instanceof Error ? error.message : "Failed to save voice room settings");
    } finally {
      setSavingVoiceRooms(false);
    }
  }

  async function addLevelRole() {
    const parsedLevel = Number(newRoleLevel);
    if (!newRoleId.trim() || Number.isNaN(parsedLevel) || parsedLevel < 1) {
      setSettingsError("Provide valid role id and level (>= 1)");
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
      setSettingsError(error instanceof Error ? error.message : "Failed to add level role");
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
      setSettingsError(error instanceof Error ? error.message : "Failed to remove level role");
    } finally {
      setRoleMutationLoading(false);
    }
  }

  return (
    <section className="container page prestige-page-shell">
      <article className="card prestige-content-hero">
        <span className="badge">Guild Console</span>
        <h1>Guild Settings</h1>
        <p>Guild ID: {guildId}</p>
        {settingsError ? <p className="prestige-error">{settingsError}</p> : null}
      </article>

      <div className="grid cols-2 prestige-grid-gap">
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Role Progression</span>
          <h3>Level Roles</h3>
          {settingsLoading ? (
            <p>Loading level roles...</p>
          ) : (
            <>
              <div className="prestige-list-stack">
                {levelRoles.length === 0 ? <p>No configured level roles.</p> : null}
                {levelRoles.map((item) => (
                  <div
                    key={`${item.roleId}-${item.mode || "text"}-${item.requiredLevel}`}
                    className="list-link prestige-inline-row"
                  >
                    <span>
                      <strong>{item.roleId}</strong> @ level {item.requiredLevel} ({item.mode || "text"})
                    </span>
                    <button
                      className="btn-secondary"
                      onClick={() => void removeLevelRole(item.roleId)}
                      disabled={roleMutationLoading}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="prestige-form-stack">
                <input
                  className="prestige-input"
                  value={newRoleId}
                  onChange={(event) => setNewRoleId(event.target.value)}
                  placeholder="Role ID"
                />
                <input
                  className="prestige-input"
                  value={newRoleLevel}
                  onChange={(event) => setNewRoleLevel(event.target.value)}
                  placeholder="Required level"
                  type="number"
                  min={1}
                />
                <select
                  className="prestige-input"
                  value={newRoleMode}
                  onChange={(event) => setNewRoleMode(event.target.value as (typeof ROLE_MODES)[number])}
                >
                  {ROLE_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
                <label className="prestige-checkbox-row">
                  <input
                    type="checkbox"
                    checked={newRoleReplaceLower}
                    onChange={(event) => setNewRoleReplaceLower(event.target.checked)}
                  />
                  Replace lower roles
                </label>
                <button
                  className="btn-primary"
                  onClick={() => void addLevelRole()}
                  disabled={roleMutationLoading}
                >
                  Add role rule
                </button>
              </div>
            </>
          )}
        </article>
        <article className="card prestige-info-card">
          <span className="prestige-section-label">Voice Orchestration</span>
          <h3>Voice Rooms</h3>
          {settingsLoading ? (
            <p>Loading voice room settings...</p>
          ) : (
            <div className="prestige-form-stack">
              <input
                className="prestige-input"
                value={String(voiceRooms.joinToCreateChannelId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({ ...current, joinToCreateChannelId: event.target.value }))
                }
                placeholder="Join-to-create channel ID"
              />
              <input
                className="prestige-input"
                value={String(voiceRooms.categoryId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({ ...current, categoryId: event.target.value || null }))
                }
                placeholder="Category ID"
              />
              <input
                className="prestige-input"
                value={String(voiceRooms.panelChannelId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({ ...current, panelChannelId: event.target.value || null }))
                }
                placeholder="Panel channel ID"
              />
              <input
                className="prestige-input"
                value={String(voiceRooms.waitingRoomCategoryId || "")}
                onChange={(event) =>
                  setVoiceRooms((current) => ({
                    ...current,
                    waitingRoomCategoryId: event.target.value || null,
                  }))
                }
                placeholder="Waiting room category ID"
              />
              <label className="prestige-checkbox-row">
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
                Enable waiting rooms
              </label>
              <button
                className="btn-primary"
                onClick={() => void saveVoiceRoomSettings()}
                disabled={savingVoiceRooms}
              >
                Save voice room settings
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
