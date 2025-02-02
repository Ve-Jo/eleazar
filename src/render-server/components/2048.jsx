const Game2048 = (props) => {
  let { grid, score, interaction, i18n } = props;

  const translations = Object.entries(Game2048.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  if (!grid) {
    grid = [
      [0, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    score = 25;
  }

  const tileColors = {
    0: "#CDC1B4",
    2: "#EEE4DA",
    4: "#EDE0C8",
    8: "#F2B179",
    16: "#F59563",
    32: "#F67C5F",
    64: "#F65E3B",
    128: "#EDCF72",
    256: "#EDCC61",
    512: "#EDC850",
    1024: "#EDC53F",
    2048: "#EDC22E",
  };

  const containerStyle = {
    width: "400px",
    height: "490px",
    backgroundColor: "#BBADA0",
    borderRadius: "10px",
    fontFamily: "Inter600",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    position: "relative",
  };

  const tileStyle = (value) => ({
    backgroundColor: tileColors[value],
    borderRadius: "5px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",

    fontSize: value < 100 ? "42px" : value < 1000 ? "32px" : "24px",
    fontWeight: "bold",
    color: value < 8 ? "#776E65" : "#F9F6F2",
  });

  const scoreStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#FFFFFF",
    padding: "10px 15px",
    borderRadius: "10px",
    fontSize: "30px",
    fontWeight: "bold",
    marginBottom: "20px",
  };

  const avatarStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "25%",
    objectFit: "cover",
  };

  return (
    <div style={containerStyle}>
      <div style={scoreStyle}>
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          alt="User Avatar"
          width={40}
          height={40}
          style={avatarStyle}
        />
        <span>
          {translations.score} {score}
        </span>
      </div>
      {grid.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: "10px" }}>
          {row.map((value, colIndex) => (
            <div
              key={colIndex}
              style={{
                ...tileStyle(value),
                width: "80px",
                height: "80px",
              }}
            >
              {value !== 0 && value}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

Game2048.localization_strings = {
  title: {
    en: "2048",
    ru: "2048",
    uk: "2048",
  },
  score: {
    en: "Score:",
    ru: "Счет:",
    uk: "Рахунок:",
  },
};

export default Game2048;
