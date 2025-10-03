const Level = (props) => {
  let {
    interaction,
    currentXP = 120,
    requiredXP = 120,
    level = 152,
    gameCurrentXP = 0,
    gameRequiredXP = 100,
    gameLevel = 1,
    i18n,
  } = props;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(Level.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const generateWavePoints = () => {
    const points = [];
    const segments = 150;

    const numCurves = 8;
    const offsets = [
      -0.2,
      ...Array.from({ length: numCurves - 2 }, () => Math.random() * 2.5 - 0.8),
      -0.2,
    ];

    for (let i = 0; i <= segments; i++) {
      const y = (i / segments) * 100;

      let x = 95;
      const progress = i / segments;

      offsets.forEach((offset, index) => {
        const curvePosition = index / (numCurves - 1);
        const t = Math.max(0, 1 - Math.abs(progress - curvePosition) * 5);
        const influence = t * t * (3 - 2 * t);
        x += offset * influence;
      });

      if (i > 0) {
        const prevX = parseFloat(points[points.length - 1].split(",")[0]);
        x = prevX * 0.2 + x * 0.8;
      }

      x = Math.min(Math.max(x, 91.5), 98);

      points.push(`${x},${y}`);
    }

    return points.join(" ");
  };

  const progress = (currentXP / requiredXP) * 100;
  const gameProgress = (gameCurrentXP / gameRequiredXP) * 100;
  const wavePoints = generateWavePoints();
  const gameWavePoints = generateWavePoints(); // Generate separate wave for game XP

  return (
    <div
      style={{
        width: "400px",
        height: "200px",
        backgroundColor: props.database?.banner_url
          ? "rgba(0, 0, 0, 0.6)"
          : "#2196f3",
        borderRadius: props.database?.banner_url ? "0px" : "20px",
        padding: "20px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          right: "0",
          bottom: "50%",
          overflow: "hidden",
          borderRadius: props.database?.banner_url ? "0px" : "20px 20px 0 0",
          display: "flex",
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            left: "0",
            transform: `translateX(${progress - 100}%)`,
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={`M0,0 L100,0 ${wavePoints} L100,100 L0,100 Z`}
            fill={props.database?.banner_url ? "rgba(0, 0, 0, 0.9)" : "#59B4FB"}
          />
        </svg>
      </div>

      {/* Game XP Progress Bar */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "0",
          right: "0",
          bottom: "0",
          overflow: "hidden",
          borderRadius: props.database?.banner_url ? "0px" : "0 0 20px 20px",
          display: "flex",
        }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            position: "absolute",
            left: "0",
            transform: `translateX(${gameProgress - 100}%)`,
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={`M0,0 L100,0 ${gameWavePoints} L100,100 L0,100 Z`}
            fill={props.database?.banner_url ? "rgba(0, 0, 0, 0.8)" : "#4CAF50"}
          />
        </svg>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "20px",
          zIndex: "2",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <div
              style={{
                margin: "0",
                fontSize:
                  i18n.getLocale() === "ru" || i18n.getLocale() === "uk"
                    ? level >= 100
                      ? "45px"
                      : level >= 10
                      ? "50px"
                      : "57px"
                    : level >= 100
                    ? "60px"
                    : level >= 10
                    ? "65px"
                    : "80px",
                display: "flex",
              }}
            >
              {translations.title} {level}
            </div>
          </div>
          <div
            style={{
              fontSize: "24px",
              display: "flex",
            }}
          >
            {currentXP} / {requiredXP} {translations.xp}
          </div>
          <div
            style={{
              fontSize: "20px",
              display: "flex",
              color: "#98FB98",
            }}
          >
            {translations.gameLevel} {gameLevel} • {gameCurrentXP} /{" "}
            {gameRequiredXP} {translations.xp}
          </div>
        </div>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "20px",
            overflow: "hidden",
            backgroundColor: "#1565c0",
            display: "flex",
          }}
        >
          <img
            src={
              interaction?.user?.avatarURL ||
              "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User Avatar"
            width="80"
            height="80"
            style={{
              objectFit: "cover",
              width: "100%",
              height: "100%",
              borderRadius: "20px",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-end",
          zIndex: "2",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: "14px",
            opacity: "0.2",
            display: "flex",
          }}
        >
          #{interaction?.user?.id || "{id}"}
        </div>
        <div
          style={{
            fontSize: "16px",
            display: "flex",
          }}
        >
          {interaction?.user?.username ||
            interaction?.user?.displayName ||
            "{username}"}
        </div>
      </div>
    </div>
  );
};

Level.dimensions = {
  width: 450,
  height: 200,
};

// Static translations object that will be synchronized
Level.localization_strings = {
  title: {
    en: "Level",
    ru: "Уровень",
    uk: "Рівень",
  },
  gameLevel: {
    en: "Game Level",
    ru: "Игровой уровень",
    uk: "Ігровий рівень",
  },
  xp: {
    en: "XP",
    ru: "Опыта",
    uk: "Досвіду",
  },
};

export default Level;
