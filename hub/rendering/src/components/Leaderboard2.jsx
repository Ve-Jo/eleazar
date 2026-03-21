import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

const Leaderboard2 = (props) => {
  let {
    users,
    currentPage = 1,
    totalPages = 3,
    highlightedPosition = 2,
    width = 550,
    height = 825,
    i18n,
    category = "total",
    gameScope = "local",
    interaction,
    database,
    coloring,
  } = props;

  const locale = i18n?.getLocale?.() || "en";
  const translations = Object.entries(Leaderboard2.localization_strings).reduce(
    (acc, [key, values]) => ({
      ...acc,
      [key]: values[locale] || values.en,
    }),
    {}
  );

  const {
    textColor = "#f8fbff",
    secondaryTextColor = "rgba(248,251,255,0.78)",
    tertiaryTextColor = "rgba(248,251,255,0.58)",
    overlayBackground = "rgba(255,255,255,0.08)",
    backgroundGradient = "linear-gradient(145deg, #1451c9 0%, #2f46bf 42%, #4e36a9 100%)",
  } = coloring || {};

  const usersPerPage = 10;
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;

  // Generate mock data if no users provided
  if (!users) {
    const usernames = [
      "DragonSlayer", "StarLight", "NightOwl", "CyberNinja", "PixelMaster",
      "ShadowWalker", "MoonKnight", "SunChaser", "StormBringer", "FirePhoenix",
      "IceWizard", "ThunderBolt", "EarthShaker", "WindRunner", "OceanRider",
    ];

    const generateRandomValue = (cat) => {
      switch (cat) {
        case "season": return Math.floor(Math.random() * 100000);
        case "chat":
        case "voice":
        case "gaming": return Math.floor(Math.random() * 100) + 1;
        case "games": return Math.floor(Math.random() * 10000);
        default: return parseFloat((Math.random() * 500).toFixed(2));
      }
    };

    users = Array(250).fill().map((_, index) => ({
      id: (1000000000 + index).toString(),
      name: `${usernames[index % usernames.length]}${Math.floor(Math.random() * 999)}`,
      avatarURL: `https://cdn.discordapp.com/embed/avatars/${index % 5}.png`,
      value: generateRandomValue(category),
    })).sort((a, b) => b.value - a.value);
  }

  users = users.slice(startIndex, endIndex);
  const highlightedUser = users.find((_, index) => startIndex + index + 1 === highlightedPosition);
  const isHighlightedOnPage = highlightedUser !== undefined;

  const formatNumber = (num) => {
    if (num === undefined || num === null) return "0";
    const n = Number(num);
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toFixed(category === "total" || category === "balance" || category === "bank" ? 2 : 0);
  };

  const getValueString = (value) => {
    const formatted = formatNumber(value);
    switch (category) {
      case "chat":
      case "voice":
      case "gaming":
        return `Lvl ${formatted}`;
      case "season": return `${formatted} XP`;
      case "games":
      case "2048":
      case "snake": return formatted;
      default: return `$${formatted}`;
    }
  };

  const isXpCategory = ["chat", "voice", "gaming"].includes(category);
  const xpAccent = {
    chat: "#2196F3",
    voice: "#00BCD4",
    gaming: "#1DB935",
  };

  const getXpMeta = (user) => {
    if (category === "chat") {
      const current = Number(user?.chatCurrentXP || 0);
      const required = Math.max(1, Number(user?.chatRequiredXP || 1));
      return {
        level: Number(user?.level || 1),
        rawXP: Number(user?.xp || 0),
        progress: Math.min(1, Math.max(0, current / required)),
      };
    }
    if (category === "voice") {
      const current = Number(user?.voiceCurrentXP || 0);
      const required = Math.max(1, Number(user?.voiceRequiredXP || 1));
      return {
        level: Number(user?.voiceLevel || 1),
        rawXP: Number(user?.voiceXp || 0),
        progress: Math.min(1, Math.max(0, current / required)),
      };
    }
    if (category === "gaming") {
      const current = Number(user?.gameCurrentXP || 0);
      const required = Math.max(1, Number(user?.gameRequiredXP || 1));
      return {
        level: Number(user?.gamingLevel || 1),
        rawXP: Number(user?.gameXp || 0),
        progress: Math.min(1, Math.max(0, current / required)),
      };
    }

    return {
      level: 1,
      rawXP: Number(user?.value || 0),
      progress: 0,
    };
  };

  const withAlpha = (color, alpha) => {
    const normalizedAlpha = Math.max(0, Math.min(1, Number(alpha) || 0));
    if (!color || typeof color !== "string") return `rgba(255, 182, 72, ${normalizedAlpha})`;

    const trimmed = color.trim();
    if (trimmed.startsWith("rgba(")) {
      const parts = trimmed
        .replace("rgba(", "")
        .replace(")", "")
        .split(",")
        .map((part) => part.trim());
      if (parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${normalizedAlpha})`;
      }
    }

    if (trimmed.startsWith("rgb(")) {
      const parts = trimmed
        .replace("rgb(", "")
        .replace(")", "")
        .split(",")
        .map((part) => part.trim());
      if (parts.length >= 3) {
        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${normalizedAlpha})`;
      }
    }

    if (trimmed.startsWith("#")) {
      let hex = trimmed.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((char) => char + char)
          .join("");
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
      }
    }

    return color;
  };

  const getUserValueString = (user) => {
    if (isXpCategory) {
      const xpMeta = getXpMeta(user);
      return `Lvl ${formatNumber(xpMeta.level)} · ${formatNumber(xpMeta.rawXP)} XP`;
    }

    return getValueString(user?.value);
  };

  const categoryGroups = [
    {
      key: "season",
      label: translations.groupSeason,
      categories: [
        { key: "season", icon: "✨", label: translations.categorySeason },
      ],
    },
    {
      key: "economy",
      label: translations.groupEconomy,
      categories: [
        { key: "total", icon: "🏦", label: translations.categoryTotal },
        { key: "balance", icon: "💰", label: translations.categoryBalance },
        { key: "bank", icon: "💳", label: translations.categoryBank },
      ],
    },
    {
      key: "leveling",
      label: translations.groupLeveling,
      categories: [
        { key: "chat", icon: "💬", label: translations.categoryChat },
        { key: "voice", icon: "🎤", label: translations.categoryVoice },
        { key: "gaming", icon: "🎮", label: translations.categoryGaming },
      ],
    },
    {
      key: "games",
      label: translations.groupGames,
      categories: [
        { key: "games", icon: "🏆", label: translations.categoryGames },
        { key: "2048", icon: "🔢", label: "2048" },
        { key: "snake", icon: "🐍", label: "Snake" },
      ],
    },
  ];

  const medalColors = {
    1: { bg: "#ffb648", shadow: "rgba(255,182,72,0.4)", icon: "🥇" },
    2: { bg: "#c0c0c0", shadow: "rgba(192,192,192,0.4)", icon: "🥈" },
    3: { bg: "#cd7f32", shadow: "rgba(205,127,50,0.4)", icon: "🥉" },
  };

  const getUserBanner = (user) => {
    if (!user) return null;
    return user.bannerUrl || user.bannerURL || user.banner?.url || null;
  };

  const getUserPalette = (user, position) => {
    const userColoring = user?.coloring || {};
    const medal = medalColors[position];
    const accent =
      userColoring.accentColor ||
      userColoring.valueColor ||
      userColoring.dominantColor ||
      medal?.bg ||
      "#ffb648";

    return {
      text: userColoring.textColor || textColor,
      secondary: userColoring.secondaryTextColor || secondaryTextColor,
      tertiary: userColoring.tertiaryTextColor || tertiaryTextColor,
      overlay: userColoring.overlayBackground || overlayBackground,
      gradient: userColoring.backgroundGradient || backgroundGradient,
      accent,
    };
  };

  const isEconomy = ["total", "balance", "bank"].includes(category);
  const isGameCategory = ["games", "2048", "snake"].includes(category);

  const flatCategories = categoryGroups.flatMap((group) =>
    group.categories.map((cat) => ({
      ...cat,
      groupKey: group.key,
    }))
  );
  const selectedCategoryIndex = Math.max(
    0,
    flatCategories.findIndex((cat) => cat.key === category)
  );
  const categoryWindowSize = 7;
  const categoryWindowRadius = Math.floor(categoryWindowSize / 2);
  const categoryWindowStart = Math.max(
    0,
    Math.min(
      selectedCategoryIndex - categoryWindowRadius,
      Math.max(0, flatCategories.length - categoryWindowSize)
    )
  );
  const categoryWindowEnd = Math.min(flatCategories.length, categoryWindowStart + categoryWindowSize);
  const visibleFlatCategories = flatCategories.slice(categoryWindowStart, categoryWindowEnd);
  const hiddenBeforeCount = categoryWindowStart;
  const hiddenAfterCount = Math.max(0, flatCategories.length - categoryWindowEnd);
  const visibleCategoryGroups = categoryGroups
    .map((group) => ({
      ...group,
      categories: visibleFlatCategories.filter((cat) => cat.groupKey === group.key),
    }))
    .filter((group) => group.categories.length > 0);

  const displayName = interaction?.user?.displayName || interaction?.user?.username || "Player";
  const balance = database?.balance || database?.economy?.balance || 0;

  const renderPodiumUser = (user, position) => {
    const medal = medalColors[position];
    const palette = getUserPalette(user, position);
    const banner = getUserBanner(user);
    const size = position === 1 ? "large" : "medium";
    const avatarSize = size === "large" ? "56px" : "44px";
    const nameSize = size === "large" ? "16px" : "14px";
    const valueSize = size === "large" ? "18px" : "16px";
    const xpMeta = getXpMeta(user);
    const economyBanknoteStyle = category === "bank" ? "bars" : "banknotes";
    const economyDivision = category === "bank" ? 90 : 45;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          flex: 1,
          padding: size === "large" ? "12px 8px" : "10px 6px",
          background: palette.gradient,
          borderRadius: "20px",
          border: `2px solid ${withAlpha(palette.accent, 0.6)}`,
          boxShadow: `0 4px 20px ${medal?.shadow || "rgba(0,0,0,0.25)"}`,
          position: "relative",
          overflow: "hidden",
          order: position === 1 ? 2 : position === 2 ? 1 : 3,
          transform: position === 1 ? "translateY(-8px)" : "none",
        }}
      >
        {banner && (
          <img
            src={banner}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.15)",
              filter: "blur(7px)",
              opacity: 0.45,
              zIndex: 0,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(8,15,30,0.18) 0%, rgba(8,15,30,0.48) 100%)",
            zIndex: 0,
          }}
        />
        {isXpCategory && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${xpMeta.progress * 100}%`,
              background: `${xpAccent[category]}55`,
              zIndex: 0,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: "-12px",
            fontSize: "24px",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
            zIndex: 1,
          }}
        >
          {medal.icon}
        </div>
        <img
          src={user.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"}
          alt=""
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: "14px",
            marginTop: "16px",
            border: `2px solid ${palette.accent}`,
            position: "relative",
            zIndex: 1,
          }}
        />
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 700,
            color: palette.text,
            textAlign: "center",
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          {user.name}
        </div>
        <div
          style={{
            fontSize: valueSize,
            fontWeight: 800,
            color: palette.accent,
            position: "relative",
            zIndex: 1,
          }}
        >
          {getUserValueString(user)}
        </div>
        {isEconomy && (
          <Banknotes
            amount={Math.max(Number(user.value || 0), 0)}
            style={economyBanknoteStyle}
            division={economyDivision}
            xspacing={12}
            styleOverrides={{
              container: {
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                overflow: "hidden",
                zIndex: 0,
                opacity: category === "bank" ? 0.38 : 0.3,
              },
              banknote: { width: "8px", height: "3px" },
            }}
          />
        )}
      </div>
    );
  };

  const renderListRow = (user, position) => {
    const isHighlighted = position === highlightedPosition;
    const medal = medalColors[position];
    const palette = getUserPalette(user, position);
    const banner = getUserBanner(user);
    const xpMeta = getXpMeta(user);

    return (
      <div
        key={user.id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 12px",
          background: isHighlighted ? "rgba(255,182,72,0.15)" : palette.gradient,
          borderRadius: "14px",
          border: isHighlighted ? "1px solid rgba(255,182,72,0.4)" : `1px solid ${withAlpha(palette.accent, 0.27)}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {banner && (
          <img
            src={banner}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.15)",
              filter: "blur(6px)",
              opacity: 0.35,
              zIndex: 0,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(8,15,30,0.36) 0%, rgba(8,15,30,0.12) 100%)",
            zIndex: 0,
          }}
        />
        {isXpCategory && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${xpMeta.progress * 100}%`,
              background: `${xpAccent[category]}55`,
              zIndex: 0,
            }}
          />
        )}

        <div
          style={{
            width: "30px",
            display: "flex",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              minWidth: "26px",
              height: "22px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 6px",
              background: withAlpha(palette.accent, 0.22),
              border: `1px solid ${withAlpha(palette.accent, 0.4)}`,
              color: medal ? "#fff8e9" : palette.text,
              fontSize: "13px",
              fontWeight: 800,
              boxShadow: `0 2px 8px ${withAlpha(palette.accent, 0.2)}`,
            }}
          >
            {medal ? medal.icon : `#${position}`}
          </div>
        </div>

        <img
          src={user.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"}
          alt=""
          style={{ width: "36px", height: "36px", borderRadius: "12px", position: "relative", zIndex: 1 }}
        />

        <div
          style={{
            flex: 1,
            fontSize: "14px",
            fontWeight: 600,
            color: palette.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            position: "relative",
            zIndex: 1,
          }}
        >
          {user.name}
        </div>

        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: isHighlighted ? "#ffb648" : palette.secondary,
            position: "relative",
            zIndex: 1,
          }}
        >
          {getUserValueString(user)}
        </div>
      </div>
    );
  };

  const renderYourPosition = () => {
    if (isHighlightedOnPage) return null;

    const yourUser = {
      id: interaction?.user?.id || "123456789",
      name: displayName,
      avatarURL:
        interaction?.user?.avatarURL ||
        "https://cdn.discordapp.com/embed/avatars/0.png",
      value: database?.value || 1234.56,
    };

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 14px",
          background:
            "linear-gradient(145deg, rgba(255,182,72,0.2) 0%, rgba(255,182,72,0.08) 100%)",
          borderRadius: "18px",
          border: "1px solid rgba(255,182,72,0.3)",
          marginTop: "auto",
        }}
      >
        <div style={{ fontSize: "20px" }}>📍</div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: "12px", color: tertiaryTextColor }}>
            {translations.yourPosition}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: textColor }}>
            #{highlightedPosition} · {getValueString(yourUser.value)}
          </div>
        </div>
      </div>
    );
  };

  const top3 = users.slice(0, 3);
  const rest = users.slice(3, 10);

  return (
    <div
      style={{
        width,
        height,
        background: backgroundGradient,
        borderRadius: "30px",
        padding: "16px 24px 24px 24px",
        fontFamily: "Inter",
        fontWeight: 500,
        color: textColor,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <img
            src={interaction?.user?.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"}
            alt=""
            style={{ width: "52px", height: "52px", borderRadius: "16px", border: "2px solid rgba(255,255,255,0.2)" }}
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ fontSize: "11px", letterSpacing: "0.16em", color: tertiaryTextColor, textTransform: "uppercase" }}>
              {translations.commandLabel}
            </div>
            <div style={{ fontSize: "32px", fontWeight: "bold", lineHeight: 1.1 }}>{translations.title}</div>
            <div style={{ fontSize: "13px", color: secondaryTextColor }}>{displayName}</div>
          </div>
        </div>
      </div>

      {/* Category Groups */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", marginLeft: "-24px", marginRight: "-24px", paddingLeft: "24px", paddingRight: "24px", overflowX: "visible", flexWrap: "nowrap" }}>
        {hiddenBeforeCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
              fontSize: "11px",
              fontWeight: 700,
              color: tertiaryTextColor,
              flexShrink: 0,
            }}
          >
            +{hiddenBeforeCount}
          </div>
        )}
        {visibleCategoryGroups.map((group) => (
          <div
            key={group.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "6px 8px",
              backgroundColor: "rgba(0,0,0,0.12)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: "8px", color: tertiaryTextColor, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              {group.label}
            </div>
            <div style={{ display: "flex", gap: "4px" }}>
              {group.categories.map((cat) => (
                <div
                  key={cat.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    padding: "4px 6px",
                    borderRadius: "999px",
                    backgroundColor: category === cat.key ? "#ffb648" : overlayBackground,
                    color: category === cat.key ? "white" : textColor,
                    fontSize: "10px",
                    fontWeight: category === cat.key ? 700 : 500,
                    border: category === cat.key ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                    flexShrink: 0,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    {cat.label}
                    {isGameCategory && category === cat.key
                      ? ` · ${String(gameScope || "local").toUpperCase()}`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {hiddenAfterCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px",
              fontSize: "11px",
              fontWeight: 700,
              color: tertiaryTextColor,
              flexShrink: 0,
            }}
          >
            +{hiddenAfterCount}
          </div>
        )}
      </div>

      {/* Podium */}
      {top3.length > 0 && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "flex-end" }}>
          {/* Render in order: #2, #1, #3 */}
          {top3.length >= 2 && renderPodiumUser(top3[1], startIndex + 2)}
          {renderPodiumUser(top3[0], startIndex + 1)}
          {top3.length >= 3 && renderPodiumUser(top3[2], startIndex + 3)}
        </div>
      )}

      {/* List */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          flex: 1,
          overflow: "hidden",
          padding: "4px",
          margin: "-4px",
        }}
      >
        {rest.map((user, idx) => renderListRow(user, startIndex + idx + 4))}
      </div>

      {/* Your Position */}
      {renderYourPosition()}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            backgroundColor: overlayBackground,
            borderRadius: "12px",
            fontSize: "13px",
          }}
        >
          <span style={{ color: tertiaryTextColor }}>{translations.page}</span>
          <span style={{ fontWeight: 700, color: "#ffb648" }}>{currentPage} / {totalPages}</span>
        </div>
        <div style={{ fontSize: "11px", color: tertiaryTextColor }}>
          {users.length} {translations.players}
        </div>
      </div>
    </div>
  );
};

