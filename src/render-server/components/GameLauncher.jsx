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
  } = props;

  // Get translations from i18n based on the static translation object
  const translations = Object.entries(GameLauncher.localization_strings).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[i18n.getLocale()] || translations.en,
    }),
    {}
  );

  // Transform category keys to their localized names
  // Define default categories
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
      ],
    },
  };

  console.log(translations);

  // Use provided games or fall back to default categories
  const groupedGames =
    games ||
    Object.entries(defaultCategories).reduce((acc, [key, category]) => {
      acc[translations[category.translationKey]] = {
        avatar: category.avatar,
        games_list: category.games_list,
      };
      return acc;
    }, {});

  // Transform games object to use localized category names
  const transformedGames = Object.entries(groupedGames).reduce(
    (acc, [key, value]) => {
      // If the key matches a category translation key, use the localized version
      const categoryKey = Object.entries(defaultCategories).find(
        ([_, category]) => translations[category.translationKey] === key
      );

      // Use the localized category name or fallback to the original key
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

  // Helper function to check if category and game should be visible
  const isCategoryVisible = (categoryIndex) => {
    return categoryIndex - 1 <= highlightedCategory;
  };

  const isGameVisible = (categoryIndex, gameIndex) => {
    if (categoryIndex > highlightedCategory) return true;
    if (categoryIndex === highlightedCategory) return true;
    return false;
  };

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        padding: "25px",
        color: "white",
        fontFamily: "Inter600, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
                    if (!isGameVisible(categoryIndex, gameIndex)) return null;
                    return (
                      <div
                        key={game.id}
                        style={{
                          minWidth: "200px",
                          height: "100px",
                          display: "flex",
                          backgroundColor:
                            selectedGame === game.id ? "#FFA500" : "#1976d2",
                          borderRadius: "18px",
                          border:
                            highlightedGame === gameIndex &&
                            categoryIndex === highlightedCategory
                              ? "6px solid #FFA500"
                              : "none",
                          position: "relative",
                          flexShrink: 0,
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
                              height: "100%",
                              objectFit: "cover",
                              position: "absolute",
                              top: 0,
                              left: 0,
                              borderRadius: "12px",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              backgroundColor: "rgba(255, 255, 255, 0.1)",
                              position: "absolute",
                              top: 0,
                              left: 0,
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              fontSize: "64px",
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
                            bottom: "0px",
                            right: "0px",
                            padding: "4px 8px",
                            borderRadius: "16px",
                            backgroundColor: "rgba(0, 0, 0, 0.25)",
                            fontFamily: "Inter600",
                            display: "flex",
                          }}
                        >
                          {game.title}
                        </div>
                      </div>
                    );
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

// Static translations object with organized structure
GameLauncher.localization_strings = {
  // Category translations
  // These keys should match the translationKey in defaultCategories
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

  // To add a new category:
  // 1. Add translation key here
  // 2. Add category to defaultCategories with matching translationKey
  // Example:
  // newCategory: {
  //   en: "New Category",
  //   ru: "Новая категория",
  //   uk: "Нова категорія",
  // },

  // UI element translations
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
};

export default GameLauncher;
