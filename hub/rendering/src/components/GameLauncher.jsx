const GameLauncher = (props) => {
  console.log(
    "[GameLauncher] Received props:",
    JSON.stringify(props, null, 2).substring(0, 1000)
  );

  const {
    interaction,
    database,
    i18n,
    games,
    selectedGame = null,
    highlightedGame = 0,
    highlightedCategory = 0,
    width = 750,
    height = 500,
    gameStats = {
      2048: { highScore: 0 },
      snake: { highScore: 0 },
      rpg_clicker2: { highScore: 0 },
    },
    coloring,
  } = props;

  // Early return if critical props are missing
  if (!interaction || !i18n) {
    console.error("[GameLauncher] Missing critical props");
    return <div>Loading...</div>;
  }

  const {
    textColor,
    secondaryTextColor,
    tertiaryTextColor,
    overlayBackground,
    backgroundGradient,
  } = coloring || {};

  // Rest of the imports and initial setup remains the same...
  const translations = Object.entries(
    GameLauncher.localization_strings || {}
  ).reduce((acc, [key, translationObj]) => {
    if (translationObj && i18n && i18n.getLocale) {
      acc[key] = translationObj[i18n.getLocale()] || translationObj.en || key;
    } else {
      acc[key] = key;
    }
    return acc;
  }, {});

  const defaultCategories = {
    eleazar: {
      translationKey: "specialForCategory",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
      games_list: [
        {
          id: "2048",
          title: "2048",
          emoji: "🎲",
        },
        {
          id: "2048",
          title: "2048",
          emoji: "🎲",
        },
      ],
    },
    legacy: {
      translationKey: "oldGamesCategory",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
      games_list: [
        {
          id: "rpg_clicker2",
          title: "RPG Clicker",
          emoji: "⚔️",
          isLegacy: true,
        },
      ],
    },
  };

  console.log("[GameLauncher] games prop:", games);
  console.log("[GameLauncher] games type:", typeof games);
  console.log(
    "[GameLauncher] games keys:",
    games ? Object.keys(games) : "null"
  );

  const groupedGames =
    games ||
    Object.entries(defaultCategories).reduce((acc, [key, category]) => {
      if (category && category.translationKey && category.games_list) {
        acc[translations[category.translationKey] || key] = {
          avatar: category.avatar,
          games_list: category.games_list,
        };
      }
      return acc;
    }, {});

  console.log("[GameLauncher] groupedGames:", groupedGames);

  const transformedGames = Object.entries(groupedGames || {}).reduce(
    (acc, [key, value]) => {
      console.log("[GameLauncher] Processing category:", key, "value:", value);
      if (!value || !value.games_list) {
        console.log("[GameLauncher] Skipping category due to missing data");
        return acc;
      }

      const categoryKey = Object.entries(defaultCategories).find(
        ([_, category]) =>
          category && translations[category.translationKey] === key
      );

      const localizedKey =
        categoryKey && categoryKey[1] && defaultCategories[categoryKey[0]]
          ? translations[defaultCategories[categoryKey[0]].translationKey] ||
            key
          : key;

      const result = {
        ...acc,
        [localizedKey]: value,
      };

      console.log(
        "[GameLauncher] transformedGames so far:",
        Object.keys(result)
      );
      return result;
    },
    {}
  );

  console.log(
    "[GameLauncher] Final transformedGames:",
    Object.keys(transformedGames)
  );

  const isCategoryVisible = (categoryIndex) => {
    return categoryIndex - 1 <= highlightedCategory;
  };

  const isGameVisible = (categoryIndex, gameIndex) => {
    if (categoryIndex > highlightedCategory) return true;
    if (categoryIndex === highlightedCategory) return true;
    return false;
  };

  const renderGameCard = (game, gameIndex, categoryIndex) => {
    if (!isGameVisible(categoryIndex, gameIndex)) return null;
    if (!game || !game.id) return null;

    // Get high score either from game object or gameStats
    const highScore =
      game.highScore || (gameStats && gameStats[game.id]?.highScore) || 0;
    console.log(`Rendering game ${game.id} with highScore:`, highScore);

    // Ensure all required properties exist
    const gameTitle =
      typeof game.title === "object"
        ? game.title.translation || game.title.en || game.id
        : game.title;
    const gameEmoji = game.emoji || "🎮";

    if (!gameTitle) {
      console.warn(`Game ${game.id} missing title`, game);
      return null;
    }

    const isHighlighted =
      highlightedGame === gameIndex && categoryIndex === highlightedCategory;
    const BORDER_RADIUS = 18;
    const HIGHLIGHT_BORDER = 6;

    const cardBackground =
      selectedGame === game.id
        ? coloring?.isDarkText
          ? "rgba(255, 165, 0, 0.8)"
          : "#FFA500"
        : coloring?.isDarkText
        ? "rgba(29, 185, 53, 0.8)"
        : "#1DB935";

    return (
      <div
        key={game.id}
        style={{
          minWidth: "200px",
          height: "130px",
          display: "flex",
          backgroundColor: cardBackground,
          borderRadius: `${BORDER_RADIUS}px`,
          border: isHighlighted
            ? `${HIGHLIGHT_BORDER}px solid ${
                coloring?.isDarkText ? "rgba(255, 165, 0, 0.8)" : "#FFA500"
              }`
            : "none",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {game.thumbnail ? (
          <img
            src={game.thumbnail}
            alt={game.title}
            width={200}
            height={100}
            style={{
              width: "100%",
              height: "80%",
              objectFit: "cover",
              position: "absolute",
              display: "flex",
              top: 0,
              left: 0,
              borderRadius: isHighlighted
                ? `${BORDER_RADIUS - HIGHLIGHT_BORDER}px ${
                    BORDER_RADIUS - HIGHLIGHT_BORDER
                  }px 0 0`
                : `${BORDER_RADIUS}px ${BORDER_RADIUS}px 0 0`,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "80%",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              position: "absolute",
              top: 0,
              left: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "64px",
              borderRadius: isHighlighted
                ? `${BORDER_RADIUS - HIGHLIGHT_BORDER}px ${
                    BORDER_RADIUS - HIGHLIGHT_BORDER
                  }px 0 0`
                : `${BORDER_RADIUS}px ${BORDER_RADIUS}px 0 0`,
            }}
          >
            {gameEmoji}
          </div>
        )}
        <div
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            position: "absolute",
            bottom: "30px",
            right: "0px",
            display: "flex",
            padding: "4px 8px",
            borderRadius: "12px",
            backgroundColor: overlayBackground || "rgba(0, 0, 0, 0.25)",
            fontFamily: "Inter600",
            color: textColor || "#FFFFFF",
          }}
        >
          {gameTitle}
        </div>
        {/* High Score Display */}
        <div
          style={{
            fontSize: "16px",
            fontWeight: "bold",
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "30px",
            backgroundColor: isHighlighted
              ? coloring?.isDarkText
                ? "rgba(255, 165, 0, 0.8)"
                : "#FFA500"
              : "rgba(0, 0, 0, 0)",
            fontFamily: "Inter600",
            borderRadius: isHighlighted
              ? `0 0 ${BORDER_RADIUS - HIGHLIGHT_BORDER}px ${
                  BORDER_RADIUS - HIGHLIGHT_BORDER
                }px`
              : `0 0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: textColor || "#FFFFFF",
          }}
        >
          {translations.highScore || "Record"}: {highScore}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "20px",
        padding: "25px",
        color: textColor,
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
        background: backgroundGradient,
      }}
    >
      {/* Header section */}
      <div
        style={{
          fontSize: "24px",
          fontWeight: "bold",
          display: "flex",
          marginTop: "-15px",
          marginBottom: "15px",
          alignItems: "center",
          gap: "15px",
        }}
      >
        <img
          src={
            interaction?.user?.avatarURL ||
            "https://cdn.discordapp.com/embed/avatars/0.png"
          }
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "20%",
            backgroundColor: overlayBackground,
          }}
          alt={translations.userAvatarAlt || "User Avatar"}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "64px",
              display: "flex",
              color: textColor,
            }}
          >
            {translations.gameSelection || "Game Selection"}
          </div>
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: overlayBackground,
                borderRadius: "10px",
                padding: "10px",
                gap: "5px",
                alignSelf: "flex-start",
                color: textColor,
              }}
            >
              <span style={{ display: "flex" }}>💵</span>
              <span style={{ display: "flex" }}>
                {database?.economy?.balance?.toFixed(1) || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Games grid section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          overflowY: "auto",
          marginRight: "-25px",
          paddingRight: "25px",
        }}
      >
        {Object.entries(transformedGames || {}).map(
          ([category, categoryData], categoryIndex) => {
            console.log(
              `[GameLauncher] Rendering category: ${category}, index: ${categoryIndex}`
            );
            console.log(
              `[GameLauncher] Category data:`,
              JSON.stringify(categoryData, null, 2).substring(0, 200)
            );

            if (!isCategoryVisible(categoryIndex)) {
              console.log(`[GameLauncher] Category ${category} not visible`);
              return null; // Return null instead of Fragment
            }
            if (!categoryData || !categoryData.games_list) {
              console.log(
                `[GameLauncher] Category ${category} missing data or games_list`
              );
              return null; // Return null instead of Fragment
            }

            // Ensure categoryData has required properties
            if (!categoryData.avatar) {
              console.warn(
                `[GameLauncher] Category ${category} missing avatar`
              );
              return null; // Return null instead of Fragment
            }

            console.log(
              `[GameLauncher] Category ${category} has ${categoryData.games_list.length} games`
            );

            return (
              <div
                key={category}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontFamily: "Inter400",
                }}
              >
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    marginBottom: "15px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <img
                    src={
                      categoryData?.avatar ||
                      "https://cdn.discordapp.com/embed/avatars/0.png"
                    }
                    alt={translations.userAvatarAlt || "Category Avatar"}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "25%",
                      marginRight: "5px",
                      backgroundColor: overlayBackground,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "36px",
                      display: "flex",
                      color: textColor,
                    }}
                  >
                    {category || "Unknown Category"}
                  </span>
                </div>
                <div
                  style={{
                    position: "relative",
                    marginBottom: "10px",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "15px",
                      paddingBottom: "10px",
                      marginRight: "-25px",
                      paddingRight: "25px",
                      overflowX: "auto",
                      msOverflowStyle: "none",
                      WebkitOverflowScrolling: "touch",
                      scrollbarWidth: "none",
                    }}
                  >
                    {categoryData.games_list &&
                      categoryData.games_list
                        .map((game, gameIndex) => {
                          console.log(
                            `[GameLauncher] Processing game ${gameIndex}:`,
                            game?.id,
                            game?.title
                          );
                          const renderedCard = renderGameCard(
                            game,
                            gameIndex,
                            categoryIndex
                          );
                          console.log(
                            `[GameLauncher] Rendered card for ${game?.id}:`,
                            renderedCard ? "success" : "null"
                          );
                          return renderedCard;
                        })
                        .filter(Boolean)}
                  </div>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};

GameLauncher.dimensions = {
  width: 750,
  height: 500,
};

// Static translations object
GameLauncher.localization_strings = {
  gameSelection: {
    en: "Game Selection",
    ru: "Выбор игры",
    uk: "Вибір гри",
  },
  userAvatarAlt: {
    en: "User Avatar",
    ru: "Аватар пользователя",
    uk: "Аватар користувача",
  },
  highScore: {
    en: "Record",
    ru: "Рекорд",
    uk: "Рекорд",
  },
  oldGamesCategory: {
    en: "Legacy Games",
    ru: "Старые игры",
    uk: "Старі ігри",
  },
  specialForCategory: {
    en: "Specially for Eleazar",
    ru: "Специально для Eleazar",
    uk: "Спеціально для Eleazar",
  },
};

export default GameLauncher;
