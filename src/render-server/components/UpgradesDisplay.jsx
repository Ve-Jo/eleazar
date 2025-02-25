const UpgradesDisplay = (props) => {
  let {
    interaction,
    upgrades,
    currentUpgrade,
    balance,
    width = 600,
    height = 350,
    i18n,
    coloring,
  } = props;

  //currentUpgrade = 1;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(
    UpgradesDisplay.localization_strings
  ).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  const {
    textColor = "white",
    secondaryTextColor = "rgba(255, 255, 255, 0.8)",
    tertiaryTextColor = "rgba(255, 255, 255, 0.6)",
    overlayBackground = "rgba(0, 0, 0, 0.25)",
    backgroundGradient = "#2196f3",
    isDarkText = false,
  } = coloring || {};

  const padding = 20;
  const upgradeCardWidth = 200;
  const upgradeCardHeight = 180;
  const cardMarginRight = 15;

  // Group upgrades by category
  const defaultUpgrades = [
    {
      emoji: "🎁",
      title: "Daily Bonus",
      description: "Increase your daily bonus multiplier by 15%",
      currentLevel: 1,
      nextLevel: 2,
      price: 20,
      progress: 50,
      id: 1,
      category: "economy",
      effectPerLevel: 15, // 15% per level
      effectUnit: "%", // percentage
    },
    {
      emoji: "🦹",
      title: "Crime Cooldown",
      description: "Reduce crime cooldown by 20 minutes",
      currentLevel: 1,
      nextLevel: 2,
      price: 50,
      progress: 50,
      id: 2,
      category: "economy",
      effectPerLevel: 20, // 20 minutes per level
      effectUnit: "m", // minutes
    },
  ];

  if (!upgrades) upgrades = defaultUpgrades;
  if (typeof currentUpgrade === "undefined") currentUpgrade = 0;
  if (!balance) balance = 0;

  // Group upgrades by category
  const groupedUpgrades = upgrades.reduce((acc, upgrade) => {
    const category = upgrade.category || "economy";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(upgrade);
    return acc;
  }, {});

  // Calculate visible cards per row
  const visibleWidth = width - padding * 2;
  const cardsPerRow = Math.floor(
    visibleWidth / (upgradeCardWidth + cardMarginRight)
  );

  // Function to get visible upgrades for a category
  const getVisibleUpgrades = (categoryUpgrades, category) => {
    if (currentUpgrade === undefined || currentUpgrade < 0) {
      return { visibleUpgrades: categoryUpgrades, shift: 0 };
    }

    const selectedUpgrade = upgrades[currentUpgrade];
    if (!selectedUpgrade) {
      return { visibleUpgrades: categoryUpgrades, shift: 0 };
    }

    // Only shift if the selected upgrade is in this category
    if ((selectedUpgrade.category || "economy") !== category) {
      return { visibleUpgrades: categoryUpgrades, shift: 0 };
    }

    // Find the index of the selected upgrade within its category
    const indexInCategory = categoryUpgrades.findIndex(
      (u) =>
        u.id === selectedUpgrade.id ||
        (u.title === selectedUpgrade.title &&
          u.category === selectedUpgrade.category)
    );

    if (indexInCategory === -1) {
      return { visibleUpgrades: categoryUpgrades, shift: 0 };
    }

    // Calculate how many cards can be displayed at once
    const maxVisibleCards = Math.floor(
      visibleWidth / (upgradeCardWidth + cardMarginRight)
    );

    // If all cards fit, no need to shift
    if (categoryUpgrades.length <= maxVisibleCards) {
      return { visibleUpgrades: categoryUpgrades, shift: 0 };
    }

    // Calculate the ideal position to center the selected card
    const idealPosition = Math.floor(maxVisibleCards / 2);

    // Calculate the shift needed to position the selected card at the ideal position
    let shift = indexInCategory - idealPosition;

    // Ensure we don't shift too far left (beginning of the list)
    shift = Math.max(0, shift);

    // Ensure we don't shift too far right (end of the list)
    const maxShift = categoryUpgrades.length - maxVisibleCards;
    shift = Math.min(shift, maxShift > 0 ? maxShift : 0);

    return {
      visibleUpgrades: categoryUpgrades,
      shift: -shift * (upgradeCardWidth + cardMarginRight),
    };
  };

  // Calculate if a category is active (has the currently selected upgrade)
  const isCategoryActive = (category) => {
    if (currentUpgrade === undefined || currentUpgrade < 0) {
      return category === Object.keys(groupedUpgrades)[0]; // Default to first category if no upgrade selected
    }

    const selectedUpgrade = upgrades[currentUpgrade];
    if (!selectedUpgrade) {
      return category === Object.keys(groupedUpgrades)[0]; // Default to first category if no upgrade selected
    }

    return (selectedUpgrade.category || "economy") === category;
  };

  // Get the active category
  const getActiveCategory = () => {
    if (currentUpgrade === undefined || currentUpgrade < 0) {
      return Object.keys(groupedUpgrades)[0]; // Default to first category if no upgrade selected
    }

    const selectedUpgrade = upgrades[currentUpgrade];
    if (!selectedUpgrade) {
      return Object.keys(groupedUpgrades)[0]; // Default to first category if no upgrade selected
    }

    return selectedUpgrade.category || "economy";
  };

  const activeCategory = getActiveCategory();

  // Calculate total content height for proper scrolling
  const calculateTotalContentHeight = () => {
    // Since we're only showing one category, we just need the height for that category
    return 30 + upgradeCardHeight + 10; // title height + card height + padding
  };

  // Render an upgrade card
  const renderUpgradeCard = (upgrade, index) => {
    const isSelected = currentUpgrade === index;
    const BORDER_RADIUS = 15;
    const HIGHLIGHT_BORDER = 4;

    // Card background color based on selection and theme
    const cardBackground = isSelected
      ? isDarkText
        ? "rgba(255, 165, 0, 0.8)"
        : "#FFA500"
      : isDarkText
      ? "rgba(25, 118, 210, 0.8)"
      : "#1976d2";

    return (
      <div
        key={`upgrade-${upgrade.id || index}`}
        style={{
          width: `${upgradeCardWidth}px`,
          height: `${upgradeCardHeight}px`,
          backgroundColor: cardBackground,
          borderRadius: `${BORDER_RADIUS}px`,
          border: isSelected ? `${HIGHLIGHT_BORDER}px solid #FFA500` : "none",
          display: "flex",
          flexDirection: "column",
          padding: "10px",
          marginRight: `${cardMarginRight}px`,
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Emoji and Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "45px",
              height: "45px",
              backgroundColor: overlayBackground,
              borderRadius: "10px",
              marginRight: "10px",
            }}
          >
            {upgrade.emoji}
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: "bold",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "flex",
              color: "white",
              maxWidth: "125px",
            }}
          >
            {upgrade.title}
          </div>
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: "12px",
            opacity: 0.9,
            marginBottom: "10px",
            height: "40px",
            overflow: "hidden",
            display: "flex",
            color: "white",
          }}
        >
          {upgrade.description}
        </div>

        {/* Level and Price */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: overlayBackground,
              borderRadius: "8px",
              padding: "4px 8px",
              fontSize: "13px",
              color: "white",
            }}
          >
            {translations.level} {upgrade.currentLevel} → {upgrade.nextLevel}
          </div>
          <div
            style={{
              backgroundColor: isDarkText
                ? "rgba(255, 165, 0, 0.8)"
                : "#FFA500",
              borderRadius: "8px",
              padding: "4px 8px",
              fontSize: "13px",
              fontWeight: "bold",
              display: "flex",
              color: "white",
            }}
          >
            {upgrade.price} 💵
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: overlayBackground,
            borderRadius: "4px",
            overflow: "hidden",
            marginTop: "auto",
            display: "flex",
          }}
        >
          <div
            style={{
              width: `${upgrade.progress}%`,
              height: "100%",
              backgroundColor: "#4CAF50",
              display: "flex",
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width,
        height,
        background: backgroundGradient,
        borderRadius: "20px",
        padding: `${padding}px`,
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header with title and user info */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
        }}
      >
        <div
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            display: "flex",
            color: textColor,
          }}
        >
          {translations.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <img
            src={
              interaction?.user?.avatarURL ||
              "https://cdn.discordapp.com/embed/avatars/0.png"
            }
            alt="User Avatar"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "25%",
              marginRight: "10px",
              backgroundColor: overlayBackground,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: overlayBackground,
              borderRadius: "8px",
              padding: "4px 8px",
              fontSize: "16px",
              color: textColor,
            }}
          >
            <span style={{ marginRight: "5px", display: "flex" }}>💵</span>
            <span style={{ display: "flex" }}>
              {translations.balance}: {balance.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Category navigation */}
      <div
        style={{
          display: "flex",
          marginBottom: "5px",
          overflowX: "auto",
          paddingBottom: "5px",
          borderRadius: "10px",
          padding: "5px",
          zIndex: 5,
          position: "relative",
        }}
      >
        {Object.keys(groupedUpgrades).map((category) => {
          const isActive = isCategoryActive(category);
          return (
            <div
              key={`nav-${category}`}
              style={{
                display: "flex",
                padding: "5px 10px",
                marginLeft: "-5px",
                marginRight: "15px",
                marginTop: "-10px",
                backgroundColor: isActive
                  ? isDarkText
                    ? "rgba(255, 165, 0, 0.8)"
                    : "#FFA500"
                  : "rgba(0, 0, 0, 0.2)",
                borderRadius: "15px",
                fontSize: "14px",
                fontWeight: isActive ? "bold" : "normal",
                color: textColor,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {translations[`category_${category}`] || category}
            </div>
          );
        })}
      </div>

      {/* Upgrades categories - only show the active category */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "visible",
          position: "relative",
          marginRight: "-10px",
          paddingRight: "10px",
        }}
      >
        {/* Content wrapper - no need for scrolling */}
        <div
          style={{
            display: "flex",
            position: "relative",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              width: "100%",
            }}
          >
            {/* Only render the active category */}
            {Object.entries(groupedUpgrades)
              .filter(([category]) => category === activeCategory)
              .map(([category, categoryUpgrades], categoryIndex) => {
                const { visibleUpgrades, shift } = getVisibleUpgrades(
                  categoryUpgrades,
                  category
                );

                return (
                  <div
                    key={`category-${category}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      marginBottom: "15px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        marginBottom: "10px",
                        display: "flex",
                        color: textColor,
                        position: "relative",
                        paddingLeft: "10px", // Always show indicator for active category
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "4px",
                          height: "80%",
                          backgroundColor: isDarkText ? "#FFA500" : "#FFA500",
                          borderRadius: "2px",
                        }}
                      />
                      {translations[`category_${category}`] || category}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        overflowX: "visible",
                        paddingBottom: "10px",
                        position: "relative",
                        marginLeft: "5px",
                        marginRight: "5px",
                      }}
                    >
                      {/* Using relative positioning for the container */}
                      <div
                        style={{
                          display: "flex",
                          position: "relative",
                          left: `${shift}px`,
                        }}
                      >
                        {visibleUpgrades.map((upgrade, index) =>
                          renderUpgradeCard(
                            upgrade,
                            upgrades.findIndex(
                              (u) =>
                                u.id === upgrade.id ||
                                (u.title === upgrade.title &&
                                  u.category === upgrade.category)
                            )
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

UpgradesDisplay.dimensions = {
  width: 600,
  height: 350,
};

// Static translations object that will be synchronized
UpgradesDisplay.localization_strings = {
  title: {
    en: "Upgrades",
    ru: "Улучшения",
    uk: "Покращення",
  },
  level: {
    en: "Level",
    ru: "Уровень",
    uk: "Рівень",
  },
  nextLevel: {
    en: "Next Level",
    ru: "Следующий уровень",
    uk: "Наступний рівень",
  },
  price: {
    en: "Price",
    ru: "Цена",
    uk: "Ціна",
  },
  balance: {
    en: "Balance",
    ru: "Баланс",
    uk: "Баланс",
  },
  category_economy: {
    en: "Economy",
    ru: "Экономика",
    uk: "Економіка",
  },
  category_cooldowns: {
    en: "Cooldowns",
    ru: "Перезарядка",
    uk: "Перезарядка",
  },
};

export default UpgradesDisplay;
