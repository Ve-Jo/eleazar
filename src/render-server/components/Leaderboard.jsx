const Leaderboard = (props) => {
  let {
    users,
    currentPage = 1,
    totalPages = 3,
    highlightedPosition = 1,
    width = 400,
    height = 755,
    i18n,
    category = "bank",
  } = props;

  // Transform translations to match the expected structure
  const translations = {};
  Object.entries(Leaderboard.localization_strings).forEach(([key, value]) => {
    if (typeof value === "object" && !Array.isArray(value)) {
      if (value[i18n.getLocale()] !== undefined) {
        // Direct translations
        translations[key] = value[i18n.getLocale()] || value.en;
      } else {
        // Nested translations (like categories)
        translations[key] = {};
        Object.entries(value).forEach(([subKey, subValue]) => {
          translations[key][subKey] = subValue[i18n.getLocale()] || subValue.en;
        });
      }
    }
  });

  console.log(JSON.stringify(props, null, 2));

  const usersPerPage = 10;

  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;

  if (!users) {
    // Generate random users with more realistic data
    const usernames = [
      "DragonSlayer",
      "StarLight",
      "NightOwl",
      "CyberNinja",
      "PixelMaster",
      "ShadowWalker",
      "MoonKnight",
      "SunChaser",
      "StormBringer",
      "FirePhoenix",
      "IceWizard",
      "ThunderBolt",
      "EarthShaker",
      "WindRunner",
      "OceanRider",
    ];

    const generateRandomValue = (category) => {
      switch (category) {
        case "season":
          return Math.floor(Math.random() * 100); // Season XP: 0-100k
        case "level":
          return Math.floor(Math.random() * 100) + 1; // Level: 1-100
        case "games":
          return Math.floor(Math.random() * 100); // Game Score: 0-10k
        default: // For money-related categories
          return parseFloat((Math.random() * 100).toFixed(2)); // Money: 0-1M with 2 decimals
      }
    };

    const generateEconomyData = () => {
      const balance = parseFloat((Math.random() * 500).toFixed(2));
      const bank = parseFloat((Math.random() * 500).toFixed(2));
      return {
        balance,
        bank,
        value: balance + bank, // For total category
      };
    };

    let allUsers = Array(250)
      .fill()
      .map((_, index) => {
        const randomUsername =
          usernames[Math.floor(Math.random() * usernames.length)];
        const economyData = ["total", "balance", "bank"].includes(category)
          ? generateEconomyData()
          : null;

        return {
          id: (1000000000 + index).toString(),
          name: `${randomUsername}${Math.floor(Math.random() * 999)}`,
          value: economyData
            ? category === "balance"
              ? economyData.balance
              : category === "bank"
              ? economyData.bank
              : economyData.value
            : generateRandomValue(category),
          ...(economyData && {
            balance: economyData.balance,
            bank: economyData.bank,
          }),
        };
      })
      .sort((a, b) => b.value - a.value);

    users = allUsers.slice(startIndex, endIndex);
  }

  if (typeof highlightedPosition === "undefined") highlightedPosition = 1;
  let highlightedUser = users.find(
    (user, index) => startIndex + index + 1 === highlightedPosition
  );

  const isHighlightedUserOnCurrentPage = users.some(
    (user, index) => startIndex + index + 1 === highlightedPosition
  );

  const calculateFontSize = (text, maxLength, baseSize) => {
    if (!text) return baseSize;
    const textLength = text.toString().length;
    const scale = Math.min(1, maxLength / textLength);
    return Math.max(14, Math.floor(baseSize * scale)); // Increased minimum font size to 14
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return "0";

    const n = Number(num);
    if (n >= 1e9) {
      return (n / 1e9).toFixed(1) + "B";
    } else if (n >= 1e6) {
      return (n / 1e6).toFixed(1) + "M";
    } else if (n >= 1e3) {
      return (n / 1e3).toFixed(1) + "K";
    }

    return n.toFixed(0); // Changed to not show decimals for small numbers
  };

  const getValueString = (value, category) => {
    const formattedNumber = formatNumber(value);
    switch (category) {
      case "level":
        return `Lvl ${formattedNumber}`; // Shortened "Level" to "Lvl" to save space
      case "season":
        return `${formattedNumber} XP`; // Moved XP to end to align numbers
      case "games":
        return formattedNumber;
      default:
        return `$${formattedNumber}`;
    }
  };

  const getAdditionalInfo = (user) => {
    const info = [];

    // Always show position first
    info.push({
      icon: "🏆",
      value: user.position,
      label: translations.position || "Position",
    });

    // Add all economy info
    if (
      user.balance !== undefined ||
      user.bank !== undefined ||
      user.totalBalance !== undefined
    ) {
      info.push(
        {
          icon: "💰",
          value: user.balance,
          prefix: "$",
          label: translations.categories?.balance || "Balance",
        },
        {
          icon: "💳",
          value: user.bank,
          prefix: "$",
          label: translations.categories?.bank || "Bank Balance",
        },
        {
          icon: "🏦",
          value: user.totalBalance,
          prefix: "$",
          label: translations.categories?.total || "Total Balance",
        }
      );
    }

    // Add XP info if available
    if (user.xpStats) {
      info.push(
        {
          icon: "💭",
          value: user.xpStats.chat,
          label: translations.chatXP || "Chat XP",
        },
        {
          icon: "🎙️",
          value: user.xpStats.voice,
          label: translations.voiceXP || "Voice XP",
        }
      );
    }

    // Add season info if available
    if (user.seasonStats) {
      info.push(
        {
          icon: "📊",
          value: user.seasonStats.rank,
          label: translations.seasonRank || "Season Rank",
        },
        {
          icon: "⭐",
          value: user.seasonStats.totalXP,
          label: translations.totalSeasonXP || "Total Season XP",
        }
      );
    }

    // Add game records if available
    if (user.gameRecords) {
      Object.entries(user.gameRecords).forEach(([game, record]) => {
        info.push({
          icon: game === "2048" ? "🎮" : "🐍",
          value: record.highScore,
          label: `${game} ${translations.highScore || "High Score"}`,
        });
      });
    }

    // Filter out entries with undefined or null values and sort by value
    return info
      .filter((item) => item.value !== undefined && item.value !== null)
      .sort((a, b) => Number(b.value) - Number(a.value));
  };

  const renderInfoCard = (info) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
        borderRadius: "8px",
        padding: "4px 8px",
        minWidth: "60px", // Reduced from 80px
        maxWidth: "90px", // Reduced from 150px
        flex: "0 1 auto", // Changed to prevent stretching
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: calculateFontSize(
            `${info.prefix || ""}${info.value}`,
            12,
            16
          ),
          whiteSpace: "nowrap",
          overflow: "visible",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "14px" }}>{info.icon}</span>
        <span style={{ fontWeight: "bold" }}>
          {info.prefix}
          {formatNumber(info.value)}
        </span>
      </div>
      <div
        style={{
          fontSize: "9px",
          opacity: 0.8,
          textAlign: "center",
          marginTop: "2px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {info.label}
      </div>
    </div>
  );

  const renderHighlightedSection = (user) => {
    const infoCards = getAdditionalInfo(user);
    // Group cards into rows of 5 for better organization
    const rows = [];
    for (let i = 0; i < infoCards.length; i += 5) {
      rows.push(infoCards.slice(i, i + 5));
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          color: "white",
          backgroundColor: "#4791DB",
          borderRadius: "0 0 10px 10px",
          padding: "4px",
          border: "3px solid gold",
          borderTop: "none",
          marginTop: "-1px",
          gap: "4px",
        }}
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              display: "flex",
              gap: "4px",
              justifyContent: "flex-start",
            }}
          >
            {row.map((info) => renderInfoCard(info))}
          </div>
        ))}
      </div>
    );
  };

  const renderUserRow = (user, position, isHighlighted) => {
    const nameFontSize = calculateFontSize(user.name, 20, 24);
    const valueString = getValueString(user.value, category);
    const valueFontSize = calculateFontSize(valueString, 12, 24);

    return (
      <div
        key={user.id}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            color: "white",
            paddingLeft: "10px",
            backgroundColor: isHighlighted
              ? "rgba(255, 255, 255, 0.2)"
              : "transparent",
            border: isHighlighted ? "3px solid gold" : "none",
            borderBottom: isHighlighted ? "none" : "none",
            borderRadius: isHighlighted ? "10px 10px 0 0" : "0",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          {!isHighlighted && (
            <div
              style={{
                marginRight: "10px",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                minWidth: "24px",
                maxWidth: "24px",
              }}
            >
              {position}.
            </div>
          )}

          <div
            style={{
              display: "flex",
              backgroundColor:
                position === 1
                  ? "gold"
                  : position === 2
                  ? "silver"
                  : position === 3
                  ? "#cd7f32"
                  : !isHighlighted
                  ? "rgba(255, 255, 255, 0.1)"
                  : "transparent",
              borderRadius: isHighlighted
                ? "7px 7px 0px 0px"
                : position === startIndex + 1
                ? "10px 10px 0px 0px"
                : position === highlightedPosition + 1
                ? "0px 10px 0px 0px"
                : position === highlightedPosition - 1
                ? "0px 0px 10px 0px"
                : position === endIndex
                ? "0px 0px 10px 10px"
                : "0px",
              marginLeft: isHighlighted ? "-10px" : "0px",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flex: 1,
              padding: "2px",
              minWidth: 0, // Add this to allow flex shrinking
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0)",
                borderRadius: "10px",
                padding: "5px",
                minWidth: 0, // Allow flex shrinking
                flex: 1, // Take available space
                marginRight: "10px", // Add spacing between name and value
              }}
            >
              <div
                style={{
                  marginRight: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0, // Prevent avatar from shrinking
                }}
              >
                <img
                  src={
                    user.avatarURL ||
                    "https://cdn.discordapp.com/embed/avatars/0.png"
                  }
                  alt="User Avatar"
                  width={40}
                  height={40}
                  style={{ borderRadius: "15%", display: "block" }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minWidth: 0, // Allow flex shrinking
                  flex: 1, // Take available space
                }}
              >
                <div
                  style={{
                    fontSize: `${nameFontSize}px`,
                    fontWeight: "bold",
                    display: "flex",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%", // Use percentage instead of fixed width
                  }}
                >
                  {user.name}
                </div>
                {isHighlighted && (
                  <div style={{ fontSize: "8px", display: "flex" }}>
                    #{user.id}
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                fontSize: `${valueFontSize}px`,
                fontWeight: "bold",
                display: "flex",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                borderRadius: "10px",
                marginRight: "10px",
                padding: "5px 10px",
                alignItems: "center",
                justifyContent: "flex-end",
                minWidth: "80px",
                maxWidth: "120px",
                overflow: "visible", // Changed from hidden to visible
                whiteSpace: "nowrap",
                flexShrink: 0,
                position: "relative", // Add position relative
                zIndex: 1, // Ensure value appears above other elements if it overflows
              }}
            >
              {getValueString(user.value, category)}
            </div>
          </div>
        </div>
        {isHighlighted && renderHighlightedSection(user)}
      </div>
    );
  };

  return (
    <div
      style={{
        width: width,
        height: height,
        padding: "10px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter600, sans-serif",
        backgroundColor: "#2196f3",
        borderRadius: "20px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          backgroundColor: "#1976d2",
          borderRadius: "15px",
          padding: "10px",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "100%",
          height: height - 75,
          overflowY: "auto",
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      >
        {users.map((user, index) =>
          renderUserRow(
            user,
            startIndex + index + 1,
            startIndex + index + 1 === highlightedPosition
          )
        )}
        {!isHighlightedUserOnCurrentPage && highlightedUser && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                maxWidth: "100%",
                boxSizing: "border-box",
              }}
            >
              {renderUserRow(highlightedUser, highlightedPosition, true)}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: "16px",
          display: "flex",
          marginTop: "10px",
          color: "white",
          borderRadius: "10px",
          padding: "5px",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          height: 45,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            padding: "5px",
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: calculateFontSize(translations.currentPage, 15, 16),
            }}
          >
            {translations.currentPage}:
          </span>
          <div
            style={{
              fontWeight: "bold",
              backgroundColor: "orange",
              padding: "5px",
              borderRadius: "5px",
              marginLeft: "5px",
              color: "white",
              display: "flex",
              fontSize: calculateFontSize(
                `${currentPage} / ${totalPages}`,
                8,
                16
              ),
            }}
          >
            {currentPage} / {totalPages}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            borderRadius: "10px",
            padding: "5px",
          }}
        >
          <span
            style={{
              display: "flex",
              fontSize: calculateFontSize(translations.sortBy, 15, 16),
            }}
          >
            {translations.sortBy}:
          </span>
          <div
            style={{
              fontWeight: "bold",
              backgroundColor: "orange",
              padding: "5px",
              borderRadius: "5px",
              marginLeft: "5px",
              color: "white",
              display: "flex",
              fontSize: calculateFontSize(
                translations.categories?.[category] || translations.total,
                15,
                16
              ),
            }}
          >
            {translations.categories?.[category] || translations.total}
          </div>
        </div>
      </div>
    </div>
  );
};

