import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

const CratesDisplay = (props) => {
  const {
    interaction,
    database,
    locale,
    crates = [],
    selectedCrate = 0,
    coloring,
    width = 750,
    height = 450,
  } = props;

  // Extract coloring props or use defaults
  const {
    textColor = "#FFFFFF",
    secondaryTextColor = "#CCCCCC",
    tertiaryTextColor = "#999999",
    overlayBackground = "rgba(0, 0, 0, 0.25)",
    backgroundGradient = "linear-gradient(135deg, #2a2a72 0%, #121236 100%)",
  } = coloring || {};

  // Get translations based on locale
  const translations = Object.entries(
    CratesDisplay.localization_strings
  ).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[locale] || translations.en,
    }),
    {}
  );

  // Helper function to format milliseconds into hours:minutes:seconds
  const formatCooldown = (ms) => {
    // Calculate hours, minutes and seconds
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Format the time as HH:MM:SS with leading zeros for minutes and seconds
    return `${hours}:${minutes < 10 ? "0" + minutes : minutes}:${
      seconds < 10 ? "0" + seconds : seconds
    }`;
  };

  // Render a single crate card
  const renderCrateCard = (crate, index) => {
    const isSelected = index === selectedCrate;
    const BORDER_RADIUS = 18;
    const HIGHLIGHT_BORDER = 6;

    // Different background colors for available/unavailable crates
    const cardBackground = crate.available
      ? isSelected
        ? "#ffb700" // gold for selected available crate
        : "#1DB935" // green for available crate
      : "#777777"; // gray for unavailable crate

    // Status badge colors
    const statusBackground = crate.available
      ? "rgba(36, 255, 69, 0.8)" // Green background for Ready to open
      : "rgba(255, 87, 34, 0.8)"; // Red background for On Cooldown

    // For inventory crates with count > 0
    const countBadge = crate.count > 0 && (
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          backgroundColor: "#ff5722",
          color: "#FFFFFF",
          borderRadius: "50%",
          width: "28px",
          height: "28px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontWeight: "bold",
          fontSize: "14px",
          fontFamily: "Inter", fontWeight: 500,
        }}
      >
        {crate.count}
      </div>
    );

    // Status text in a box (Ready to open or On Cooldown with timer)
    const statusBox = (
      <div
        style={{
          position: "relative",
          bottom: 8,
          margin: "0 auto",
          backgroundColor: statusBackground,
          color: textColor,
          borderRadius: "10px",
          padding: "6px 10px",
          fontWeight: "bold",
          fontSize: "12px",
          fontFamily: "Inter", fontWeight: 500,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {crate.available ? (
          <div style={{ width: "100%", display: "flex" }}>
            {translations.readyToOpen}
          </div>
        ) : (
          <div style={{ width: "100%", display: "flex" }}>
            {formatCooldown(crate.cooldown)}
          </div>
        )}
      </div>
    );

    return (
      <div
        key={`crate-${index}`}
        style={{
          width: "180px",
          height: "240px",
          backgroundColor: cardBackground,
          borderRadius: `${BORDER_RADIUS}px`,
          border: isSelected ? `${HIGHLIGHT_BORDER}px solid #FFD700` : "none",
          position: "relative",
          flexShrink: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          margin: "0 8px",
          transition: "transform 0.2s",
          transform: isSelected ? "scale(1.05)" : "scale(1)",
        }}
      >
        {/* Crate emoji */}
        <div
          style={{
            width: "100%",
            height: "55%",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "72px",
            borderRadius: isSelected
              ? `${BORDER_RADIUS - HIGHLIGHT_BORDER}px ${
                  BORDER_RADIUS - HIGHLIGHT_BORDER
                }px 0 0`
              : `${BORDER_RADIUS}px ${BORDER_RADIUS}px 0 0`,
          }}
        >
          {crate.emoji}
        </div>

        {/* Content container for vertical centering */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "10px",
            height: "35%",
            position: "relative",
          }}
        >
          {/* Crate name */}
          <div
            style={{
              fontWeight: "bold",
              fontSize: "16px",
              color: textColor,
              fontFamily: "Inter", fontWeight: 500,
              textAlign: "center",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "160px",
              marginBottom: "5px",
            }}
          >
            {crate.name}
          </div>

          {/* Crate description */}
          <div
            style={{
              fontSize: "11px",
              color: textColor,
              opacity: 0.9,
              fontFamily: "Inter", fontWeight: 500,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "flex",
              flexDirection: "column",
              maxWidth: "160px",
              lineHeight: "13px",
              height: "26px",
              marginBottom: "25px", // Space for status box at bottom
            }}
          >
            {crate.description}
          </div>
        </div>

        {countBadge}
        {statusBox}
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
        fontFamily: "Inter", fontWeight: 500,
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
              fontSize: "36px",
              fontWeight: "bold",
              color: textColor,
              fontFamily: "Inter", fontWeight: 500,
              display: "flex",
            }}
          >
            {translations.cratesTitle}
          </div>
          <div
            style={{
              fontSize: "16px",
              color: secondaryTextColor,
              display: "flex",
            }}
          >
            {interaction.user.displayName}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "10px",
              gap: "10px",
            }}
          >
            <InfoRectangle
              icon="💵"
              background={overlayBackground}
              borderRadius="10px"
              padding="6px 10px"
              minWidth="0px"
              maxWidth="200px"
              iconSize="18px"
              iconMarginRight="6px"
              title={translations.balance || "Balance"}
              titleStyle={{ fontSize: "11px", color: secondaryTextColor, opacity: 0.85, letterSpacing: "0.06em" }}
              value={
                <div style={{ display: "flex", fontSize: "20px", fontWeight: 700, color: textColor }}>
                  {database.balance?.toFixed(2) || 0}
                </div>
              }
              style={{ position: "relative", boxSizing: "border-box", minHeight: "60px", height: "60px" }}
            >
              <Banknotes
                amount={Math.max(Number(database.balance || 0), 0)}
                style="banknotes"
                division={50}
                xspacing={18}
                styleOverrides={{
                  container: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 },
                  banknote: { width: "10px", height: "3px" },
                }}
              />
            </InfoRectangle>

            <InfoRectangle
              icon="✨"
              background={overlayBackground}
              borderRadius="10px"
              padding="6px 10px"
              minWidth="0px"
              maxWidth="240px"
              iconSize="16px"
              iconMarginRight="6px"
              title={translations.seasonXP}
              titleStyle={{ fontSize: "11px", color: secondaryTextColor, opacity: 0.85, letterSpacing: "0.06em" }}
              value={
                <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: textColor }}>
                  {Math.floor(database.seasonXp || 0)} XP
                </div>
              }
              style={{ position: "relative", boxSizing: "border-box", minHeight: "60px", height: "60px" }}
            />
          </div>
        </div>
      </div>

      {/* Scrollable crates row */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            marginBottom: "15px",
            color: textColor,
            fontFamily: "Inter", fontWeight: 500,
            display: "flex",
          }}
        >
          {translations.availableCrates}
        </div>
        <div
          style={{
            display: "flex",
            overflowX: "hidden",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            paddingBottom: "15px",
            gap: "5px",
          }}
        >
          {(crates || []).map((crate, index) => renderCrateCard(crate, index))}
        </div>
      </div>
    </div>
  );
};

