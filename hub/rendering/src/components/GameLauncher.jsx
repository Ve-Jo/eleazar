import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

const SOFT_LIMIT_HALF_RATE_GAMES = new Set(["2048", "snake"]);
const RISKY_HARD_LIMIT_GAMES = new Set(["coinflip", "tower"]);
const NO_DAILY_LIMIT_GAMES = new Set(["crypto2"]);
const MAX_VISIBLE_GAMES_PER_CATEGORY = 4;

const normalizeGameId = (gameId) => String(gameId || "").trim().toLowerCase();

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
    height = 725,
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
  const selectedGameId = normalizeGameId(selectedGameData?.id);
  const isNoDailyLimitGame = NO_DAILY_LIMIT_GAMES.has(selectedGameId);
  const isRiskyHardLimitGame = RISKY_HARD_LIMIT_GAMES.has(selectedGameId);
  const isSoftLimitHalfRateGame = SOFT_LIMIT_HALF_RATE_GAMES.has(selectedGameId);
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
  const formatAmount = (value) => (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1));
  const capProgress = isNoDailyLimitGame
    ? 100
    : cap > 0
    ? Math.min(100, Math.round((earnedToday / cap) * 100))
    : 0;
  const displayCapValue = isNoDailyLimitGame ? "∞" : cap.toFixed(0);
  const displayRemainingValue = isNoDailyLimitGame ? "∞" : formatAmount(remainingToday);
  const capProgressLabel = isNoDailyLimitGame
    ? translations.noDailyCapProgress || "No cap"
    : `${capProgress}%`;
  const capReached = !isNoDailyLimitGame && remainingToday <= 0;
  let limitPolicyText = translations.standardCapInfo || "Standard daily cap applies.";
  let limitPolicyColor = secondaryTextColor;
  if (isNoDailyLimitGame) {
    limitPolicyText = translations.noDailyLimitInfo || "No daily limit for this game.";
    limitPolicyColor = "#6df7a7";
  } else if (isRiskyHardLimitGame) {
    if (capReached) {
      limitPolicyText =
        translations.riskyCapReachedLock ||
        "Daily limit reached: this risky game is locked until reset.";
      limitPolicyColor = "#ff8c8c";
    } else {
      limitPolicyText =
        translations.riskyCapInfo ||
        "Risky game: locks once remaining daily limit reaches zero.";
      limitPolicyColor = "#ffd381";
    }
  } else if (isSoftLimitHalfRateGame) {
    if (capReached) {
      limitPolicyText =
        translations.softCapReachedHalf ||
        "Daily cap reached: you can still play for 50% coin payouts.";
      limitPolicyColor = "#6df7a7";
    } else {
      limitPolicyText =
        translations.softCapInfo ||
        "After daily cap, this game keeps running with 50% coin payouts.";
      limitPolicyColor = "#8ee7ff";
    }
  }
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

  const getVisibleCategoryWindow = (categoryGames, selectedIndex) => {
    if (!Array.isArray(categoryGames) || categoryGames.length === 0) {
      return {
        games: [],
        startIndex: 0,
        endIndex: 0,
      };
    }

    if (categoryGames.length <= MAX_VISIBLE_GAMES_PER_CATEGORY) {
      return {
        games: categoryGames,
        startIndex: 0,
        endIndex: categoryGames.length,
      };
    }

    const windowSize = Math.min(MAX_VISIBLE_GAMES_PER_CATEGORY, categoryGames.length);
    const maxStart = Math.max(0, categoryGames.length - windowSize);
    const centeredStart = Math.max(0, selectedIndex - Math.floor(windowSize / 2));
    const startIndex = Math.min(centeredStart, maxStart);
    const endIndex = Math.min(categoryGames.length, startIndex + windowSize);

    return {
      games: categoryGames.slice(startIndex, endIndex),
      startIndex,
      endIndex,
    };
  };

  const focusedCategoryWindow = getVisibleCategoryWindow(
    selectedCategoryGames,
    safeGameIndex
  );
  const focusedVisibleGames = focusedCategoryWindow.games;
  const previousCategoryEntry =
    safeCategoryIndex > 0 ? categoryEntries[safeCategoryIndex - 1] : null;
  const nextCategoryEntry =
    safeCategoryIndex < categoryEntries.length - 1
      ? categoryEntries[safeCategoryIndex + 1]
      : null;

  const renderCategoryPreview = (entry, direction) => {
    if (!entry) {
      return null;
    }

    const [categoryKey, categoryValue] = entry;
    const previewGames = Array.isArray(categoryValue?.games_list)
      ? categoryValue.games_list.slice(0, 2)
      : [];

    return (
      <div
        key={`${direction}-${categoryKey}`}
        style={{
          width: "96px",
          minWidth: "96px",
          borderRadius: "18px",
          padding: "10px",
          backgroundColor: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          opacity: 0.56,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          <img
            src={categoryValue?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"}
            alt={categoryKey}
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "7px",
              display: "flex",
              flexShrink: 0,
            }}
          />
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: secondaryTextColor,
              display: "flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {categoryKey}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {previewGames.map((game) => (
            <div
              key={`${direction}-${game.id}`}
              style={{
                height: "46px",
                borderRadius: "12px",
                padding: "8px",
                backgroundColor: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "24px",
                  minWidth: "24px",
                  height: "24px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                }}
              >
                {game?.emoji || "🎮"}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: tertiaryTextColor,
                  display: "flex",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {typeof game?.title === "object"
                  ? game?.title?.translation || game?.title?.en || game?.id
                  : game?.title || game?.id}
              </div>
            </div>
          ))}
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
                    {displayCapValue}
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
                    {capProgressLabel}
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

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  marginTop: "10px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em", display: "flex" }}>
                  {translations.dailyPolicyLabel || "Daily rule"}
                </div>
                <div style={{ fontSize: "12px", color: limitPolicyColor, display: "flex", lineHeight: 1.25 }}>
                  {limitPolicyText}
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
                  value={<div style={{ display: "flex", fontSize: "16px", fontWeight: "bold", color: textColor }}>{displayRemainingValue}</div>}
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
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: secondaryTextColor, display: "flex" }}>
              {focusedCategoryWindow.startIndex + 1}-{focusedCategoryWindow.endIndex} / {selectedCategoryGames.length || 0}
            </div>

            {selectedCategoryGames.length > MAX_VISIBLE_GAMES_PER_CATEGORY ? (
              <div style={{ fontSize: "12px", color: tertiaryTextColor, display: "flex" }}>
                {translations.focusedWindowLabel || "Selection stays in view"}
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: tertiaryTextColor, display: "flex" }}>
                {translations.focusedCategoryLabel || "Focused category"}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "stretch",
              minHeight: "124px",
              overflow: "hidden",
            }}
          >
            {renderCategoryPreview(previousCategoryEntry, "previous")}

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                gap: "8px",
                overflow: "hidden",
                alignItems: "stretch",
              }}
            >
              {focusedVisibleGames.map((game) => {
                const originalGameIndex = selectedCategoryGames.findIndex(
                  (entry) => entry?.id === game?.id
                );
                return renderGameCard(game, originalGameIndex, safeCategoryIndex);
              })}
            </div>

            {renderCategoryPreview(nextCategoryEntry, "next")}
          </div>
        </div>
      </div>
    </div>
  );
};

