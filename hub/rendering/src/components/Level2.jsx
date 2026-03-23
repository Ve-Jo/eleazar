import prettyMilliseconds from "pretty-ms";
import InfoRectangle from "./unified/InfoRectangle.jsx";

const Level2 = (props) => {
  let {
    interaction,
    currentXP = 0,
    requiredXP = 100,
    level = 1,
    voiceCurrentXP = 0,
    voiceRequiredXP = 100,
    voiceLevel = 1,
    gameCurrentXP = 0,
    gameRequiredXP = 100,
    gameLevel = 1,
    seasonXP = 0,
    seasonEnds = Date.now() + 1000 * 60 * 60 * 24 * 7,
    seasonNumber = 1,
    i18n,
    coloring = {},
    chatRank,
    voiceRank,
    gameRank,
    availableRoles = [],
  } = props;

  currentXP = Number(currentXP);
  requiredXP = Number(requiredXP);
  level = Number(level);
  voiceCurrentXP = Number(voiceCurrentXP);
  voiceRequiredXP = Number(voiceRequiredXP);
  voiceLevel = Math.max(1, Number(voiceLevel));
  gameCurrentXP = Number(gameCurrentXP);
  gameRequiredXP = Number(gameRequiredXP);
  gameLevel = Math.max(1, Number(gameLevel));
  seasonXP = Number(seasonXP);

  const timeRemaining = seasonEnds
    ? Math.max(0, Number(seasonEnds) - Date.now())
    : 0;

  const formattedTime =
    timeRemaining > 0
      ? prettyMilliseconds(timeRemaining, {
          colonNotation: true,
          compact: false,
          formatSubMilliseconds: false,
          separateMilliseconds: false,
          secondsDecimalDigits: 0,
        })
      : "00:00:00";

  const translations = Object.entries(Level2.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale?.()] || translations.en,
    }),
    {}
  );

  const {
    textColor = "#f8fbff",
    secondaryTextColor = "rgba(248,251,255,0.78)",
    tertiaryTextColor = "rgba(248,251,255,0.6)",
    overlayBackground = "rgba(255,255,255,0.08)",
    backgroundGradient,
  } = coloring || {};

  const accentGame = "#1DB935";
  const accentChat = "#2196F3";
  const accentVoice = "#00BCD4";
  const accentSeason = "#8732a8";

  const chatProgress = Math.min(1, Math.max(0, currentXP / Math.max(1, requiredXP)));
  const voiceProgress = Math.min(1, Math.max(0, voiceCurrentXP / Math.max(1, voiceRequiredXP)));
  const gameProgress = Math.min(1, Math.max(0, gameCurrentXP / Math.max(1, gameRequiredXP)));

  const modeLevelMap = {
    text: level,
    voice: voiceLevel,
    gaming: gameLevel,
    combined_activity: level + voiceLevel,
    combined_all: level + voiceLevel + gameLevel,
  };

  const username = interaction?.user?.displayName || interaction?.user?.username || "Player";
  const avatarURL = interaction?.user?.avatarURL;

  const rolesToShow = (availableRoles && availableRoles.length > 0
    ? availableRoles
    : [
        /*{ name: "Veteran", color: "#ffb347", requiredLevel: 10 },
        { name: "Elite", color: "#6ec6ff", requiredLevel: 20 },
        { name: "Mythic", color: "#bd4eff", requiredLevel: 30 },
        { name: "Veteran", color: "#ffb347", requiredLevel: 10 },
        { name: "Elite", color: "#6ec6ff", requiredLevel: 20 },
        { name: "Mythic", color: "#bd4eff", requiredLevel: 30 },*/
      ]
  );
  const visibleRoles = rolesToShow.slice(0, 4);
  const moreRolesCount = Math.max(0, rolesToShow.length - visibleRoles.length);

  return (
    <div
      style={{
        width: `${Level2.dimensions.width}px`,
        height: `${Level2.dimensions.height}px`,
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        borderRadius: "14px",
        background: backgroundGradient || "#0f172a",
        color: textColor,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "10px", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {avatarURL ? (
              <img
                src={avatarURL}
                alt="avatar"
                style={{ width: "48px", height: "48px", borderRadius: "16px", objectFit: "cover" }}
              />
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
              <span style={{ fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", color: tertiaryTextColor, fontWeight: 700 }}>{translations.season} {seasonNumber}</span>
              <span style={{ fontSize: "20px", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{username}</span>
            </div>
          </div>
          <InfoRectangle
            icon={<span>🏆</span>}
            background={overlayBackground}
            title={translations.season}
            titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 700, textTransform: "uppercase" }}
            value={
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "18px", fontWeight: 800 }}>{Math.floor(seasonXP)}</span>
                  <span style={{ fontSize: "10px", color: tertiaryTextColor }}>XP</span>
                </div>
                <span style={{ fontSize: "11px", color: secondaryTextColor, fontWeight: 600, letterSpacing: "0.3px" }}>{formattedTime}</span>
              </div>
            }
            padding="10px 12px"
            minWidth="200px"
            maxWidth="200px"
          />
        </div>

        <div style={{ display: "flex", gap: "10px", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "45%" }}>
            <InfoRectangle
              icon={<span>💬</span>}
              background={overlayBackground}
              title={
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {translations.chat}
                  {chatRank?.rank ? (
                    <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: 700, color: tertiaryTextColor }}>
                      #{chatRank.rank}
                    </span>
                  ) : null}
                </span>
              }
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 700, textTransform: "uppercase" }}
              value={
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: textColor }}>
                    <span style={{ fontSize: "26px", fontWeight: 800 }}>{level}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, position: "relative", bottom: "4px" }}>{translations.lvlSuffix || "lvl"}</span>
                    <span style={{ fontSize: "11px", color: tertiaryTextColor, position: "relative", bottom: "4px" }}>
                      {Math.floor(currentXP)} / {Math.max(1, Math.floor(requiredXP))} XP
                    </span>
                  </div>
                </div>
              }
              padding="12px"
              minWidth="0px"
              maxWidth="auto"
              style={{ width: "100%" }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${chatProgress * 100}%`,
                  background: `${accentChat}55`,
                  transition: "width 0.3s ease-out",
                  zIndex: 0,
                }}
              />
            </InfoRectangle>

            <InfoRectangle
              icon={<span>🎮</span>}
              background={overlayBackground}
              title={
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {translations.games}
                  {gameRank?.rank ? (
                    <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: 700, color: tertiaryTextColor }}>
                      #{gameRank.rank}
                    </span>
                  ) : null}
                </span>
              }
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 700, textTransform: "uppercase" }}
              value={
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: textColor }}>
                    <span style={{ fontSize: "26px", fontWeight: 800 }}>{gameLevel}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, position: "relative", bottom: "4px" }}>{translations.lvlSuffix || "lvl"}</span>
                    <span style={{ fontSize: "11px", color: tertiaryTextColor, position: "relative", bottom: "4px" }}>
                      {Math.floor(gameCurrentXP)} / {Math.max(1, Math.floor(gameRequiredXP))} XP
                    </span>
                  </div>
                </div>
              }
              padding="12px"
              minWidth="0px"
              maxWidth="auto"
              style={{ width: "100%" }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${gameProgress * 100}%`,
                  background: `${accentGame}55`,
                  transition: "width 0.3s ease-out",
                  zIndex: 0,
                }}
              />
            </InfoRectangle>

            <InfoRectangle
              icon={<span>🎤</span>}
              background={overlayBackground}
              title={
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {translations.voice}
                  {voiceRank?.rank ? (
                    <span style={{ fontSize: "10px", opacity: 0.8, fontWeight: 700, color: tertiaryTextColor }}>
                      #{voiceRank.rank}
                    </span>
                  ) : null}
                </span>
              }
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 700, textTransform: "uppercase" }}
              value={
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: textColor }}>
                    <span style={{ fontSize: "26px", fontWeight: 800 }}>{voiceLevel}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, opacity: 0.8, position: "relative", bottom: "4px" }}>{translations.lvlSuffix || "lvl"}</span>
                    <span style={{ fontSize: "11px", color: tertiaryTextColor, position: "relative", bottom: "4px" }}>
                      {Math.floor(voiceCurrentXP)} / {Math.max(1, Math.floor(voiceRequiredXP))} XP
                    </span>
                  </div>
                </div>
              }
              padding="12px"
              minWidth="0px"
              maxWidth="auto"
              style={{ width: "100%" }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${voiceProgress * 100}%`,
                  background: `${accentVoice}55`,
                  transition: "width 0.3s ease-out",
                  zIndex: 0,
                }}
              />
            </InfoRectangle>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, justifyContent: "flex-start" }}>
            <InfoRectangle
              icon={<span>🎖️</span>}
              background={overlayBackground}
              title={translations.nextRole}
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 700, textTransform: "uppercase" }}
              value={
                visibleRoles && visibleRoles.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                    {visibleRoles.map((role, idx) => {
                      const mode = String(role.mode || "text");
                      const modeLevel = Number(modeLevelMap[mode] ?? modeLevelMap.text ?? 0);
                      const roleProgress = Math.min(1, Math.max(0, modeLevel / Math.max(1, Number(role.requiredLevel || 0))));
                      return (
                        <div
                          key={`${role.name}-${idx}`}
                          style={{
                            position: "relative",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 8px",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            width: "100%",
                            boxSizing: "border-box",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              width: `${roleProgress * 100}%`,
                              background: `${role.color || accentChat}55`,
                              zIndex: 0,
                              transition: "width 0.3s ease-out",
                            }}
                          />
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: role.color || "#ffffff",
                              border: "1px solid rgba(255,255,255,0.4)",
                              flexShrink: 0,
                              position: "relative",
                              zIndex: 1,
                            }}
                          />
                          <span style={{ fontSize: "11px", fontWeight: 700, color: textColor, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", position: "relative", zIndex: 1 }}>{role.name}</span>
                          <span style={{ fontSize: "10px", color: tertiaryTextColor, flexShrink: 0, position: "relative", zIndex: 1 }}>{mode} · lvl {role.requiredLevel}</span>
                        </div>
                      );
                    })}
                    {moreRolesCount > 0 ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 8px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", width: "100%", boxSizing: "border-box", color: tertiaryTextColor, fontSize: "10px", fontWeight: 700 }}>
                        +{moreRolesCount} more
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: tertiaryTextColor }}>{translations.noNextRole || "No upcoming role"}</span>
                )
              }
              padding="12px"
              minWidth="0px"
              maxWidth="100%"
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

Level2.dimensions = {
  width: 430,
  height: 364,
};

Level2.localization_strings = {
  season: {
    ru: "Сезон",
    en: "Season",
    uk: "Сезон",
  },
  games: {
    ru: "Игры",
    en: "Games",
    uk: "Ігри",
  },
  chat: {
    ru: "Чат",
    en: "Chat",
    uk: "Чат",
  },
  voice: {
    ru: "Голос",
    en: "Voice",
    uk: "Голос",
  },
  nextRole: {
    ru: "След. роль",
    en: "Next Role",
    uk: "Наст. роль",
  },
  levelLabel: {
    ru: "Уровень",
    en: "Level",
    uk: "Рівень",
  },
  lvlSuffix: {
    ru: "ур.",
    en: "lvl",
    uk: "рів.",
  },
  noNextRole: {
    ru: "Нет ближайшей роли",
    en: "No upcoming role",
    uk: "Немає найближчої ролі",
  },
};

export default Level2;
