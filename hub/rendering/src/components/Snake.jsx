import UserCard from "./unified/UserCard.jsx";

const Snake = (props) => {
  let { grid, score, earning, interaction, i18n, database, coloring } = props;

  const translations = Object.entries(Snake.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale?.()] || translations.en,
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
    width: "540px",
    height: "661px",
    backgroundColor: "#4CAF50",
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
    background: "transparent",
    borderRadius: "25px 25px 0 0",
    padding: "25px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
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

  // Calculate grid dimensions to fill space without gaps
  const containerWidth = 490; // Container width minus padding (540 - 50)
  const cellSize = Math.floor(containerWidth / grid.length);

  return (
    <div style={containerStyle}>
      {/* Game Screen */}
      <div style={gameScreenStyle}>
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
        gridSize={`${grid.length}x${grid.length}`}
      />
    </div>
  );
};

Snake.dimensions = {
  width: 540,
  height: 661,
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
