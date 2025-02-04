const Snake = (props) => {
  let { grid, score, earning, interaction, i18n } = props;

  const translations = Object.entries(Snake.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  if (!grid) {
    grid = Array(5)
      .fill()
      .map(() => Array(5).fill(0));
    score = 0;
    earning = 0;
  }

  const getScaleFontSize = (number) => {
    const numStr = number.toString();
    if (numStr.length <= 3) return "30px";
    if (numStr.length <= 4) return "26px";
    if (numStr.length <= 5) return "22px";
    return "18px";
  };

  const tileColors = {
    0: "rgba(76, 175, 80, 0.3)", // Empty (light green for grass)
    1: "#FF1744", // Snake body (red)
    2: "#FF9100", // Snake head (orange)
    4: "transparent", // Food (transparent for apple emoji)
  };

  const containerStyle = {
    width: "400px",
    height: "490px",
    background: "linear-gradient(to bottom, #4CAF50, #2E7D32)", // Grass gradient
    borderRadius: "10px",
    fontFamily: "Inter600",
    padding: "25px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    position: "relative",
    boxShadow: "inset 0 0 20px rgba(0,0,0,0.2)",
  };

  const gridContainerStyle = {
    flex: 1,
    background:
      "linear-gradient(45deg, #43A047 25%, #388E3C 25%, #388E3C 50%, #43A047 50%, #43A047 75%, #388E3C 75%, #388E3C 100%)",
    backgroundSize: "40px 40px",
    borderRadius: "8px",
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 0 15px rgba(0,0,0,0.1)",
  };

  const tileStyle = (value) => ({
    backgroundColor: tileColors[value],
    borderRadius: value === 0 ? "2px" : "5px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "20px",
    border: value === 0 ? "1px solid rgba(255,255,255,0.1)" : "none",
    boxShadow: value > 0 ? "0 2px 4px rgba(0,0,0,0.2)" : "none",
    transition: "transform 0.1s ease",
    transform: value === 2 ? "scale(1.05)" : "scale(1)", // Slightly larger snake head
  });

  const statsContainerStyle = {
    marginTop: "15px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    background: "rgba(0,0,0,0.2)",
    padding: "15px",
    borderRadius: "8px",
  };

  const statItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: "18px",
    textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
  };

  const avatarStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "25%",
    objectFit: "cover",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
    border: "2px solid #FFFFFF",
  };

  // Calculate cell size based on grid size to fit container
  const cellSize = Math.min(70, 320 / grid.length);
  const gridGap = Math.max(4, 8 - (grid.length - 5));

  return (
    <div style={containerStyle}>
      <div style={gridContainerStyle}>
        {grid.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: "flex",
              gap: `${gridGap}px`,
              justifyContent: "center",
              margin: `${gridGap / 2}px 0`,
            }}
          >
            {row.map((value, colIndex) => (
              <div
                key={colIndex}
                style={{
                  ...tileStyle(value),
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  fontSize: "64px",
                }}
              >
                {value === 4 && "🍎"}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={statsContainerStyle}>
        <div style={statItemStyle}>
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
        <div style={statItemStyle}>
          <span>🌟</span>
          <span>+{earning.toFixed(1)} 💵</span>
        </div>
        <div style={statItemStyle}>
          <span>📏</span>
          <span>
            {grid.length}x{grid.length}
          </span>
        </div>
      </div>
    </div>
  );
};

Snake.localization_strings = {
  title: {
    en: "Snake",
    ru: "Змейка",
    uk: "Змійка",
  },
  score: {
    en: "Score:",
    ru: "Счет:",
    uk: "Рахунок:",
  },
};

export default Snake;
