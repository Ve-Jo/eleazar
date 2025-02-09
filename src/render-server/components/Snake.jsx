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
    grid[2][2] = 2;
    grid[3][2] = 1;
    grid[4][2] = 1;
    grid[0][2] = 4;
    score = 0;
    earning = 0;
  }

  const tileColors = {
    0: "rgba(76, 175, 80, 0.3)", // Empty (light green for grass)
    1: "#FF1744", // Snake body (red)
    2: "#FF9100", // Snake head (orange)
    4: "transparent", // Food (transparent for apple emoji)
  };

  // Helper function to check if a cell is part of the snake
  const isSnakeCell = (value) => value === 1 || value === 2;

  // Helper function to determine border radius based on snake segment connections
  const getBorderRadius = (row, col) => {
    if (!isSnakeCell(grid[row][col])) return "0px";

    const neighbors = {
      top: row > 0 ? isSnakeCell(grid[row - 1][col]) : false,
      bottom: row < grid.length - 1 ? isSnakeCell(grid[row + 1][col]) : false,
      left: col > 0 ? isSnakeCell(grid[row][col - 1]) : false,
      right:
        col < grid[row].length - 1 ? isSnakeCell(grid[row][col + 1]) : false,
    };

    const radius = "20px";
    return (
      `${!neighbors.top && !neighbors.left ? radius : "0"} ` +
      `${!neighbors.top && !neighbors.right ? radius : "0"} ` +
      `${!neighbors.bottom && !neighbors.right ? radius : "0"} ` +
      `${!neighbors.bottom && !neighbors.left ? radius : "0"}`
    );
  };

  const containerStyle = {
    width: "400px",
    height: "490px",
    background: "#4CAF50",
    fontFamily: "Inter600",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    borderRadius: "15px",
    position: "relative",
    padding: "0 0 10px 0", // Only bottom padding
  };

  const gridContainerStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start", // Align to top
    alignItems: "center",
    borderRadius: "10px 10px 0 0", // Round top corners only
    overflow: "hidden", // Ensure grid lines don't overflow
  };

  const tileStyle = (value, row, col) => ({
    backgroundColor: tileColors[value],
    borderRadius: getBorderRadius(row, col),
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "64px",
    transform: value === 2 ? "scale(1.05)" : "scale(1)",
  });

  const statsContainerStyle = {
    margin: "0 10px",
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    background: "rgba(0,0,0,0.2)",
    padding: "15px",
    borderRadius: "15px",
  };

  const statItemStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: "18px",
  };

  const avatarStyle = {
    width: "40px",
    height: "40px",
    borderRadius: "25%",
    objectFit: "cover",
  };

  // Calculate grid dimensions to fill space without gaps
  const containerWidth = 400; // Full container width
  const cellSize = Math.floor(containerWidth / grid.length);

  return (
    <div style={containerStyle}>
      <div style={gridContainerStyle}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0",
          }}
        >
          {grid.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: "flex",
                gap: "0",
              }}
            >
              {row.map((value, colIndex) => (
                <div
                  key={colIndex}
                  style={{
                    ...tileStyle(value, rowIndex, colIndex),
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    fontSize: `${cellSize - grid.length}px`,
                  }}
                >
                  {value === 4 && "🍎"}
                </div>
              ))}
            </div>
          ))}
        </div>
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
          <span>+{earning.toFixed(1)} 💵</span>
        </div>
        <div style={statItemStyle}>
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
