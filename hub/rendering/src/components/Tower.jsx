import React from "react";

const Tower = (props) => {
  const {
    interaction,
    difficulty = "easy",
    betAmount = 0,
    currentFloor = 0,
    tilesPerRow = 5,
    currentPrize = 0,
    nextPrize = 0,
    maxFloors = 10,
    lastAction = "start", // 'start', 'safe', 'bomb', 'prize'
    gameOver = false,
    i18n,
    coloring = {},
    isPreGame = false,
    selectedTiles = [],
    floorMultipliers = [],
  } = props;

  const translations = Object.entries(Tower.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor = "rgba(255, 255, 255, 0.4)",
    backgroundGradient = "linear-gradient(160deg, #2c3e50, #4a6987)", // Dark blue/grey gradient
    overlayBackground = "rgba(255, 255, 255, 0.1)",
    winColor = "#4CAF50",
    loseColor = "#F44336",
    tileColor = "#7f8c8d", // Greyish color for tiles
    highlightColor = "#f1c40f", // Gold/yellow for prize
    selectedTileColor = "#27ae60", // Green for selected safe tiles
  } = coloring;

  // --- Dynamic Sizing Calculations ---
  const totalHeight = 550;
  const containerPadding = 25 * 2;
  const headerHeightEst = 75; // Avatar (60) + margin (15)
  const footerHeightEst = 60; // Padding (15) + text (~22*2) + border (1)
  const floorIndicatorHeightEst = 30; // Text (~18) + gap (10)
  const mainContentGap = 10;

  const fixedVerticalSpace =
    containerPadding +
    headerHeightEst +
    footerHeightEst +
    floorIndicatorHeightEst +
    mainContentGap;
  const availableFloorsHeight = totalHeight - fixedVerticalSpace; // Approx height for floors container

  const numberOfFloors = currentFloor + 1;

  const baseTileHeight = 85;
  const baseGapBetweenFloors = 5; // Reduced vertical gap
  const defaultTotalFloorHeight =
    baseTileHeight * numberOfFloors +
    baseGapBetweenFloors * (numberOfFloors > 1 ? numberOfFloors - 1 : 0);

  let dynamicTileHeight = baseTileHeight;
  let dynamicGapBetweenFloors = baseGapBetweenFloors;
  let dynamicTileGap = 8; // Reduced horizontal gap
  let dynamicTileFontSize = 28;

  if (defaultTotalFloorHeight > availableFloorsHeight && numberOfFloors > 0) {
    // Content overflows, need to scale down
    const minTileHeight = 25; // Increased min slightly
    const minGapBetweenFloors = 1;
    const minTileGap = 2;
    const minTileFontSize = 10;

    // Calculate height needed if using minimums, excluding floor numbers
    const minTotalFloorHeight =
      minTileHeight * numberOfFloors +
      minGapBetweenFloors * (numberOfFloors > 1 ? numberOfFloors - 1 : 0);

    if (availableFloorsHeight >= minTotalFloorHeight) {
      // Can scale proportionally between min and base
      const overflowRatio =
        (availableFloorsHeight - minTotalFloorHeight) /
        (defaultTotalFloorHeight - minTotalFloorHeight);

      dynamicGapBetweenFloors =
        minGapBetweenFloors +
        (baseGapBetweenFloors - minGapBetweenFloors) * overflowRatio;
      dynamicTileHeight =
        minTileHeight + (baseTileHeight - minTileHeight) * overflowRatio;
      dynamicTileGap = minTileGap + (8 - minTileGap) * overflowRatio;
      dynamicTileFontSize =
        minTileFontSize + (28 - minTileFontSize) * overflowRatio;
    } else {
      // Even minimums don't fit, use absolute minimums
      dynamicGapBetweenFloors = minGapBetweenFloors;
      dynamicTileHeight = minTileHeight;
      dynamicTileGap = minTileGap;
      dynamicTileFontSize = minTileFontSize;
    }
  }
  // Round values for pixel rendering
  dynamicTileHeight = Math.round(dynamicTileHeight);
  dynamicGapBetweenFloors = Math.round(dynamicGapBetweenFloors);
  dynamicTileGap = Math.round(dynamicTileGap);
  dynamicTileFontSize = Math.round(dynamicTileFontSize);
  // const dynamicTileWidth = dynamicTileHeight; // Keep tiles square - Replaced by final calculation

  // --- Add Horizontal Constraint Calculation ---
  const containerWidth = 340;
  const containerHorizontalPadding = 25 * 2;
  const availableTileRowWidth = containerWidth - containerHorizontalPadding;

  // Calculate max width per tile based on horizontal space
  // Ensure tilesPerRow is at least 1 to avoid division by zero
  const effectiveTilesPerRow = Math.max(1, tilesPerRow);
  const maxHorizontalTileWidth = Math.max(
    1, // Ensure at least 1px width
    Math.floor(
      (availableTileRowWidth - dynamicTileGap * (effectiveTilesPerRow - 1)) /
        effectiveTilesPerRow
    )
  );

  // Use the smaller dimension (height or width) as the final size for square tiles
  const finalDynamicTileSize = Math.min(
    dynamicTileHeight,
    maxHorizontalTileWidth
  );

  // Recalculate font size and border radius based on the final size
  // Ensure baseTileHeight is not zero before dividing
  const finalDynamicTileFontSize =
    baseTileHeight > 0
      ? Math.round(
          finalDynamicTileSize * (dynamicTileFontSize / baseTileHeight)
        )
      : minTileFontSize; // Fallback font size
  const dynamicBorderRadius = Math.round(finalDynamicTileSize * 0.15);
  // --- End Horizontal Constraint Calculation ---

  // --- End Dynamic Sizing Calculations ---

  const containerStyle = {
    width: "400px",
    height: "550px",
    background: backgroundGradient,
    borderRadius: "15px",
    fontFamily: "Inter600, Roboto, sans-serif",
    padding: "25px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    color: textColor,
    overflow: "hidden", // For Satori compatibility
  };

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "15px",
    flexShrink: 0, // Prevent header from shrinking
  };

  const avatarStyle = {
    width: "60px",
    height: "60px",
    borderRadius: "25%",
    objectFit: "cover",
  };

  const titleStyle = {
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "right",
    display: "flex", // For Satori
  };

  const difficultyStyle = {
    fontSize: "14px",
    fontWeight: "normal",
    color: tertiaryTextColor,
    textTransform: "capitalize",
    display: "flex", // For Satori
  };

  const mainContentStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: mainContentGap, // Use the constant gap
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
  };

  const floorIndicatorStyle = {
    fontSize: "18px",
    fontWeight: "bold",
    color: secondaryTextColor,
    display: "flex",
    flexShrink: 0,
  };

  const floorsContainerStyle = {
    display: "flex",
    flexDirection: "column-reverse",
    alignItems: "center",
    width: "100%",
    overflow: "hidden",
    gap: `${dynamicGapBetweenFloors}px`,
    flex: 1,
    minHeight: 0,
  };

  // Updated floor container to handle multiplier display
  const floorOuterContainerStyle = {
    display: "flex",
    flexDirection: "row", // Arrange multiplier and tiles horizontally
    alignItems: "center",
    justifyContent: "center", // Center the whole row (multiplier + tiles)
    width: "100%",
    gap: "10px", // Gap between multiplier and tile row
    flexShrink: 0,
  };

  const floorContentContainerStyle = (isCurrentFloor) => ({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    // width: "100%", // Width is now controlled by parent
    opacity: isCurrentFloor ? 1 : 0.7,
    flexShrink: 0,
  });

  // Style for the multiplier text
  const multiplierStyle = {
    fontSize: `${Math.round(finalDynamicTileSize * 0.25)}px`, // Scale font with tile size
    fontWeight: "bold",
    color: tertiaryTextColor, // Use highlight color
    width: "40px", // Fixed width for alignment
    textAlign: "right",
    flexShrink: 0,
    display: "flex", // For Satori
    justifyContent: "flex-end", // Align text right
    alignItems: "center",
  };

  const tileRowStyle = {
    display: "flex",
    gap: `${dynamicTileGap}px`,
    justifyContent: "center", // Ensure tiles stay centered within their part
  };

  const tileStyle = (isSelected = false, isBomb = false) => ({
    width: `${finalDynamicTileSize}px`, // Apply final calculated size
    height: `${finalDynamicTileSize}px`, // Apply final calculated size
    backgroundColor: isSelected
      ? isBomb
        ? loseColor
        : selectedTileColor
      : tileColor,
    borderRadius: `${dynamicBorderRadius}px`, // Apply final scaled border radius
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: `${finalDynamicTileFontSize}px`, // Apply final scaled font size
    fontWeight: "bold",
    color: textColor,
    flexShrink: 0,
  });

  const tileContentStyle = {
    display: "flex", // For Satori
  };

  const footerStyle = {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    paddingTop: "15px",
    borderTop: `1px solid ${overlayBackground}`,
    flexShrink: 0, // Prevent footer from shrinking
  };

  const prizeStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  };

  const prizeLabelStyle = {
    fontSize: "14px",
    color: tertiaryTextColor,
    marginBottom: "3px",
    display: "flex", // For Satori
  };

  const prizeAmountStyle = (isCurrent = false) => ({
    fontSize: isCurrent ? "22px" : "18px",
    fontWeight: "bold",
    color: isCurrent ? highlightColor : secondaryTextColor,
    display: "flex",
    alignItems: "center",
  });

  const gameOverOverlayStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "15px",
    zIndex: 10,
  };

  const gameOverTextStyle = {
    fontSize: "48px",
    fontWeight: "bold",
    color: lastAction === "bomb" ? loseColor : winColor,
    marginBottom: "10px",
    display: "flex", // For Satori
  };

  const gameOverReasonStyle = {
    fontSize: "18px",
    color: secondaryTextColor,
    display: "flex", // For Satori
  };

  // Create array of floor indices to show ALL floors from 0 to current
  const floorIndices = Array.from({ length: currentFloor + 1 }, (_, i) => i);

  return (
    <div style={containerStyle}>
      {gameOver && <div style={gameOverOverlayStyle}></div>}

      <div style={headerStyle}>
        <div style={prizeStyle}>
          {/* Bet Amount */}
          <div style={prizeLabelStyle}>
            {translations.betLabel || translations.bet}
          </div>
          <div style={prizeAmountStyle(false)}>{betAmount?.toFixed(2)} 💵</div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
          }}
        >
          <div style={titleStyle}>Tower</div>
          <div style={difficultyStyle}>{difficulty}</div>
        </div>
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          alt="User Avatar"
          style={avatarStyle}
        />
      </div>

      <div style={mainContentStyle}>
        {/* Display current floor indicator - Now at the top of main content */}
        <div style={floorIndicatorStyle}>
          {`${translations.floor} ${currentFloor + 1} / ${maxFloors}`}
        </div>

        {/* Container for ALL floors */}
        <div style={floorsContainerStyle}>
          {floorIndices.map((floorIndex) => {
            const isCurrentFloor = floorIndex === currentFloor;
            const floorTileSelected = selectedTiles[floorIndex];
            // Get multiplier for the current floor index (adjust index if needed)
            const multiplier = floorMultipliers[floorIndex] || 1.0; // Default to 1 if not found

            return (
              // Wrap each floor in the new outer container
              <div key={floorIndex} style={floorOuterContainerStyle}>
                {/* Multiplier Display */}
                <div style={multiplierStyle}>{`${multiplier.toFixed(2)}X`}</div>
                {/* Original Floor Content (Tiles) */}
                <div style={floorContentContainerStyle(isCurrentFloor)}>
                  <div style={tileRowStyle}>
                    {Array.from({ length: tilesPerRow }).map((_, tileIndex) => {
                      const isSelected = floorTileSelected === tileIndex;
                      const isBomb =
                        gameOver &&
                        lastAction === "bomb" &&
                        floorIndex === currentFloor &&
                        isSelected;

                      return (
                        <div
                          key={tileIndex}
                          style={tileStyle(
                            (isSelected && floorIndex < currentFloor) || isBomb,
                            isBomb
                          )}
                        >
                          <div style={tileContentStyle}>
                            {isCurrentFloor && !gameOver
                              ? "?"
                              : isSelected
                              ? isBomb
                                ? "💣"
                                : "✓"
                              : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={footerStyle}>
        <div style={prizeStyle}>
          {/* Current Prize */}
          <div style={prizeLabelStyle}>
            {translations.currentPrizeLabel || translations.currentPrize}
          </div>
          <div style={prizeAmountStyle(true)}>
            {currentPrize?.toFixed(2)} 💵
          </div>
        </div>
        <div style={prizeStyle}>
          {/* Next Prize */}
          <div style={prizeLabelStyle}>
            {translations.nextPrizeLabel || translations.nextPrize}
          </div>
          <div style={prizeAmountStyle(false)}>{nextPrize?.toFixed(2)} 💵</div>
        </div>
      </div>
    </div>
  );
};

Tower.dimensions = {
  width: 400,
  height: 550,
};

Tower.localization_strings = {
  floor: {
    en: "Floor",
    ru: "Этаж",
    uk: "Поверх",
  },
  currentPrize: {
    en: "Current Prize",
    ru: "Текущий приз",
    uk: "Поточний приз",
  },
  nextPrize: {
    en: "Next Floor",
    ru: "След. Этаж",
    uk: "Наст. Поверх",
  },
  bet: {
    en: "Bet",
    ru: "Ставка",
    uk: "Ставка",
  },
  gameOverBomb: {
    en: "Hit a Bomb!",
    ru: "Попал на бомбу!",
    uk: "Потрапив на бомбу!",
  },
  gameOverPrize: {
    en: "Prize Taken!",
    ru: "Приз забран!",
    uk: "Приз забрано!",
  },
  currentPrizeLabel: {
    en: "Current Prize",
    ru: "Текущий приз",
    uk: "Поточний приз",
  },
  nextPrizeLabel: {
    en: "Next Floor",
    ru: "След. Этаж",
    uk: "Наст. Поверх",
  },
  betLabel: {
    en: "Bet",
    ru: "Ставка",
    uk: "Ставка",
  },
};

export default Tower;