GameLauncher.dimensions = {
  width: 600,
  height: 725,
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
  focusedCategoryLabel: {
    en: "Focused category",
    ru: "Выбранная категория",
    uk: "Обрана категорія",
  },
  focusedWindowLabel: {
    en: "Selection stays in view",
    ru: "Выбор всегда в видимой зоне",
    uk: "Вибір завжди у видимій зоні",
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
  noDailyCapProgress: {
    en: "No cap",
    ru: "Без лимита",
    uk: "Без ліміту",
  },
  dailyPolicyLabel: {
    en: "Daily rule",
    ru: "Правило на день",
    uk: "Правило на день",
  },
  noDailyLimitInfo: {
    en: "No daily limit for this game.",
    ru: "Для этой игры нет дневного лимита.",
    uk: "Для цієї гри немає денного ліміту.",
  },
  riskyCapInfo: {
    en: "Risky game: locks once remaining daily limit reaches zero.",
    ru: "Риск-игра: блокируется, когда дневной лимит становится нулевым.",
    uk: "Ризик-гра: блокується, коли денний ліміт стає нульовим.",
  },
  riskyCapReachedLock: {
    en: "Daily limit reached: this risky game is locked until reset.",
    ru: "Дневной лимит достигнут: эта риск-игра заблокирована до сброса.",
    uk: "Денний ліміт досягнуто: ця ризик-гра заблокована до скидання.",
  },
  softCapInfo: {
    en: "After daily cap, this game keeps running with 50% coin payouts.",
    ru: "После дневного лимита игра продолжится с выплатой 50% монет.",
    uk: "Після денного ліміту гра триває з виплатою 50% монет.",
  },
  softCapReachedHalf: {
    en: "Daily cap reached: you can still play for 50% coin payouts.",
    ru: "Дневной лимит достигнут: играть можно дальше за 50% выплат монет.",
    uk: "Денний ліміт досягнуто: можна далі грати за 50% виплат монет.",
  },
  standardCapInfo: {
    en: "Standard daily cap applies.",
    ru: "Действует стандартный дневной лимит.",
    uk: "Діє стандартний денний ліміт.",
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
