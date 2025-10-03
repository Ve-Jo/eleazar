const CrateRewards = (props) => {
  const {
    interaction,
    locale,
    crateType,
    crateEmoji,
    crateName,
    rewards,
    coloring,
    width = 750,
    height = 450,
  } = props;

  // Parse rewards if it's a string
  const parsedRewards = typeof rewards === 'string' ? JSON.parse(rewards) : rewards;
  
  // Debug logging
  console.log("CrateRewards - Original rewards:", rewards, "Type:", typeof rewards);
  console.log("CrateRewards - Parsed rewards:", parsedRewards);
  console.log("CrateRewards - Parsed rewards.coins:", parsedRewards?.coins);

  // Extract coloring props or use defaults
  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "#CCCCCC",
    tertiaryTextColor = "#999999",
    overlayBackground = "rgba(0, 0, 0, 0.25)",
    backgroundGradient = "linear-gradient(135deg, #2a2a72 0%, #121236 100%)",
  } = coloring || {};

  // Get translations based on locale
  const translations = Object.entries(CrateRewards.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[locale] || translations.en,
    }),
    {}
  );

  // Helper function to render a reward item
  const renderRewardItem = (emoji, title, value, color = "#4caf50") => {
    return (
      <div
        style={{
          backgroundColor: overlayBackground,
          borderRadius: "10px",
          padding: "15px",
          display: "flex",
          alignItems: "center",
          marginBottom: "10px",
          width: useGridLayout ? "48%" : "100%",
          marginRight: "4px",
        }}
      >
        <div
          style={{
            fontSize: "32px",
            marginRight: "15px",
            display: "flex",
          }}
        >
          {emoji}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              fontWeight: "bold",
              color: textColor,
              fontFamily: "Inter600",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "14px",
              color,
              fontFamily: "Inter600",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {value}
          </div>
        </div>
      </div>
    );
  };

  // Count total rewards to determine layout
  const totalRewards =
    (parsedRewards.coins > 0 ? 1 : 0) +
    (parsedRewards.seasonXp > 0 ? 1 : 0) +
    (parsedRewards.discount > 0 ? 1 : 0) +
    Object.keys(parsedRewards.cooldownReductions || {}).length;

  // Use multi-column layout for 4+ rewards
  const useGridLayout = totalRewards >= 4;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "20px",
        padding: "25px",
        fontFamily: "Inter400, sans-serif",
        color: textColor,
        background: backgroundGradient,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
          marginBottom: "20px",
        }}
      >
        <img
          src={interaction.user.avatarURL}
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "20%",
            backgroundColor: overlayBackground,
            display: "flex",
          }}
          alt={translations.userAvatarAlt}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              fontWeight: "bold",
              color: textColor,
              fontFamily: "Inter600",
              display: "flex",
            }}
          >
            {translations.rewardsTitle}
          </div>
          <div
            style={{
              fontSize: "16px",
              color: secondaryTextColor,
              display: "flex",
            }}
          >
            {translations.fromCrate.replace("{crateName}", crateName)}
          </div>
        </div>
      </div>

      {/* Main content: Left side (rewards) and right side (crate) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexGrow: 1,
        }}
      >
        {/* Left side - Rewards list */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "65%", // Fixed percentage instead of flexBasis
            overflowY: "auto",
            paddingRight: "20px",
          }}
        >
          <div
            style={{
              fontSize: "22px",
              fontWeight: "bold",
              marginBottom: "15px",
              color: textColor,
              fontFamily: "Inter600",
              display: "flex",
            }}
          >
            {translations.rewardsReceived}
          </div>

          {/* Render rewards */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {/* Coins reward */}
            {parsedRewards.coins > 0 &&
              renderRewardItem(
                "💵",
                translations.coins,
                `+${parsedRewards.coins}`,
                "#4caf50" // Green color for positive
              )}



            {/* Season XP reward */}
            {parsedRewards.seasonXp > 0 &&
              renderRewardItem(
                "🌟",
                translations.seasonXp,
                `+${parsedRewards.seasonXp}`,
                "#ff6b35" // Orange color
              )}

            {/* Discount reward */}
            {parsedRewards.discount > 0 &&
              renderRewardItem(
                "🛒",
                translations.discount,
                `${parsedRewards.discount}% ${translations.onAllUpgrades}`,
                "#9c27b0" // Purple color
              )}

            {/* Cooldown reduction rewards */}
            {Object.entries(parsedRewards.cooldownReductions || {}).map(
              ([cooldownType, amount], index) => {
                // Get readable cooldown type name
                const cooldownNames = {
                  daily: translations.dailyCrate,
                  work: translations.workCommand,
                  crime: translations.crimeCommand,
                  message: translations.messageRewards,
                };

                // Convert milliseconds to minutes for display
                const minutes = Math.floor(amount / (60 * 1000));

                // Create a more compact display for longer languages
                const reductionText = `${minutes} ${translations.minutes} ${
                  translations.for
                } ${cooldownNames[cooldownType] || cooldownType}`;

                return renderRewardItem(
                  "⏱️",
                  translations.cooldownReduction,
                  reductionText,
                  "#ff9800" // Orange color
                );
              }
            )}

            {/* If no rewards, show message */}
            {!parsedRewards.coins &&
               !parsedRewards.seasonXp &&
               !parsedRewards.discount &&
               Object.keys(parsedRewards.cooldownReductions || {}).length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: tertiaryTextColor,
                    fontSize: "18px",
                    fontFamily: "Inter400",
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  {translations.noRewards}
                </div>
              )}
          </div>
        </div>

        {/* Right side - Crate display */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "35%", // Fixed percentage instead of flexBasis
            alignSelf: "center", // Center vertically
          }}
        >
          <div
            style={{
              backgroundColor: "#ffb700",
              borderRadius: "20px",
              width: "220px",
              height: "220px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "110px",
              boxShadow: "0 0 30px rgba(255, 183, 0, 0.5)",
              marginBottom: "15px",
            }}
          >
            {crateEmoji || "🎁"}
          </div>
          <div
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#ffb700",
              textAlign: "center",
              fontFamily: "Inter600",
            }}
          >
            {crateName}
          </div>
        </div>
      </div>
    </div>
  );
};

