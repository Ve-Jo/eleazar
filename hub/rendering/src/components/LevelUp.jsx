import React from "react";
import InfoRectangle from "./unified/InfoRectangle.jsx";

const LevelUp = (props) => {
  const {
    interaction,
    type = "chat",
    level = 1,
    oldLevel = Math.max(0, Number(level) - 1),
    currentXP = 0,
    requiredXP = 0,
    dominantColor,
    coloring = {},
    i18n,
  } = props;

  const translations = Object.entries(LevelUp.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale()] || translations.en,
    }),
    {}
  );

  const numLevel = Number(level) || 0;
  const prevLevel = Number(oldLevel) || Math.max(0, numLevel - 1);
  const xpNeeded = Math.max(1, Number(requiredXP) || 0);
  const xpNow = Math.max(0, Number(currentXP) || 0);
  const progress = Math.min(1, Math.max(0, xpNow / xpNeeded));

  const palette = type === "game"
    ? { base: "#1DB935", accent: "#0f9e2b" }
    : { base: "#2196F3", accent: "#0d7bd4" };

  const normalizedDominant = normalizeColor(dominantColor);
  const baseColor = normalizedDominant || palette.base;
  const accentColor = palette.accent;

  const {
    textColor = "#f8fbff",
    secondaryTextColor = "rgba(248,251,255,0.7)",
    tertiaryTextColor = "rgba(248,251,255,0.5)",
    overlayBackground = "rgba(255,255,255,0.08)",
    backgroundGradient,
  } = coloring || {};

  const username = interaction?.user?.displayName || interaction?.user?.username || "Player";
  const avatarURL = interaction?.user?.avatarURL;

  const modeTint = type === "game"
    ? { soft: "rgba(29, 185, 53, 0.16)", strong: "rgba(29, 185, 53, 0.8)" }
    : { soft: "rgba(33, 150, 243, 0.16)", strong: "rgba(33, 150, 243, 0.8)" };

  return (
    <div
      style={{
        width: `${LevelUp.dimensions.width}px`,
        height: `${LevelUp.dimensions.height}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "8px",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        color: "#f8fbff",
        position: "relative",
        borderRadius: "14px",
        overflow: "hidden",
        background: backgroundGradient || baseColor,
        boxSizing: "border-box",
        padding: "16px 18px",
      }}
    >
      {/* Subtle grid/shine overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0 25%, transparent 25% 50%, rgba(255,255,255,0.04) 50% 75%, transparent 75% 100%)",
          backgroundSize: "18px 18px",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {avatarURL ? (
          <img
            src={avatarURL}
            alt="User Avatar"
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "22px",
              objectFit: "cover",
            }}
          />
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", textTransform: "uppercase", letterSpacing: "0.6px", opacity: 0.9, fontWeight: 700, fontSize: "12px", color: secondaryTextColor }}>
            {translations.levelUp}
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />
            {type === "game" ? translations.games : translations.chat}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", color: textColor }}>
            <span style={{ fontSize: "28px", fontWeight: 800 }}>{username}</span>
            <span style={{ fontSize: "13px", opacity: 0.8, fontWeight: 600, position: "relative", bottom: "5px" }}>{translations.reached}</span>
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <InfoRectangle
              icon={<span style={{ transform: "translateY(-1px)" }}>⬆️</span>}
              background={modeTint.strong}
              title={translations.levelLabel}
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 600, textTransform: "uppercase" }}
              value={
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", color: textColor }}>
                  <span style={{ fontSize: "26px", fontWeight: 800 }}>{numLevel}</span>
                  <span style={{ fontSize: "11px", fontWeight: 800, opacity: 0.8, position: "relative", bottom: "5px" }}>{translations.lvlSuffix}</span>
                  <span style={{ fontSize: "11px", opacity: 0.75, fontWeight: 600, color: tertiaryTextColor, position: "relative", bottom: "5px" }}>
                    {translations.from} {prevLevel}
                  </span>
                </div>
              }
              padding="10px 12px"
              minWidth="0px"
              maxWidth="220px"
            />

            <InfoRectangle
              icon={<span>⭐</span>}
              background={overlayBackground}
              title={translations.progress}
              titleStyle={{ fontSize: "11px", letterSpacing: "0.3px", color: secondaryTextColor, fontWeight: 600, textTransform: "uppercase" }}
              value={
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", color: textColor }}>
                  <div style={{
                    position: "relative",
                    width: "150px",
                    height: "10px",
                    borderRadius: "999px",
                    background: "rgba(255,255,255,0.12)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      width: `${progress * 100}%`,
                      background: `linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.4))`,
                      transition: "width 0.3s ease-out",
                    }} />
                  </div>
                  <span style={{ opacity: 0.9 }}>{Math.round(progress * 100)}%</span>
                  {xpNeeded ? (
                    <span style={{ fontSize: "11px", opacity: 0.75, fontWeight: 600 }}>
                      {`${Math.floor(xpNow)} / ${Math.floor(xpNeeded)} XP`}
                    </span>
                  ) : null}
                </div>
              }
              padding="10px 12px"
              minWidth="0px"
              maxWidth="260px"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function lightenColor(color, amount = 10) {
  if (!color || typeof color !== "string") return color;
  const hex = color.replace("#", "");
  const num = parseInt(hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex, 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
  const b = Math.min(255, (num & 0x0000ff) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, "0")}`;
}

function normalizeColor(color) {
  if (!color || typeof color !== "string") return null;
  const trimmed = color.trim();
  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (hexMatch.test(trimmed)) return trimmed;
  if (trimmed.startsWith("rgb(") || trimmed.startsWith("rgba(") || trimmed.startsWith("hsl(") || trimmed.startsWith("hsla(")) {
    return trimmed;
  }
  return null;
}

LevelUp.dimensions = {
  width: 600,
  height: 175,
};

LevelUp.localization_strings = {
  levelUp: {
    en: "Level Up!",
    ru: "Новый уровень!",
    uk: "Новий рівень!",
  },
  reached: {
    en: "reached",
    ru: "достиг(ла)",
    uk: "досяг(ла)",
  },
  levelLabel: {
    en: "Level",
    ru: "Уровень",
    uk: "Рівень",
  },
  games: {
    en: "Games",
    ru: "Игры",
    uk: "Ігри",
  },
  chat: {
    en: "Chat",
    ru: "Чат",
    uk: "Чат",
  },
  lvlSuffix: {
    en: "lvl",
    ru: "ур.",
    uk: "рів.",
  },
  from: {
    en: "from",
    ru: "с",
    uk: "з",
  },
  progress: {
    en: "Progress",
    ru: "Прогресс",
    uk: "Прогрес",
  },
  mode: {
    en: "Mode",
    ru: "Режим",
    uk: "Режим",
  },
};

export default LevelUp;
