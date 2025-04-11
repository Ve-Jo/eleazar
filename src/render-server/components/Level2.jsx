import prettyMilliseconds from "pretty-ms";

const StyledRectangle = ({
  primaryText,
  secondaryText,
  timerText,
  color = "purple",
  primaryTextStyles = {},
  secondaryTextStyles = {},
  timerTextStyles = {},
  progressBar = false,
  progressBarXP = 0,
  progressBarMaxXP = 100,
  roundness = 0,
}) => {
  // Format the timer text to ensure it's always showing days/hours left
  const formatTimer = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length === 2) {
      // if it's just hours:minutes
      return parts.join(":");
    }
    // Convert days to a more readable format
    const days = Math.floor(parseInt(parts[0]) / 24);
    const hours = parseInt(parts[0]) % 24;
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h ${parts[1]}m`;
  };

  // Calculate progress as a percentage between 0-100
  const progress = Math.min((progressBarXP / progressBarMaxXP) * 100, 100);
  const calculated_percentage = (400 / 100) * progress;
  const opacity = Math.max(0, 1 - progressBarXP / progressBarMaxXP);
  const numberLength = progressBarXP.toString().length;
  console.log(progress);

  const darkenColor = (color) => {
    // Map of common color names to hex values
    const colorMap = {
      purple: "#800080",
      blue: "#0000FF",
      red: "#FF0000",
      green: "#008000",
    };

    // If it's a named color, convert to hex
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

    // Darken by 20%
    r = Math.max(0, Math.floor(r * 0.8));
    g = Math.max(0, Math.floor(g * 0.8));
    b = Math.max(0, Math.floor(b * 0.8));

    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  };

  console.log(`PROGRESS BAR XP: `, progressBarXP);

  return (
    <div
      style={{
        width: "100%",
        height: "33.33%",
        display: "flex",
        backgroundColor: color,
        borderRadius: roundness,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {progressBar && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${calculated_percentage}px`,
              backgroundColor: darkenColor(color),
              transition: "width 0.3s ease-in-out",
            }}
          />
          {console.log(`CALCULATED_PERCENTAGE:`, calculated_percentage)}
          <div
            style={{
              position: "absolute",
              display: "flex",
              top: "5px",
              left: `${
                calculated_percentage < 90
                  ? 10
                  : calculated_percentage - (50 + numberLength * 12)
              }px`,
              fontSize: "24px",
              fontWeight: "bold",
              transition: "opacity 0.3s ease-in-out",
            }}
          >
            {progressBarXP}XP
          </div>
        </>
      )}
      <div
        style={{
          position: "absolute",
          right: "5px",
          display: "flex",
          bottom: "-3px",
          fontSize: "57px",
          ...primaryTextStyles,
        }}
      >
        {primaryText}
      </div>
      {/*{timerText && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: "5px",
            top: "8px",
            opacity: "0.5",
            ...timerTextStyles,
          }}
        >
          {formatTimer(timerText)}
        </div>
      )}*/}
      {progressBar && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: "8px",
            top: "5px",
            fontSize: "24px",
            opacity: opacity,
            transition: "opacity 0.3s ease-in-out",
          }}
        >
          {progressBarMaxXP}XP
        </div>
      )}
      <div
        style={{
          position: "absolute",
          display: "flex",
          bottom: "-9px",
          left: "15px",
          fontSize: "35px",
          ...secondaryTextStyles,
        }}
      >
        {secondaryText}
      </div>
    </div>
  );
};

const Level2 = (props) => {
  let {
    interaction,
    currentXP /*= 52*/,
    requiredXP /*= 120*/,
    level /*= 1*/,
    gameCurrentXP /*= 10*/,
    gameRequiredXP /*= 900*/,
    gameLevel /*= 1*/,
    seasonXP /*= 25*/,
    seasonEnds /*= Date.now() + 1000 * 60 * 60 * 24 * 7*/,
    seasonNumber /*= 1*/,
    i18n,
  } = props;

  // Calculate remaining time more precisely
  const timeRemaining = Math.max(0, seasonEnds - Date.now());
  const formattedTime = prettyMilliseconds(timeRemaining, {
    colonNotation: true,
    compact: false,
    formatSubMilliseconds: false,
    separateMilliseconds: false,
    secondsDecimalDigits: 0,
  });

  const translations = Object.entries(Level2.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const baseUrl = process.env.BASE_URL || "http://localhost:2333";
  const imageUrl = new URL("/images/Frame25.png", baseUrl).toString();

  return (
    <div
      style={{
        backgroundSize: "cover",
        width: "400px",
        height: "254px",
        display: "flex",
        fontFamily: "Inter700",
        color: "white",
        fontSize: "20px",
        position: "relative",
      }}
    >
      {console.log(interaction)}

      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <StyledRectangle
          primaryText={`${translations.season} ${seasonNumber}`}
          secondaryText={`${seasonXP}XP`}
          timerText={formattedTime}
          roundness="10px 10px 0 0"
          color="#8732a8"
        />
        <StyledRectangle
          primaryText={translations.games}
          secondaryText={`${gameLevel}LVL`}
          secondaryTextStyles={{ fontSize: "52px", bottom: "-11px" }}
          color="#1DB935"
          progressBar={true}
          progressBarXP={gameCurrentXP}
          progressBarMaxXP={gameRequiredXP}
        />
        <StyledRectangle
          primaryText={translations.chat}
          secondaryText={`${level}LVL`}
          color="#2196F3"
          primaryTextStyles={{ fontSize: "48px" }}
          secondaryTextStyles={{ fontSize: "52px", bottom: "-13px" }}
          roundness="0 0 10px 10px"
          progressBar={true}
          progressBarXP={currentXP}
          progressBarMaxXP={requiredXP}
        />
      </div>
      <img
        style={{
          width: "60px",
          height: "60px",
          objectFit: "cover",
          position: "absolute",
          display: "flex",
          borderRadius: "20px",
          padding: "10px",
        }}
        src={interaction.user.avatarURL}
        alt="Frame25"
        width={256}
        height={256}
      />
    </div>
  );
};

Level2.dimensions = {
  width: 400,
  height: 254,
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
};

export default Level2;
