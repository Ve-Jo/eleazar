const UserCard = (props) => {
  const {
    interaction,
    score = 0,
    earning = 0,
    gridSize = null,
    balance = 0,
    increaseAmount = 0,
    levelProgress = {},
    i18n,
    coloring = {},
    position = { bottom: 0, left: 0 },
    size = { width: 540, height: 103 },
  } = props;

  // Dynamic scaling based on container size
  const scaleFactor = Math.min(size.width / 540, size.height / 103);
  const scaledSize = {
    width: size.width,
    height: size.height,
    scale: scaleFactor,
  };

  // Dynamic positioning based on scale
  const dynamicPositions = {
    avatar: {
      left: 25 * scaleFactor,
      top: size.height - 88 * scaleFactor,
      width: 70 * scaleFactor,
      height: 70 * scaleFactor,
    },
    money: {
      left: 103 * scaleFactor,
      top: size.height - 88 * scaleFactor,
      width: 167 * scaleFactor,
      height: 70 * scaleFactor,
    },
    gamingLevel: {
      left: size.width - 260 * scaleFactor,
      top: size.height - 88 * scaleFactor, // Скорректировано под новую высоту 70px
      width: 90 * scaleFactor,
      height: 70 * scaleFactor, // Сделано такой же высоты как и money контейнер
    },
    score: {
      left: size.width - 152 * scaleFactor,
      top: size.height - 94 * scaleFactor,
      width: 95 * scaleFactor,
      height: 68 * scaleFactor,
    },
  };

  const translations = Object.entries(UserCard.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n?.getLocale?.()] || translations.en,
    }),
    {}
  );

  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor = "rgba(255, 255, 255, 0.5)",
    backgroundGradient = "linear-gradient(to bottom, rgba(116, 95, 76, 1) 0%, rgba(116, 95, 76, 1) 100%)",
    overlayBackground = "rgba(255, 255, 255, 0.1)",
    winColor = "#7fc94eff",
    primaryColor = "#826f5e",
    isDarkText = false,
  } = coloring;

  // Level data from levelProgress - use dynamic game level data if available
  const chatLevelData = levelProgress?.chat;
  const gameLevelData = levelProgress?.game;
  const gamingLevel = gameLevelData?.level || 1;

  // Simple progress calculation using current game level data
  const currentGameXP = gameLevelData?.currentXP || 0;
  const requiredGameXP = gameLevelData?.requiredXP || 100;
  const gameFillRatio = Math.min(currentGameXP / requiredGameXP, 1);

  // Banknote generation function - Enhanced version based on Balance.jsx
  const renderBanknotes = (
    amount,
    startX,
    baseY,
    style = "banknotes",
    division = 50,
    xspacing = 15,
    containerBounds = null
  ) => {
    const totalBanknotes = Math.ceil(amount / division);

    // If no banknotes to render, return empty array
    if (totalBanknotes <= 0) {
      return [];
    }

    const banknotes = [];
    let currentIndex = 0;

    // Default container bounds if not provided - optimized for relative positioning
    const bounds = containerBounds || {
      left: 0,
      top: 0,
      right: 89, // Match the dollarBanknoteStyle width
      bottom: 16, // Match the dollarBanknoteStyle height
      padding: 0,
    };

    // Calculate effective boundaries with padding
    const effectiveLeft = bounds.left + (bounds.padding || 0);
    const effectiveTop = bounds.top + (bounds.padding || 0);
    const effectiveRight = bounds.right - (bounds.padding || 0);
    const effectiveBottom = bounds.bottom - (bounds.padding || 0);

    // Calculate maximum available width and height
    const availableWidth = effectiveRight - effectiveLeft;
    const availableHeight = effectiveBottom - effectiveTop;

    // Banknote dimensions
    const banknoteWidth = 15; // Width of a single banknote
    const banknoteHeight = 5; // Height of a banknote

    // Dynamically calculate spacing based on container width
    // Ensure minimum spacing of 5px and maximum of provided xspacing
    const minSpacing = 5;
    const providedSpacing = xspacing || 15;

    // Calculate optimal spacing based on container width
    // Try to fit at least 3 banknotes if possible
    const minBanknotesPerRow = Math.min(3, totalBanknotes);
    const optimalSpacing = Math.min(
      providedSpacing,
      Math.max(minSpacing, availableWidth / Math.max(minBanknotesPerRow, 1))
    );

    // Use the calculated spacing
    const xSpacing = Math.min(optimalSpacing, providedSpacing);

    // Calculate how many banknotes can fit in a row with the calculated spacing
    const maxFittingInRow = Math.floor(availableWidth / xSpacing);

    // We're not limiting by maxRowLength anymore since we're using container bounds
    const adjustedMaxRowLength = maxFittingInRow;

    // If we can't fit even one banknote, don't render any
    if (adjustedMaxRowLength <= 0) {
      return [];
    }

    // Calculate how many rows we can fit before hitting the top
    const ySpacing = 5; // Vertical spacing between rows

    // Add a buffer to prevent touching the top (at least 5px from top)
    const safeTopMargin = 5;
    const maxRows = Math.max(
      1,
      Math.floor((baseY - effectiveTop - safeTopMargin) / ySpacing)
    );

    // Calculate rows needed for all banknotes
    const fullRows = Math.floor(totalBanknotes / adjustedMaxRowLength);
    const remaining = totalBanknotes % adjustedMaxRowLength;
    const rowsNeeded = fullRows + (remaining > 0 ? 1 : 0);

    // Limit the number of rows to prevent touching the top
    const limitedRows = Math.min(rowsNeeded, maxRows);

    // Calculate how many banknotes we can display in the limited rows
    const maxBanknotesToShow = limitedRows * adjustedMaxRowLength;
    const limitedBanknotes = Math.min(totalBanknotes, maxBanknotesToShow);

    // Recalculate rows with limited banknotes
    const limitedFullRows = Math.floor(limitedBanknotes / adjustedMaxRowLength);
    const limitedRemaining = limitedBanknotes % adjustedMaxRowLength;

    // Render banknotes row by row
    for (let row = 0; row < limitedRows; row++) {
      const banknotesInThisRow =
        row < limitedFullRows
          ? adjustedMaxRowLength
          : row === limitedFullRows
          ? limitedRemaining
          : 0;

      if (banknotesInThisRow <= 0) continue;

      // Calculate the total width of banknotes in this row
      const totalWidth = banknotesInThisRow * xSpacing;

      // Center the banknotes within the available space
      // If startX is within the container, center around it
      // Otherwise, center within the container
      const rowCenterX =
        startX >= effectiveLeft && startX <= effectiveRight
          ? startX
          : effectiveLeft + availableWidth / 2;

      const startXPos = Math.max(
        effectiveLeft,
        Math.min(rowCenterX - totalWidth / 2, effectiveRight - totalWidth)
      );

      // Place banknotes in this row
      for (let col = 0; col < banknotesInThisRow; col++) {
        if (currentIndex >= limitedBanknotes) break;

        // Add small random offset for natural look (but constrained)
        const randomOffset = Math.random() * 2 - 1; // Reduced randomness

        // Calculate position with constraints
        const xPos = Math.max(
          effectiveLeft,
          Math.min(
            startXPos + col * xSpacing + randomOffset,
            effectiveRight - banknoteWidth
          )
        );

        // Ensure banknotes don't touch the top
        const yPos = Math.max(
          effectiveTop + safeTopMargin,
          Math.min(baseY - row * ySpacing, effectiveBottom - banknoteHeight)
        );

        // Apply styling based on the style parameter
        if (style === "banknotes") {
          // Green banknotes with orange stripe
          banknotes.push(
            <div
              key={currentIndex}
              style={{
                position: "absolute",
                left: `${xPos}px`,
                top: `${yPos}px`,
                width: "15px",
                height: "5px",
                background: "#4CAF50",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: 0.3,
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "3px",
                  height: "100%",
                  background: "#FF9800", // Orange stripe
                }}
              />
            </div>
          );
        } else if (style === "bars") {
          // Green golden bars (solid gold with green border for effect)
          banknotes.push(
            <div
              key={currentIndex}
              style={{
                position: "absolute",
                left: `${xPos}px`,
                top: `${yPos}px`,
                width: "15px",
                height: "5px",
                background: "#DAA520", // Gold gradient
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: 0.3,
              }}
            />
          );
        }
        currentIndex++;
      }
    }

    return banknotes;
  };

  const containerStyle = {
    position: "absolute",
    left: `${position.left + 20}px`,
    bottom: `${position.bottom + 20}px`,
    width: `${size.width - 40}px`,
    height: `${size.height}px`,
    background: coloring.backgroundGradient || backgroundGradient,
    borderRadius: "25px",
    overflow: "hidden",
    display: "flex",
    zIndex: 10,
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  };

  const userBackgroundStyle = {
    position: "absolute",
    left: "9px",
    top: `${size.height - 103}px`,
    width: `${size.width - 19}px`,
    height: "103px",
    background: coloring.backgroundGradient || backgroundGradient,
    borderRadius: "25px",
    display: "flex",
    zIndex: 1,
  };

  const moneyContainerStyle = {
    position: "absolute",
    left: `${dynamicPositions.money.left}px`,
    top: `${dynamicPositions.money.top}px`,
    width: `${dynamicPositions.money.width}px`,
    height: `${dynamicPositions.money.height}px`,
    display: "flex",
    zIndex: 2,
    transform: `scale(${scaleFactor})`,
    transformOrigin: "top left",
  };

  const dollarBanknoteStyle = {
    position: "absolute",
    left: `${dynamicPositions.money.left}px`, // Align with money container
    bottom: "0px", // Touch the bottom edge of UserCard container
    width: `${dynamicPositions.money.width}px`, // Match balance container width
    height: "16px",
    display: "flex",
    zIndex: 1,
    overflow: "hidden",
  };

  const moneyBackgroundStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "167px",
    height: "70px",
    background: overlayBackground,
    borderRadius: "20px",
    display: "flex",
  };

  const dollarEmojiStyle = {
    position: "absolute",
    left: "13px",
    top: "20px",
    width: "29px",
    height: "29px",
    display: "flex",
    fontSize: "24px",
    justifyContent: "center",
    alignItems: "center",
    color: "#FFD700",
  };

  const balanceTextStyle = {
    position: "absolute",
    left: "55px",
    top: "26px",
    width: "97px",
    height: "29px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  };

  const balanceNumberStyle = {
    color: textColor,
    fontSize: `${27 * scaleFactor}px`,
    fontFamily: "Inter600",
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  const increaseTextStyle = {
    position: "absolute",
    left: "99px",
    top: "8px",
    height: "18px",
    display: "flex",
    alignItems: "center",
  };

  const increaseNumberStyle = {
    color: winColor,
    fontSize: `${15 * scaleFactor}px`,
    fontFamily: "Inter600",
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  // Gaming Level - Vertical Progress Bar based on Penpot template and Balance
  const gamingLevelContainerStyle = {
    position: "absolute",
    left: `${dynamicPositions.gamingLevel.left}px`,
    top: `${dynamicPositions.gamingLevel.top}px`,
    width: `${dynamicPositions.gamingLevel.width}px`,
    height: `${dynamicPositions.gamingLevel.height}px`,
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
  };

  // Main background with gradient - like in Penpot template, ending with overlayBackground
  const gamingLevelBackgroundStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: `${dynamicPositions.gamingLevel.width}px`,
    height: `${dynamicPositions.gamingLevel.height}px`,
    background: `linear-gradient(to left, ${overlayBackground} 0%, rgba(255, 68, 68, 0.5) 100%)`,
    borderRadius: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "8px",
    overflow: "hidden",
  };

  // Red filling bar - left side (main progress) - based on Penpot template
  const gamingLevelFillStartStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: `${dynamicPositions.gamingLevel.width * gameFillRatio}px`,
    height: "70px",
    background: "#d55656",
    borderRadius: "20px 20px 20px 20px",
    display: "flex",
  };

  // Red filling bar - right side (difference/transition) - based on Penpot template
  const gamingLevelFillDifferenceStyle = {
    position: "absolute",
    left: `${dynamicPositions.gamingLevel.width * gameFillRatio}px`,
    top: "0px",
    width: "7px",
    height: "70px",
    background: "#d67373",
    borderRadius: "0px 0px 0px 0px",
    display: "flex",
  };

  const scoreTextStyle = {
    position: "absolute",
    left: `${dynamicPositions.score.left}px`,
    top: `${dynamicPositions.score.top}px`,
    width: `${dynamicPositions.score.width}px`,
    height: `${dynamicPositions.score.height}px`,
    zIndex: 2,
    display: "flex",
    transform: `scale(${scaleFactor})`,
    transformOrigin: "top left",
  };

  const scoreNumberStyle = {
    position: "absolute",
    left: "0px",
    top: "-3px",
    width: "100%",
    height: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const scoreValueStyle = {
    color: textColor,
    fontSize: "42px",
    fontFamily: "Inter600",
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  const avatarStyle = {
    position: "absolute",
    left: `${dynamicPositions.avatar.left}px`,
    top: `${dynamicPositions.avatar.top}px`,
    width: `${dynamicPositions.avatar.width}px`,
    height: `${dynamicPositions.avatar.height}px`,
    zIndex: 2,
    display: "flex",
    transform: `scale(${scaleFactor})`,
    transformOrigin: "top left",
    borderRadius: "20px",
  };

  const gridSizeStyle = {
    position: "absolute",
    left: "0px",
    top: "34px",
    width: `${dynamicPositions.score.width}px`,
    height: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const gridSizeValueStyle = {
    color: tertiaryTextColor,
    fontSize: "20px",
    fontFamily: "Inter600",
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      {/* User Background Color Gradient */}
      <div style={userBackgroundStyle}></div>
      {/* Money Container */}
      <div style={moneyContainerStyle}>
        <div style={moneyBackgroundStyle}></div>
        <div style={dollarEmojiStyle}>💵</div>

        {/* Balance Text with Green Highlighting for Earned Amount */}
        <div style={balanceTextStyle}>
          <div style={balanceNumberStyle}>
            {(() => {
              // Use only economy.balance (not bankBalance) with earned amounts
              const walletBalance = Number(balance);
              const currentBalance = walletBalance + Number(increaseAmount);
              const balanceStr = currentBalance.toFixed(2);
              const [wholePart, decimalPart] = balanceStr.split(".");
              const increaseStr = increaseAmount.toFixed(2);
              const [increaseWhole, increaseDecimal] = increaseStr.split(".");

              // Calculate which digits should be green
              const wholeDigits = wholePart.split("");
              const decimalDigits = decimalPart.split("");
              const increaseWholeDigits = increaseWhole.split("");
              const increaseDecimalDigits = increaseDecimal.split("");

              // Function to highlight digits from the right
              const highlightDigits = (digits, highlightDigits, color) => {
                const result = [];
                const startHighlight = Math.max(
                  0,
                  digits.length - highlightDigits.length
                );

                for (let i = 0; i < digits.length; i++) {
                  const isHighlighted =
                    i >= startHighlight &&
                    i - startHighlight < highlightDigits.length;
                  result.push(
                    <span
                      key={i}
                      style={{
                        color: isHighlighted ? color : textColor,
                      }}
                    >
                      {digits[i]}
                    </span>
                  );
                }
                return result;
              };

              return (
                <>
                  {highlightDigits(wholeDigits, increaseWholeDigits, winColor)}
                  <span style={{ color: winColor }}>.</span>
                  {highlightDigits(
                    decimalDigits,
                    increaseDecimalDigits,
                    winColor
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* Increase Text */}
        {increaseAmount > 0 && (
          <div style={increaseTextStyle}>
            <div style={increaseNumberStyle}>+{increaseAmount.toFixed(2)}</div>
          </div>
        )}
      </div>
      {/* Gaming Level - Vertical Progress Bar based on Penpot template */}
      <div style={gamingLevelContainerStyle}>
        {/* Gradient Background - Like in Penpot template */}
        <div style={gamingLevelBackgroundStyle} />

        {/* Red filling bars - like in Penpot template */}
        <div style={gamingLevelFillStartStyle} />
        {/*<div style={gamingLevelFillDifferenceStyle} />*/}

        {/* Content overlay */}
        <div
          style={{
            position: "absolute",
            left: "0px",
            top: "0px",
            width: `${dynamicPositions.gamingLevel.width}px`,
            height: `${dynamicPositions.gamingLevel.height}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingLeft: "15px",
          }}
        >
          {/* Level Number - Larger text like in Penpot template */}
          <div
            style={{
              fontSize: `${27 * scaleFactor}px`,
              color: textColor,
              fontFamily: "Inter600",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "flex-start",
              marginBottom: "2px",
            }}
          >
            <span>{gamingLevel}</span>
            <span
              style={{
                fontSize: `${12 * scaleFactor}px`,
                top: "-3px",
              }}
            >
              lvl
            </span>
          </div>

          {/* XP Text - Smaller text like in Penpot template with dynamic progress */}
          <div
            style={{
              fontSize: `${12 * scaleFactor}px`,
              color: textColor,
              fontFamily: "Inter600",
              display: "flex",
              justifyContent: "flex-start",
              textRendering: "geometricPrecision",
              letterSpacing: "0px",
            }}
          >
            {gameLevelData
              ? `${Math.floor(currentGameXP)}/${requiredGameXP} XP`
              : "0/100 XP"}
          </div>
        </div>
      </div>
      {/* Score Text */}
      <div style={scoreTextStyle}>
        <div style={scoreNumberStyle}>
          <div style={scoreValueStyle}>{score}</div>
        </div>

        {gridSize && (
          <div style={gridSizeStyle}>
            <div style={gridSizeValueStyle}>{gridSize}</div>
          </div>
        )}
      </div>
      {/* User Avatar */}
      <div style={avatarStyle}>
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          alt="User Avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "20px",
          }}
        />
      </div>

      {/* Dollar Banknote Generation - Positioned at bottom of UserCard container */}
      {increaseAmount > 0 && (
        <div style={dollarBanknoteStyle}>
          {renderBanknotes(increaseAmount, 44, 12, "banknotes", 10, 18, {
            left: 0,
            top: 0,
            right: dynamicPositions.money.width, // Match balance container width
            bottom: 16,
            padding: 0,
          })}
        </div>
      )}
    </div>
  );
};

UserCard.dimensions = {
  width: 540,
  height: 103,
};

UserCard.localization_strings = {
  level: {
    en: "lvl",
    ru: "ур",
    uk: "рів",
  },
  xp: {
    en: "XP",
    ru: "ОП",
    uk: "ДД",
  },
};

export default UserCard;
