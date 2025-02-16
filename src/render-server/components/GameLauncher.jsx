const GameLauncher = (props) => {
  const {
    interaction,
    database,
    i18n,
    games,
    selectedGame = null,
    highlightedGame = 0,
    highlightedCategory = 0,
    width = 750,
    height = 450,
    gameStats = { 2048: { highScore: 0 }, snake: { highScore: 0 } },
  } = props;

  // Rest of the imports and initial setup remains the same...
  const translations = Object.entries(GameLauncher.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

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
  };

  const groupedGames =
    games ||
    Object.entries(defaultCategories).reduce((acc, [key, category]) => {
      acc[translations[category.translationKey]] = {
        avatar: category.avatar,
        games_list: category.games_list,
      };
      return acc;
    }, {});

  const transformedGames = Object.entries(groupedGames).reduce(
    (acc, [key, value]) => {
      const categoryKey = Object.entries(defaultCategories).find(
        ([_, category]) => translations[category.translationKey] === key
      );

      const localizedKey = categoryKey
        ? translations[defaultCategories[categoryKey[0]].translationKey]
        : key;

      return {
        ...acc,
        [localizedKey]: value,
      };
    },
    {}
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

    // Get high score either from game object or gameStats
    const highScore = game.highScore || gameStats[game.id]?.highScore || 0;
    console.log(`Rendering game ${game.id} with highScore:`, highScore);

    const isHighlighted =
      highlightedGame === gameIndex && categoryIndex === highlightedCategory;
    const BORDER_RADIUS = 18;
    const HIGHLIGHT_BORDER = 6;

    return (
      <div
        key={game.id}
        style={{
          minWidth: "200px",
          height: "130px",
          display: "flex",
          backgroundColor: selectedGame === game.id ? "#FFA500" : "#1DB935",
          borderRadius: `${BORDER_RADIUS}px`,
          border: isHighlighted
            ? `${HIGHLIGHT_BORDER}px solid #FFA500`
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
            {game.emoji}
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
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            fontFamily: "Inter600",
          }}
        >
          {game.title}
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
            backgroundColor: isHighlighted ? "#FFA500" : "rgba(0, 0, 0, 0)",
            fontFamily: "Inter600",
            borderRadius: isHighlighted
              ? `0 0 ${BORDER_RADIUS - HIGHLIGHT_BORDER}px ${
                  BORDER_RADIUS - HIGHLIGHT_BORDER
                }px`
              : `0 0 ${BORDER_RADIUS}px ${BORDER_RADIUS}px`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {translations.highScore}: {highScore}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#3DAA4E",
        borderRadius: "20px",
        padding: "25px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
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
          src={interaction.user.avatarURL}
          style={{ width: "100px", height: "100px", borderRadius: "20%" }}
          alt={translations.userAvatarAlt}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "64px", display: "flex" }}>
            {translations.gameSelection}
          </div>
          <div style={{ display: "flex" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px",
                padding: "10px",
                gap: "5px",
                alignSelf: "flex-start",
              }}
            >
              <span style={{ display: "flex" }}>💵</span>
              <span style={{ display: "flex" }}>
                {database.economy.balance.toFixed(1)}
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
        {Object.entries(transformedGames).map(
          ([category, categoryData], categoryIndex) => {
            if (!isCategoryVisible(categoryIndex)) return null;
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
                    src={categoryData.avatar}
                    alt={translations.userAvatarAlt}
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "25%",
                      marginRight: "5px",
                    }}
                  />
                  <span style={{ fontSize: "36px", display: "flex" }}>
                    {category}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "15px",
                    paddingBottom: "10px",
                    marginRight: "-25px",
                    paddingRight: "25px",
                    overflowX: "auto",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {categoryData.games_list.map((game, gameIndex) => {
                    return renderGameCard(game, gameIndex, categoryIndex);
                  })}
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
  height: 450,
};

// Static translations object
GameLauncher.localization_strings = {
  specialForCategory: {
    en: "Specially for Eleazar",
    ru: "Специально для Eleazar",
    uk: "Спеціально для Eleazar",
  },
  oldGamesCategory: {
    en: "Our old games",
    ru: "Наши старые игры",
    uk: "Наші старі ігри",
  },
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
};

export default GameLauncher;
