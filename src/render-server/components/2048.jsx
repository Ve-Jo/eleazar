const Game2048 = (props) => {
  let { grid, score, earning, interaction, i18n } = props;

  const translations = Object.entries(Game2048.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  if (!grid) {
    grid = [
      [0, 2, 4, 8],
      [0, 0, 0, 16],
      [0, 0, 0, 32],
      [0, 256, 128, 64],
    ];
    score = 10;
    earning = 250;
  }

  const getScaleFontSize = (number) => {
    const numStr = number.toString();
    if (numStr.length <= 3) return "30px";
    if (numStr.length <= 4) return "26px";
    if (numStr.length <= 5) return "22px";
    return "18px";
  };

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
    padding: "25px",
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

  const scoreContainerStyle = {
    display: "flex",
    alignItems: "stretch",
    gap: "10px",
    marginBottom: "20px",
    minHeight: "60px",
  };

  const scoreStyle = {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    flex: "1 1 auto",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    color: "#FFFFFF",
    padding: "10px 15px",
    borderRadius: "10px",
    fontWeight: "bold",
  };

  const scoreContentStyle = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    fontSize: getScaleFontSize(`${score}  `),
  };

  const earningStyle = {
    display: "flex",
    alignItems: "center",
    backgroundColor: "rgba(65, 194, 69, 0.71)",
    color: "#FFFFFF",
    padding: "10px 15px",
    borderRadius: "10px",
    fontWeight: "bold",
    fontSize: getScaleFontSize(earning.toFixed(1)),
  };

  const avatarStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "25%",
    objectFit: "cover",
    flexShrink: 0,
  };

  return (
    <div style={containerStyle}>
      <div style={scoreContainerStyle}>
        <div style={scoreStyle}>
          <div style={scoreContentStyle}>
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
        </div>
        <div style={earningStyle}>
          <span>+{earning.toFixed(1)} 💵</span>
        </div>
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

Game2048.dimensions = {
  width: 400,
  height: 490,
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
