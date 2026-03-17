import InfoRectangle from "./InfoRectangle.jsx";
import Banknotes from "./Banknotes.jsx";

const UserCard = (props) => {
  let {
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
    showScore = true, // New prop to control score visibility
    showGridSize = true, // New prop to control grid size visibility
    addIncreaseToBalance = true, // New prop to control if increaseAmount should be added to balance
  } = props;
  const renderBackend = props.renderBackend || "satori";
  const toUnit = (value) =>
    renderBackend === "takumi" ? value : `${value}px`;

  // Dynamic scaling based on container size
  const scaleFactor = Math.min(size.width / 540, size.height / 103);
  const scaledSize = {
    width: size.width,
    height: size.height,
    scale: scaleFactor,
  };

  // Dynamic positioning based on scale and visibility
  const BASE_POS = {
    avatar: { left: 25, top: 15, width: 70, height: 70 },
    money: {
      left: { base: 105, noScore: 105 },
      width: { base: 167, noScore: 180 },
      height: 70,
    },
    gamingLevel: {
      width: { base: 100, noScore: 175 },
      height: 70,
      gap: { base: 10, noScore: 12 },
      offset: 25,
    },
    banknotes: { left: 44, bottom: 12 },
    score: {
      left: 390,
      top: { withGrid: 15, noGrid: 21 },
      width: 95,
      height: 68,
    },
  };

  // Scale all measurements
  const scaleValue = (val) => val * scaleFactor;
  const scaled = {
    avatar: {
      left: scaleValue(BASE_POS.avatar.left),
      top: scaleValue(BASE_POS.avatar.top),
      width: scaleValue(BASE_POS.avatar.width),
      height: scaleValue(BASE_POS.avatar.height),
    },
    money: {
      left: showScore
        ? scaleValue(BASE_POS.money.left.base)
        : scaleValue(BASE_POS.money.left.noScore),
      top: scaleValue(BASE_POS.avatar.top),
      width: showScore
        ? scaleValue(BASE_POS.money.width.base)
        : scaleValue(BASE_POS.money.width.noScore),
      height: scaleValue(BASE_POS.money.height),
    },
    gamingLevel: {
      left:
        (showScore
          ? scaleValue(BASE_POS.money.left.base)
          : scaleValue(BASE_POS.money.left.noScore)) +
        (showScore
          ? scaleValue(BASE_POS.money.width.base)
          : scaleValue(BASE_POS.money.width.noScore)) +
        scaleValue(
          showScore
            ? BASE_POS.gamingLevel.gap.base
            : BASE_POS.gamingLevel.gap.noScore
        ),
      top: scaleValue(BASE_POS.avatar.top),
      width: showScore
        ? scaleValue(BASE_POS.gamingLevel.width.base)
        : scaleValue(BASE_POS.gamingLevel.width.noScore),
      height: scaleValue(BASE_POS.gamingLevel.height),
    },
    score: showScore
      ? {
          left: scaleValue(BASE_POS.score.left),
          top: showGridSize
            ? scaleValue(BASE_POS.score.top.withGrid)
            : scaleValue(BASE_POS.score.top.noGrid),
          width: scaleValue(BASE_POS.score.width),
          height: scaleValue(BASE_POS.score.height),
        }
      : null,
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

  const walletBaseBalance = Number(balance);
  const walletAmount = addIncreaseToBalance
    ? walletBaseBalance + Number(increaseAmount)
    : walletBaseBalance;
  const increaseValue = Number(increaseAmount) || 0;

  const containerStyle = {
    position: "absolute",
    left: `${position.left + 20}px`,
    bottom: `${position.bottom + 20}px`,
    width: `${scaledSize.width - 40}px`,
    height: `${scaledSize.height}px`,
    backgroundColor: "transparent",
    borderRadius: `${scaleValue(25)}px`,
    overflow: "hidden",
    display: "flex",
  };

  const userBackgroundStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: "100%",
    height: "100%",
    backgroundImage: coloring.backgroundGradient || backgroundGradient,
    borderRadius: `${scaleValue(25)}px`,
    display: "flex",
  };

  // Gaming Level - Vertical Progress Bar based on Penpot template and Balance
  const gamingLevelContainerStyle = {
    position: "absolute",
    left: `${scaled.gamingLevel.left}px`,
    top: `${scaled.gamingLevel.top}px`,
    width: `${scaled.gamingLevel.width}px`, // Use full width since we already reduced it in positioning
    height: `${scaled.gamingLevel.height}px`,
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
    width: `${scaled.gamingLevel.width}px`, // Use full container width
    height: `${scaled.gamingLevel.height}px`,
    backgroundImage: `linear-gradient(to left, ${overlayBackground} 0%, rgba(255, 68, 68, 0.5) 100%)`,
    borderRadius: `${scaleValue(20)}px`, // Rounded corners on left side only
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: `${scaleValue(8)}px`,
    overflow: "hidden",
  };

  // Red filling bar - left side (main progress) - based on Penpot template
  const gamingLevelFillStartStyle = {
    position: "absolute",
    left: "0px",
    top: "0px",
    width: `${scaled.gamingLevel.width * gameFillRatio}px`, // Use full container width for fill
    height: `${scaleValue(70)}px`,
    backgroundColor: "#d55656",
    borderRadius: `${scaleValue(20)}px ${scaleValue(20)}px ${scaleValue(
      20
    )}px ${scaleValue(20)}px`,
    display: "flex",
  };

  // Red filling bar - right side (difference/transition) - based on Penpot template
  const gamingLevelFillDifferenceStyle = {
    position: "absolute",
    left: `${scaled.gamingLevel.width * gameFillRatio}px`, // Use full container width for position
    top: "0px",
    width: `${scaleValue(7)}px`,
    right: "0px", // Remove right margin to align with container
    height: `${scaleValue(70)}px`,
    backgroundColor: "#d67373",
    borderRadius: "0px 0px 0px 0px",
    display: "flex",
  };

  const scoreTextStyle = showScore
    ? {
        position: "absolute",
        left: `${scaled.score.left}px`,
        top: `${scaled.score.top}px`,
        width: `${scaled.score.width}px`,
        height: `${scaled.score.height}px`,
        display: "flex",
      }
    : { display: "none" };

  const scoreNumberStyle = {
    position: "absolute",
    left: "0px",
    top: `${scaleValue(-3)}px`,
    width: "100%",
    height: `${scaleValue(58)}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const scoreValueStyle = {
    color: textColor,
    fontSize: "42px",
    fontFamily: "Inter", fontWeight: 500,
    fontWeight: 700,
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  const avatarStyle = {
    position: "absolute",
    left: toUnit(scaled.avatar.left),
    top: toUnit(scaled.avatar.top),
    width: toUnit(scaled.avatar.width),
    height: toUnit(scaled.avatar.height),
    display: "flex",
    borderRadius: toUnit(scaleValue(20)),
  };
  const avatarImageStyle = {
    width: toUnit(scaled.avatar.width),
    height: toUnit(scaled.avatar.height),
    objectFit: "cover",
    display: "flex",
    borderRadius: toUnit(scaleValue(20)),
  };

  const gridSizeStyle =
    showScore && showGridSize
      ? {
          position: "absolute",
          left: "0px",
          top: `${scaleValue(34)}px`,
          width: `${scaled.score?.width || scaleValue(95)}px`,
          height: `${scaleValue(58)}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }
      : { display: "none" };

  const gridSizeValueStyle = {
    color: tertiaryTextColor,
    fontSize: "20px",
    fontFamily: "Inter", fontWeight: 500,
    fontWeight: 500,
    textRendering: "geometricPrecision",
    letterSpacing: "0px",
    display: "flex",
    lineHeight: 1,
  };

  return (
    <div style={containerStyle}>
      {/* User Background Color Gradient */}
      <div style={userBackgroundStyle}></div>
      {/* Wallet InfoRectangle */}
      <div
        style={{
          position: "absolute",
          left: `${scaled.money.left}px`,
          top: `${scaled.money.top}px`,
          width: `${scaled.money.width}px`,
        }}
      >
        <InfoRectangle
          icon="💵"
          background={overlayBackground}
          borderRadius={`${scaleValue(20)}px`}
          padding={`${scaleValue(6)}px ${scaleValue(10)}px`}
          minWidth="0px"
          maxWidth="260px"
          iconSize={`${scaleValue(18)}px`}
          iconMarginRight={`${scaleValue(8)}px`}
          title="WALLET"
          titleStyle={{
            fontSize: `${12 * scaleFactor}px`,
            color: secondaryTextColor,
            opacity: 0.8,
            letterSpacing: "0.08em",
          }}
          value={
            <div style={{ display: "flex", flexDirection: "column", gap: `${scaleValue(2)}px` }}>
              <div
                style={{
                  display: "flex",
                  fontSize: `${24 * scaleFactor}px`,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1,
                }}
              >
                {walletAmount.toFixed(2)}
              </div>
              {increaseValue !== 0 && (
                <div
                  style={{
                    display: "flex",
                    fontSize: `${14 * scaleFactor}px`,
                    fontWeight: 600,
                    color:
                      increaseValue > 0
                        ? winColor
                        : increaseValue < 0
                        ? "#ff4444"
                        : textColor,
                    opacity: 0.9,
                  }}
                >
                  {increaseValue > 0 ? "+" : ""}
                  {increaseValue.toFixed(2)}
                </div>
              )}
            </div>
          }
          style={{
            position: "relative",
            width: "100%",
            boxSizing: "border-box",
            minHeight: `${scaleValue(70)}px`,
            height: `${scaleValue(70)}px`,
          }}
        >
          <Banknotes
            amount={Math.max(walletAmount, 0)}
            style="banknotes"
            division={50}
            xspacing={18}
            styleOverrides={{
              container: {
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 0,
              },
              banknote: {
                width: `${10 * scaleFactor}px`,
                height: `${3 * scaleFactor}px`,
              },
            }}
          />
        </InfoRectangle>
      </div>

      {/* Gaming XP InfoRectangle */}
      <div
        style={{
          position: "absolute",
          left: `${scaled.gamingLevel.left}px`,
          top: `${scaled.gamingLevel.top}px`,
          width: `${scaled.gamingLevel.width}px`,
        }}
      >
        <InfoRectangle
          icon="🎮"
          background={overlayBackground}
          borderRadius={`${scaleValue(20)}px`}
          padding={`${scaleValue(6)}px ${scaleValue(10)}px`}
          minWidth="0px"
          maxWidth="240px"
          iconSize={`${scaleValue(16)}px`}
          iconMarginRight={`${scaleValue(6)}px`}
          title="GAMING"
          titleStyle={{
            fontSize: `${11 * scaleFactor}px`,
            color: secondaryTextColor,
            opacity: 0.85,
            letterSpacing: "0.08em",
          }}
          value={
            <div style={{ display: "flex", flexDirection: "column", gap: `${scaleValue(2)}px` }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: `${scaleValue(4)}px`,
                  fontSize: `${20 * scaleFactor}px`,
                  fontWeight: 700,
                  color: textColor,
                  lineHeight: 1,
                }}
              >
                <span>{gamingLevel}</span>
                <span style={{ fontSize: `${12 * scaleFactor}px`, opacity: 0.85 }}>{translations.level}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: `${11 * scaleFactor}px`,
                  color: textColor,
                  opacity: 0.9,
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                {gameLevelData
                  ? `${Math.floor(currentGameXP)}/${requiredGameXP} ${translations.xp}`
                  : `0/100 ${translations.xp}`}
              </div>
            </div>
          }
          style={{
            position: "relative",
            width: "100%",
            boxSizing: "border-box",
            minHeight: `${scaleValue(70)}px`,
            height: `${scaleValue(70)}px`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              opacity: 0.5,
              background: `linear-gradient(90deg, #d55656 ${gameFillRatio * 100}%, transparent ${gameFillRatio * 100}%)`,
              zIndex: 0,
            }}
          />
        </InfoRectangle>
      </div>
      {/* Score Text - only show if enabled */}
      {showScore && (
        <div style={scoreTextStyle}>
          <div style={scoreNumberStyle}>
            <div style={scoreValueStyle}>{score}</div>
          </div>

          {showGridSize && gridSize && (
            <div style={gridSizeStyle}>
              <div style={gridSizeValueStyle}>{gridSize}</div>
            </div>
          )}
        </div>
      )}
      {/* User Avatar */}
      <div style={avatarStyle}>
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          alt="User Avatar"
          style={avatarImageStyle}
        />
      </div>

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