// Set dimensions for the component
CratesDisplay.dimensions = {
  width: 750,
  height: 450,
};

// Static translations object
CratesDisplay.localization_strings = {
  cratesTitle: {
    en: "Crates",
    ru: "Ящики",
    uk: "Скрині",
  },
  userAvatarAlt: {
    en: "User Avatar",
    ru: "Аватар пользователя",
    uk: "Аватар користувача",
  },
  cooldown: {
    en: "On Cooldown",
    ru: "Перезарядка",
    uk: "Перезарядка",
  },
  cooldownMessage: {
    en: "This crate is on cooldown",
    ru: "Этот ящик на перезарядке",
    uk: "Ця скриня на перезарядці",
  },
  readyToOpen: {
    en: "Ready to open",
    ru: "Готов к открытию",
    uk: "Готова до відкриття",
  },
  quantityAvailable: {
    en: "Available",
    ru: "Доступно",
    uk: "Доступно",
  },
  availableCrates: {
    en: "Available Crates",
    ru: "Доступные ящики",
    uk: "Доступні скрині",
  },
  seasonXP: {
    en: "Season XP",
    ru: "Сезонный опыт",
    uk: "Сезонний досвід",
  },
  timeToOpen: {
    en: "Hours to open",
    ru: "Часов до открытия",
    uk: "Годин до відкриття",
  },
  // Case types moved from cases.js
  types: {
    daily: {
      name: {
        en: "Daily Crate",
        ru: "Ежедневный ящик",
        uk: "Щоденна скриня",
      },
      description: {
        en: "A crate you can open once every 24 hours",
        ru: "Ящик, который можно открыть раз в 24 часа",
        uk: "Скриня, яку можна відкрити раз на 24 години",
      },
    },
    weekly: {
      name: {
        en: "Weekly Crate",
        ru: "Еженедельный ящик",
        uk: "Щотижнева скриня",
      },
      description: {
        en: "A crate you can open once every 7 days",
        ru: "Ящик, который можно открыть раз в 7 дней",
        uk: "Скриня, яку можна відкрити раз на 7 днів",
      },
    },
    special: {
      description: {
        en: "A special crate with unique rewards",
        ru: "Особый ящик с уникальными наградами",
        uk: "Особлива скриня з унікальними нагородами",
      },
    },
  },
  cooldownTypes: {
    daily: {
      en: "Daily Crate",
      ru: "Ежедневный ящик",
      uk: "Щоденна скриня",
    },
    work: {
      en: "Work Command",
      ru: "Команда работы",
      uk: "Команда роботи",
    },
    crime: {
      en: "Crime Command",
      ru: "Команда преступления",
      uk: "Команда злочину",
    },
    message: {
      en: "Message Rewards",
      ru: "Награды за сообщения",
      uk: "Нагороди за повідомлення",
    },
  },
};

export default CratesDisplay;
