import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

const GameLauncher = (props) => {
  const {
    interaction,
    database,
    i18n,
    games,
    selectedGame = null,
    highlightedGame = 0,
    highlightedCategory = 0,
    gameDailyStatus = null,
    width = 600,
    height = 650,
    gameStats = {
      2048: { highScore: 0 },
      snake: { highScore: 0 },
      rpg_clicker2: { highScore: 0 },
    },
    coloring,
  } = props;

  if (!interaction || !i18n) {
    return <div>Loading...</div>;
  }

  const {
    textColor = "#f8fbff",
    secondaryTextColor = "rgba(248,251,255,0.78)",
    tertiaryTextColor = "rgba(248,251,255,0.58)",
    overlayBackground = "rgba(255,255,255,0.08)",
    backgroundGradient = "linear-gradient(145deg, #0d4678 0%, #233681 45%, #311d68 100%)",
  } = coloring || {};

  const translations = Object.entries(GameLauncher.localization_strings || {}).reduce(
    (acc, [key, translationObj]) => {
      if (translationObj && i18n && i18n.getLocale) {
        acc[key] = translationObj[i18n.getLocale()] || translationObj.en || key;
      } else {
        acc[key] = key;
      }
      return acc;
    },
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
          id: "snake",
          title: "Snake",
          emoji: "🐍",
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

  const categoryEntries = Object.entries(groupedGames || {});
  const safeCategoryIndex = Math.min(
    Math.max(0, highlightedCategory),
    Math.max(0, categoryEntries.length - 1)
  );
  const selectedCategoryEntry = categoryEntries[safeCategoryIndex] || ["-", { avatar: null, games_list: [] }];
  const [selectedCategoryKey, selectedCategoryValue] = selectedCategoryEntry;
  const selectedCategoryGames = Array.isArray(selectedCategoryValue?.games_list)
    ? selectedCategoryValue.games_list
    : [];
  const allGames = categoryEntries.flatMap(([categoryKey, categoryValue], categoryIndex) =>
    (Array.isArray(categoryValue?.games_list) ? categoryValue.games_list : []).map((game, gameIndex) => ({
      categoryKey,
      categoryIndex,
      game,
      gameIndex,
    }))
  );
  const safeGameIndex = Math.min(
    Math.max(0, highlightedGame),
    Math.max(0, selectedCategoryGames.length - 1)
  );
  const selectedGameData = selectedCategoryGames[safeGameIndex] || null;
  const selectedGameTitle =
    typeof selectedGameData?.title === "object"
      ? selectedGameData?.title?.translation || selectedGameData?.title?.en || selectedGameData?.id || "-"
      : selectedGameData?.title || selectedGameData?.id || "-";
  const selectedGameEmoji = selectedGameData?.emoji || "🎮";
  const selectedHighScore = selectedGameData?.id
    ? Number(gameStats?.[selectedGameData.id]?.highScore || selectedGameData?.highScore || 0)
    : 0;
  const cap = Number(gameDailyStatus?.cap || 0);
  const earnedToday = Number(gameDailyStatus?.earnedToday || 0);
  const remainingToday = Number(gameDailyStatus?.remainingToday || 0);
  const upgradeLevel = Number(gameDailyStatus?.upgradeLevel || 1);
  const capProgress = cap > 0 ? Math.min(100, Math.round((earnedToday / cap) * 100)) : 0;
  const formatAmount = (value) => (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1));
  const displayName = interaction?.user?.displayName || interaction?.user?.username || "Player";

  const renderGameCard = (game, gameIndex, categoryIndex) => {
    if (!game || !game.id) {
      return null;
    }

    const title =
      typeof game.title === "object"
        ? game.title.translation || game.title.en || game.id
        : game.title || game.id;
    const highScore = Number(gameStats?.[game.id]?.highScore || game.highScore || 0);
    const inFocusedCategory = categoryIndex === safeCategoryIndex;
    const active = inFocusedCategory && gameIndex === safeGameIndex;
    const chosen = selectedGame === game.id;

    return (
      <div
        key={game.id}
        style={{
          minWidth: "128px",
          width: "128px",
          height: "124px",
          borderRadius: "22px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: active
            ? "rgba(255,255,255,0.16)"
            : inFocusedCategory
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.04)",
          border: chosen
            ? "1px solid rgba(255,199,69,0.45)"
            : active
            ? "1px solid rgba(109,247,167,0.45)"
            : inFocusedCategory
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(255,255,255,0.05)",
          boxSizing: "border-box",
          overflow: "hidden",
          flexShrink: 0,
          opacity: inFocusedCategory ? 1 : 0.52,
        }}
      >
        <div
          style={{
            width: "52px",
            height: "46px",
            borderRadius: "16px",
            backgroundColor: inFocusedCategory ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
        >
          {game.emoji || "🎮"}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: inFocusedCategory ? textColor : secondaryTextColor,
              lineHeight: 1.1,
              display: "flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: "11px", color: secondaryTextColor, display: "flex" }}>
            {translations.highScore || "Record"}: {highScore}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        width,
        height,
        borderRadius: "30px",
        padding: "24px",
        color: textColor,
        fontFamily: "Inter", fontWeight: 500,
        display: "flex",
        flexDirection: "column",
        background: backgroundGradient,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
          <img
            src={interaction?.user?.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"}
            style={{
              width: "62px",
              height: "62px",
              borderRadius: "18px",
              backgroundColor: overlayBackground,
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
            }}
            alt={translations.userAvatarAlt || "User Avatar"}
          />

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: "12px", letterSpacing: "0.16em", color: tertiaryTextColor, display: "flex" }}>
              {translations.commandLabel || "/WORK"}
            </div>
            <div style={{ fontSize: "34px", fontWeight: "bold", lineHeight: 1.04, display: "flex" }}>
              {translations.gameSelection || "Game Selection"}
            </div>
            <div style={{ fontSize: "13px", color: secondaryTextColor, display: "flex" }}>
              {displayName} · {selectedCategoryKey || "-"}
            </div>
          </div>
        </div>

        <InfoRectangle
          icon="💵"
          background={overlayBackground}
          borderRadius="16px"
          padding="7px 10px"
          minWidth="0px"
          maxWidth="190px"
          iconSize="16px"
          iconMarginRight="8px"
          title={translations.balance || "BALANCE"}
          titleStyle={{ fontSize: "11px", color: tertiaryTextColor, letterSpacing: "0.08em" }}
          value={
            <div style={{ display: "flex", fontSize: "18px", fontWeight: "bold", color: textColor }}>
              {Number(database?.economy?.balance ?? 0).toFixed(1)}
            </div>
          }
          style={{ position: "relative", flexShrink: 0 }}
        >
          <Banknotes
            amount={Number(database?.economy?.balance || 0)}
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
                width: "10px",
                height: "3px",
              },
            }}
          />
        </InfoRectangle>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", gap: "14px", minHeight: "212px" }}>
          <div
            style={{
              flex: 1,
              borderRadius: "24px",
              padding: "16px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
              border: "1px solid rgba(255,255,255,0.14)",
              display: "flex",
              gap: "16px",
              boxSizing: "border-box",
              minHeight: "212px",
            }}
          >
            <div
              style={{
                width: "152px",
                minWidth: "152px",
                borderRadius: "22px",
                background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "68px",
                overflow: "hidden",
              }}
            >
              {selectedGameData?.thumbnail ? (
                <img
                  src={selectedGameData.thumbnail}
                  alt={selectedGameTitle}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "flex" }}
                />
              ) : (
                <div style={{ display: "flex" }}>{selectedGameEmoji}</div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <div style={{ fontSize: "12px", color: tertiaryTextColor, letterSpacing: "0.10em", display: "flex" }}>
                    {translations.focusedGame || "Focused game"}
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "bold", lineHeight: 1.02, display: "flex" }}>
                    {selectedGameTitle}
                  </div>
                  <div style={{ fontSize: "13px", color: secondaryTextColor, display: "flex", marginTop: "6px" }}>
                    {translations.categoryLabel || "Category"}: {selectedCategoryKey || "-"}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <div style={{ fontSize: "11px", color: tertiaryTextColor, display: "flex" }}>
                    {translations.dailyCapLabel || "Daily cap"}
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, color: textColor, display: "flex" }}>
                    {cap.toFixed(0)}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <InfoRectangle
                  icon="🏆"
                  background={overlayBackground}
                  borderRadius="12px"
                  padding="8px 10px"
                  minWidth="0px"
                  maxWidth="144px"
                  iconSize="14px"
                  iconMarginRight="6px"
                  title={translations.highScore || "Record"}
                  titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                  value={<div style={{ display: "flex", fontSize: "16px", fontWeight: "bold", color: textColor }}>{selectedHighScore}</div>}
                />
                <InfoRectangle
                  icon="⬆️"
                  background={overlayBackground}
                  borderRadius="12px"
                  padding="8px 10px"
                  minWidth="0px"
                  maxWidth="144px"
                  iconSize="14px"
                  iconMarginRight="6px"
                  title={translations.upgradeLevel || "Upgrade lvl"}
                  titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                  value={<div style={{ display: "flex", fontSize: "16px", fontWeight: "bold", color: textColor }}>L{upgradeLevel}</div>}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "11px", color: secondaryTextColor, display: "flex" }}>
                    {translations.dailyCapProgress || "Daily cap progress"}
                  </div>
                  <div style={{ fontSize: "11px", color: tertiaryTextColor, display: "flex" }}>
                    {capProgress}%
                  </div>
                </div>

                <div
                  style={{
                    height: "12px",
                    width: "100%",
                    borderRadius: "999px",
                    backgroundColor: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${capProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #6df7a7 0%, #42c1ff 100%)",
                      borderRadius: "999px",
                      display: "flex",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                <InfoRectangle
                  icon="💸"
                  background={overlayBackground}
                  borderRadius="12px"
                  padding="8px 10px"
                  minWidth="0px"
                  maxWidth="144px"
                  iconSize="14px"
                  iconMarginRight="6px"
                  title={translations.earnedToday || "Earned today"}
                  titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                  value={<div style={{ display: "flex", fontSize: "16px", fontWeight: "bold", color: textColor }}>{formatAmount(earnedToday)}</div>}
                />
                <InfoRectangle
                  icon="🪙"
                  background={overlayBackground}
                  borderRadius="12px"
                  padding="8px 10px"
                  minWidth="0px"
                  maxWidth="144px"
                  iconSize="14px"
                  iconMarginRight="6px"
                  title={translations.remainingToday || "Remaining today"}
                  titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                  value={<div style={{ display: "flex", fontSize: "16px", fontWeight: "bold", color: textColor }}>{formatAmount(remainingToday)}</div>}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderRadius: "24px",
            padding: "14px",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            overflow: "hidden",
            boxSizing: "border-box",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <img
                src={selectedCategoryValue?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                alt={selectedCategoryKey}
                style={{ width: "30px", height: "30px", borderRadius: "10px", backgroundColor: overlayBackground, display: "flex" }}
              />
              <div style={{ fontSize: "16px", fontWeight: 700, color: textColor, display: "flex" }}>
                {selectedCategoryKey || "-"}
              </div>
            </div>

            <div style={{ fontSize: "12px", color: secondaryTextColor, display: "flex" }}>
              {allGames.length} {translations.gamesLabel || "games"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "14px",
              overflow: "hidden",
              alignItems: "stretch",
            }}
          >
            {categoryEntries.map(([categoryKey, categoryValue], categoryIndex) => {
              const categoryGames = Array.isArray(categoryValue?.games_list) ? categoryValue.games_list : [];
              const active = categoryIndex === safeCategoryIndex;

              return (
                <div
                  key={categoryKey}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    minWidth: "0px",
                    opacity: active ? 1 : 0.58,
                    flex: categoryGames.length > 0 ? `0 0 ${Math.max(148, categoryGames.length * 136)}px` : "0 0 148px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <img
                      src={categoryValue?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
                      alt={categoryKey}
                      style={{ width: "24px", height: "24px", borderRadius: "8px", display: "flex" }}
                    />
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: active ? textColor : secondaryTextColor,
                        display: "flex",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {categoryKey}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    {categoryGames.map((game, gameIndex) => renderGameCard(game, gameIndex, categoryIndex))}
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

GameLauncher.dimensions = {
  width: 600,
  height: 650,
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
  commandLabel: {
    en: "/work",
    ru: "/work",
    uk: "/work",
  },
  focusedGame: {
    en: "Focused game",
    ru: "Выбранная игра",
    uk: "Обрана гра",
  },
  categoryLabel: {
    en: "Category",
    ru: "Категория",
    uk: "Категорія",
  },
  categoriesLabel: {
    en: "Categories",
    ru: "Категории",
    uk: "Категорії",
  },
  dailyCapLabel: {
    en: "Daily cap",
    ru: "Дневной лимит",
    uk: "Денний ліміт",
  },
  dailyCapProgress: {
    en: "Daily cap progress",
    ru: "Прогресс дневного лимита",
    uk: "Прогрес денного ліміту",
  },
  earnedToday: {
    en: "Earned today",
    ru: "Заработано сегодня",
    uk: "Зароблено сьогодні",
  },
  remainingToday: {
    en: "Remaining today",
    ru: "Осталось сегодня",
    uk: "Залишилось сьогодні",
  },
  upgradeLevel: {
    en: "Upgrade lvl",
    ru: "Уровень улучш.",
    uk: "Рівень покр.",
  },
  gamesLabel: {
    en: "games",
    ru: "игр",
    uk: "ігор",
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
