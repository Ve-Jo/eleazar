import React from "react";

// Helper function to format time difference
const timeAgo = (timestamp, locale = "en") => {
  const now = Date.now();
  const secondsPast = (now - timestamp) / 1000;

  if (secondsPast < 60) {
    return `${Math.round(secondsPast)}s ago`; // Use appropriate localization later
  }
  if (secondsPast < 3600) {
    return `${Math.round(secondsPast / 60)}m ago`;
  }
  if (secondsPast <= 86400) {
    return `${Math.round(secondsPast / 3600)}h ago`;
  }
  // Add more cases for days, weeks etc. if needed
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale);
};

const Coinflip = (props) => {
  const {
    interaction,
    betAmount = 0,
    winProbability = 0.5, // Add prop with default
    potentialProfitMultiplier = 0.9, // Add prop with default (0.95 for 50%)
    lastResult = "none", // Still needed for potential overall status, though not explicitly shown
    balance = 0, // Added balance prop
    recentGames = [
      {
        bet: 10,
        result: "win",
        change: 10,
        timestamp: Date.now(),
      },
    ], // Added recentGames prop
    i18n,
    coloring = {}, // Use coloring prop for theme
  } = props;

  const safeI18n = i18n || {
    getLocale: () => "en",
    __: (key) => key.split(".").pop(),
  };

  const translations = Object.entries(Coinflip.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[safeI18n.getLocale()] || translations.en,
    }),
    {}
  );

  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor = "rgba(255, 255, 255, 0.4)",
    backgroundGradient = "linear-gradient(145deg, #5A6E8A, #3E4E64)", // Darker background
    overlayBackground = "rgba(255, 255, 255, 0.08)", // Slightly more visible overlay
    winColor = "#4CAF50", // Green for win
    loseColor = "#F44336", // Red for lose
  } = coloring;

  const containerStyle = {
    width: "450px", // Wider container
    height: "250px", // Adjusted height
    background: backgroundGradient,
    borderRadius: "15px",
    fontFamily: "Inter600, Roboto, sans-serif",
    padding: "20px",
    display: "flex",
    // Use justifyContent: 'space-between' to push elements apart
    justifyContent: "space-between",
    alignItems: "center", // Vertically center items
    position: "relative",
    color: textColor,
    gap: "20px", // Add gap between main sections
  };

  const leftSectionStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    left: "25px",
    justifyContent: "center", // Center coin vertically
    flexShrink: 0,
  };

  const coinStyle = {
    fontSize: "100px", // Adjusted size
    marginBottom: "10px", // Space below coin
  };

  // Info section below coin
  const infoStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px", // Increased gap
  };

  const balanceTextStyle = {
    fontSize: "16px", // Adjusted size
    fontWeight: "bold",
    color: textColor,
    margin: 0,
  };

  const betTextStyle = {
    fontSize: "14px", // Adjusted size
    color: secondaryTextColor,
    margin: 0,
  };

  // Style for displaying chance and payout
  const chanceInfoStyle = {
    fontSize: "14px",
    color: tertiaryTextColor,
    margin: 0,
    textAlign: "center",
  };

  const rightSectionStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end", // Align avatar and history to the right
    gap: "15px", // Gap between avatar and history
    flexGrow: 1, // Allow this section to take remaining space
    height: "100%", // Take full height
    justifyContent: "space-between", // Space avatar top, history bottom
  };

  const avatarStyle = {
    width: "60px", // Adjusted size
    height: "60px", // Adjusted size
    borderRadius: "25%", // Rounded square as per screenshot
    objectFit: "cover",
    flexShrink: 0,
    alignSelf: "flex-end", // Keep avatar to the right
  };

  const historyContainerStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%", // Take full width of the right section
    alignItems: "flex-end", // Align history items to the right
  };

  const historyItemStyle = (result) => ({
    backgroundColor: overlayBackground,
    borderRadius: "8px",
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "85%", // Adjusted width
  });

  const historyTextStyle = {
    fontSize: "14px",
    color: secondaryTextColor,
    fontWeight: "500",
    margin: 0,
    whiteSpace: "nowrap",
  };

  const historyAmountStyle = (result) => ({
    fontSize: "16px",
    fontWeight: "bold",
    color: result === "win" ? winColor : loseColor,
    margin: 0,
  });

  const historyBetStyle = {
    fontSize: "16px",
    fontWeight: "bold",
    color: textColor,
    margin: 0,
  };

  const historyArrowStyle = {
    fontSize: "16px",
    color: tertiaryTextColor,
    margin: "0 5px",
  };

  return (
    <div style={containerStyle}>
      {/* Left Section (Coin and Info) */}
      <div style={leftSectionStyle}>
        <div style={coinStyle}>🪙</div>
        <div style={infoStyle}>
          <p style={balanceTextStyle}>
            {translations.balanceLabel} {balance?.toFixed(2) ?? "0.00"} 💵
          </p>
          <p style={betTextStyle}>
            {translations.betAmountLabel} {betAmount?.toFixed(2) ?? "0.00"} 💵
          </p>
          {/* Display Chance and Potential Profit */}
          <p style={chanceInfoStyle}>
            {`${(winProbability * 100).toFixed(0)}% / x${(
              1 + potentialProfitMultiplier
            ).toFixed(2)}`}
          </p>
        </div>
      </div>

      {/* Right Section (Avatar and History) */}
      <div style={rightSectionStyle}>
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          alt="User Avatar"
          style={avatarStyle}
        />

        <div style={historyContainerStyle}>
          {recentGames.slice(0, 3).map((game, index) => (
            <div key={index} style={historyItemStyle(game.result)}>
              <span style={historyTextStyle}>
                {timeAgo(game.timestamp, safeI18n.getLocale())}
              </span>
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={historyBetStyle}>{game.bet.toFixed(2)}</span>
                <span style={historyArrowStyle}>&gt;</span>
                <span style={historyAmountStyle(game.result)}>
                  {(game.bet + game.change).toFixed(2)}{" "}
                  {/* Show resulting amount */}
                </span>
              </div>
            </div>
          ))}
          {recentGames.length === 0 && (
            <div
              style={{
                ...historyItemStyle("none"),
                justifyContent: "center",
                width: "85%", // Match width
              }}
            >
              <span style={{ ...historyTextStyle, color: tertiaryTextColor }}>
                {translations.noRecentFlips}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Coinflip.dimensions = {
  width: 450, // Match container width
  height: 250, // Match container height
};

// Add localization strings directly to the component
Coinflip.localization_strings = {
  balanceLabel: {
    // Changed key for clarity
    en: "Balance:",
    ru: "Баланс:",
    uk: "Баланс:",
  },
  betAmountLabel: {
    // Changed key for clarity
    en: "Bet:",
    ru: "Ставка:",
    uk: "Ставка:",
  },
  resultWin: {
    en: "Win",
    ru: "Победа",
    uk: "Перемога",
  },
  resultLose: {
    en: "Loss",
    ru: "Поражение",
    uk: "Поразка",
  },
  noRecentFlips: {
    en: "No recent flips",
    ru: "Нет последних подкидываний",
    uk: "Немає останніх підкидань",
  },
  // Add time units if needed for timeAgo helper
};

export default Coinflip;
