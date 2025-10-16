import UserCard from "./unified/UserCard.jsx";

const Game2048 = (props) => {
  let { grid, score, earning, interaction, i18n, database, coloring } = props;

  const translations = Object.entries(Game2048.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale?.()] || translations.en,
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
    score = 1024;
    earning = 55.0;
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
    width: "540px",
    height: "661px",
    backgroundColor: "#BBADA0",
    borderRadius: "25px",
    fontFamily: "Inter600",
    position: "relative",
    overflow: "hidden",
    display: "flex",
  };

  const gameScreenStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "540px",
    height: "558px",
    background: "#BBADA0",
    borderRadius: "25px 25px 0 0",
    padding: "25px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
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

  return (
    <div style={containerStyle}>
      {/* Game Screen */}
      <div style={gameScreenStyle}>
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "flex", gap: "10px" }}>
            {row.map((value, colIndex) => (
              <div
                key={colIndex}
                style={{
                  ...tileStyle(value),
                  width: "115px",
                  height: "115px",
                  display: "flex",
                }}
              >
                {value !== 0 && value}
              </div>
            ))}
          </div>
        ))}
      </div>

      {}

      {/* Use the unified UserCard component */}
      <UserCard
        interaction={interaction}
        score={score}
        earning={earning}
        balance={database?.economy?.balance || 0} // Wallet balance only
        increaseAmount={earning}
        levelProgress={
          database?.levelProgress || {
            chat: database?.levelProgress?.chat,
            game: database?.levelProgress?.game,
          }
        }
        i18n={i18n}
        coloring={coloring}
        position={{ bottom: 0, left: 0 }}
        size={{ width: 540, height: 103 }}
        gridSize="4x4"
      />
    </div>
  );
};

Game2048.dimensions = {
  width: 540,
  height: 661,
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