Leaderboard2.dimensions = {
  width: 550,
  height: 825,
};

Leaderboard2.localization_strings = {
  title: {
    en: "Leaderboard",
    ru: "Таблица лидеров",
    uk: "Таблиця лідерів",
  },
  commandLabel: {
    en: "/leaderboard",
    ru: "/leaderboard",
    uk: "/leaderboard",
  },
  yourBalance: {
    en: "Your balance",
    ru: "Ваш баланс",
    uk: "Ваш баланс",
  },
  yourPosition: {
    en: "Your position",
    ru: "Ваша позиция",
    uk: "Ваша позиція",
  },
  jumpToRank: {
    en: "Jump",
    ru: "Перейти",
    uk: "Перейти",
  },
  page: {
    en: "Page",
    ru: "Страница",
    uk: "Сторінка",
  },
  players: {
    en: "players",
    ru: "игроков",
    uk: "гравців",
  },
  categoryTotal: {
    en: "Total",
    ru: "Всего",
    uk: "Всього",
  },
  categoryBalance: {
    en: "Balance",
    ru: "Баланс",
    uk: "Баланс",
  },
  categoryBank: {
    en: "Bank",
    ru: "Банк",
    uk: "Банк",
  },
  categoryLevel: {
    en: "Level",
    ru: "Уровень",
    uk: "Рівень",
  },
  categoryChat: {
    en: "Chat",
    ru: "Чат",
    uk: "Чат",
  },
  categoryVoice: {
    en: "Voice",
    ru: "Голос",
    uk: "Голос",
  },
  categoryGaming: {
    en: "Gaming",
    ru: "Игры",
    uk: "Ігри",
  },
  categoryGames: {
    en: "Games",
    ru: "Игры",
    uk: "Ігри",
  },
  categorySeason: {
    en: "Season",
    ru: "Сезон",
    uk: "Сезон",
  },
  groupEconomy: {
    en: "Economy",
    ru: "Экономика",
    uk: "Економіка",
  },
  groupLeveling: {
    en: "Leveling",
    ru: "Уровни",
    uk: "Рівні",
  },
  groupSeason: {
    en: "Season",
    ru: "Сезон",
    uk: "Сезон",
  },
  groupGames: {
    en: "Games",
    ru: "Игры",
    uk: "Ігри",
  },
};

export default Leaderboard2;
