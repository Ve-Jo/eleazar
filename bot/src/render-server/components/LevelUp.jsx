import React from "react";

const LevelUp = (props) => {
  const { interaction, type = "chat", level = 1, i18n } = props;

  // Ensure all values are numbers
  let numLevel = Number(level);

  const translations = Object.entries(LevelUp.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale()] || translations.en,
    }),
    {}
  );

  const bgColor = type === "game" ? "#1DB935" : "#2196F3";
  const darkerColor = darkenColor(bgColor);

  // Get adjacent level numbers for scrolling effect
  const getAdjacentLevels = (level) => {
    return [
      level + 2,
      level + 1,
      level,
      level - 1 > 0 ? level - 1 : 0,
      level - 2 > 0 ? level - 2 : 0,
    ];
  };

  const adjacentLevels = getAdjacentLevels(numLevel);

  return (
    <div
      style={{
        width: "600px",
        height: "150px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Inter700, sans-serif",
        color: "white",
        fontSize: "20px",
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: bgColor,
      }}
    >
      {/* Background */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: "100%",
          width: "100%",
          backgroundColor: bgColor,
          display: "flex",
        }}
      />

      {/* Content container - explicitly use flex */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {/* User avatar */}
        <img
          style={{
            width: "80px",
            height: "80px",
            objectFit: "cover",
            position: "absolute",
            top: "10px",
            left: "15px",
            borderRadius: "25%",
          }}
          src={interaction.user.avatarURL}
          alt="User Avatar"
        />

        {/* Level Up title */}
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "110px",
            fontSize: "35px",
            fontWeight: "bold",
            display: "flex",
          }}
        >
          {translations.levelUp}
        </div>

        {/* Level info with scrolling effect */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: "20px",
            fontSize: "60px",
            fontWeight: "bold",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            ↑ {numLevel}LVL
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                position: "absolute",
                opacity: 0.5,
                right: "0px",
                top: "0px",
                lineHeight: "1",
                color: "rgba(255, 255, 255, 1)",
              }}
            >
              <span style={{ opacity: 0 }}>{adjacentLevels[2]}LVL</span>
              <span style={{ filter: "blur(1px)" }}>
                {adjacentLevels[3]}LVL
              </span>
            </div>
          </div>
        </div>

        {/* Type label (Chat/Game) */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            left: "20px",
            bottom: "-5px",
            fontSize: "52px",
            fontWeight: "bold",
          }}
        >
          {type === "game" ? translations.games : translations.chat}
        </div>
      </div>
    </div>
  );
};

function darkenColor(color) {
  const colorMap = {
    "#1DB935": "#1DB935", // Green
    "#2196F3": "#2196F3", // Blue
  };

  if (!color.startsWith("#")) {
    color = colorMap[color.toLowerCase()] || "#000000";
  }

  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);

  r = Math.max(0, Math.floor(r * 0.8));
  g = Math.max(0, Math.floor(g * 0.8));
  b = Math.max(0, Math.floor(b * 0.8));

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

LevelUp.dimensions = {
  width: 600,
  height: 150,
};

LevelUp.localization_strings = {
  levelUp: {
    en: "Level Up!",
    ru: "Новый уровень!",
    uk: "Новий рівень!",
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
};

export default LevelUp;