// Set dimensions for the component
CrateRewards.dimensions = {
  width: 750,
  height: 450,
};

// Static translations object
CrateRewards.localization_strings = {
  rewardsTitle: {
    en: "Rewards",
    ru: "Награды",
    uk: "Нагороди",
  },
  fromCrate: {
    en: "From {crateName}",
    ru: "Из {crateName}",
    uk: "З {crateName}",
  },
  userAvatarAlt: {
    en: "User Avatar",
    ru: "Аватар пользователя",
    uk: "Аватар користувача",
  },
  rewardsReceived: {
    en: "Rewards Received",
    ru: "Полученные награды",
    uk: "Отримані нагороди",
  },
  coins: {
    en: "Coins",
    ru: "Монеты",
    uk: "Монети",
  },
  xp: {
    en: "Experience Points",
    ru: "Очки опыта",
    uk: "Очки досвіду",
  },
  seasonXp: {
    en: "Season XP",
    ru: "Сезонный опыт",
    uk: "Сезонний досвід",
  },
  discount: {
    en: "Discount",
    ru: "Скидка",
    uk: "Знижка",
  },
  cooldownReduction: {
    en: "Cooldown Reduction",
    ru: "Сокращение перезарядки",
    uk: "Скорочення перезарядки",
  },
  minutes: {
    en: "minutes",
    ru: "минут",
    uk: "хвилин",
  },
  on: {
    en: "on",
    ru: "на",
    uk: "на",
  },
  for: {
    en: "for",
    ru: "для",
    uk: "для",
  },
  noRewards: {
    en: "No rewards received",
    ru: "Награды не получены",
    uk: "Нагороди не отримані",
  },
  dailyBonus: {
    en: "Daily Bonus",
    ru: "Ежедневный бонус",
    uk: "Щоденний бонус",
  },
  dailyCooldown: {
    en: "Daily Cooldown",
    ru: "Перезарядка ежедневного",
    uk: "Перезарядка щоденного",
  },
  crime: {
    en: "Crime",
    ru: "Преступление",
    uk: "Злочин",
  },
  bankRate: {
    en: "Bank Interest",
    ru: "Банковский процент",
    uk: "Банківський відсоток",
  },
  gamesEarning: {
    en: "Games Earnings",
    ru: "Доход от игр",
    uk: "Дохід від ігор",
  },
  dailyCrate: {
    en: "Daily Crate",
    ru: "Ежедневный ящик",
    uk: "Щоденна скриня",
  },
  workCommand: {
    en: "Work Command",
    ru: "Команда работы",
    uk: "Команда роботи",
  },
  crimeCommand: {
    en: "Crime Command",
    ru: "Команда преступления",
    uk: "Команда злочину",
  },
  messageRewards: {
    en: "Message Rewards",
    ru: "Награды за сообщения",
    uk: "Нагороди за повідомлення",
  },
  onAllUpgrades: {
    en: "on all upgrades",
    ru: "на всех улучшениях",
    uk: "на всіх улучшеннях",
  },
};

export default CrateRewards;