Leaderboard.dimensions = {
  width: 400,
  height: 755,
};

// Static translations object that will be synchronized
Leaderboard.localization_strings = {
  title: {
    en: "Leaderboard",
    ru: "Таблица лидеров",
    uk: "Таблиця лідерів",
  },
  currentPage: {
    en: "Current page",
    ru: "Текущая страница",
    uk: "Поточна сторінка",
  },
  sortBy: {
    en: "Sort by",
    ru: "Сортировка",
    uk: "Сортування",
  },
  total: {
    en: "Total",
    ru: "Всего",
    uk: "Всього",
  },
  categories: {
    total: {
      en: "Total Balance",
      ru: "Общий баланс",
      uk: "Загальний баланс",
    },
    balance: {
      en: "Balance",
      ru: "Баланс",
      uk: "Баланс",
    },
    bank: {
      en: "Bank Balance",
      ru: "Банковский баланс",
      uk: "Банківський баланс",
    },
    level: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    games: {
      en: "Games",
      ru: "Игры",
      uk: "Ігри",
    },
    season: {
      en: "Season XP",
      ru: "Сезонный опыт",
      uk: "Сезонний досвід",
    },
  },
  position: {
    en: "Position",
    ru: "Позиция",
    uk: "Позиція",
  },
  chatXP: {
    en: "Chat XP",
    ru: "Опыт чата",
    uk: "Досвід чату",
  },
  voiceXP: {
    en: "Voice XP",
    ru: "Голосовой опыт",
    uk: "Голосовий досвід",
  },
  seasonRank: {
    en: "Season Rank",
    ru: "Ранг сезона",
    uk: "Ранг сезону",
  },
  totalSeasonXP: {
    en: "Total Season XP",
    ru: "Всего опыта за сезон",
    uk: "Всього досвіду за сезон",
  },
  highScore: {
    en: "High Score",
    ru: "Рекорд",
    uk: "Рекорд",
  },
  totalExperience: {
    en: "Total Experience",
    ru: "Всего опыта",
    uk: "Всього досвіду",
  },
  gamingExperience: {
    en: "Gaming Experience",
    ru: "Игровой опыт",
    uk: "Ігровий досвід",
  },
  gameScore: {
    en: "Game Score",
    ru: "Игровой счет",
    uk: "Ігровий рахунок",
  },
  snakeScore: {
    en: "Snake Score",
    ru: "Счет в Snake",
    uk: "Рахунок у Snake",
  },
  _2048Score: {
    en: "2048 Score",
    ru: "Счет в 2048",
    uk: "Рахунок у 2048",
  },
  voiceTime: {
    en: "Voice Time",
    ru: "Время в голосе",
    uk: "Час у голосі",
  },
  messageCount: {
    en: "Messages",
    ru: "Сообщений",
    uk: "Повідомлень",
  },
  commandCount: {
    en: "Commands Used",
    ru: "Команд использовано",
    uk: "Команд використано",
  },
  totalStats: {
    en: "Total Stats",
    ru: "Общая статистика",
    uk: "Загальна статистика",
  },
  rank: {
    en: "Rank",
    ru: "Ранг",
    uk: "Ранг",
  },
};

export default Leaderboard;
