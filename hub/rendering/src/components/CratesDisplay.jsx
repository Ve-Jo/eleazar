import InfoRectangle from "./unified/InfoRectangle.jsx";
import Banknotes from "./unified/Banknotes.jsx";

const CratesDisplay = (props) => {
  const {
    interaction,
    database,
    locale,
    crates = [],
    dailyStatus = null,
    selectedCrate = 0,
    coloring,
    width = 750,
    height = 350,
  } = props;

  const {
    textColor = "#f8fbff",
    secondaryTextColor = "rgba(248,251,255,0.78)",
    tertiaryTextColor = "rgba(248,251,255,0.58)",
    overlayBackground = "rgba(255,255,255,0.08)",
    backgroundGradient = "linear-gradient(145deg, #0f4b63 0%, #1c2f73 45%, #2b1b63 100%)",
  } = coloring || {};

  const translations = Object.entries(
    CratesDisplay.localization_strings
  ).reduce(
    (acc, [key, translations]) => ({
      ...acc,
      [key]: translations[locale] || translations.en,
    }),
    {}
  );

  const formatCooldown = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${minutes < 10 ? "0" + minutes : minutes}:${
      seconds < 10 ? "0" + seconds : seconds
    }`;
  };

  const streak = Number(dailyStatus?.streak || 0);
  const rewardMultiplier = Number(dailyStatus?.rewardMultiplier || 1);
  const weekEntries = Array.isArray(dailyStatus?.currentWeek) ? dailyStatus.currentWeek : [];
  const selectedCrateData = crates[selectedCrate] || crates[0] || null;
  const totalCrates = (crates || []).reduce((sum, crate) => sum + Number(crate?.count || 0), 0);
  const readyCrates = (crates || []).filter((crate) => crate?.available).length;
  const visibleWeekEntries = weekEntries.length > 0
    ? weekEntries
    : Array.from({ length: 7 }, (_, index) => ({
        dateKey: `empty-${index}`,
        dayLabel: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
        dayNumber: "-",
        opened: false,
        isFuture: true,
        isToday: false,
      }));
  const visibleCrates = crates.length > 0 ? crates : [
    {
      name: translations.emptyCrateTitle,
      emoji: "🎁",
      available: false,
      cooldown: 0,
      count: 0,
    },
  ];
  const selectedCooldownText = selectedCrateData?.available
    ? translations.readyToOpen
    : selectedCrateData
    ? formatCooldown(Number(selectedCrateData?.cooldown || 0))
    : translations.noCratesAvailable;

  const renderCrateCard = (crate, index) => {
    const isSelected = index === selectedCrate;
    if (!crate) {
      return null;
    }

    return (
      <div
        key={`crate-${index}`}
        style={{
          minWidth: "128px",
          width: "128px",
          height: "128px",
          borderRadius: "22px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: isSelected ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.07)",
          border: isSelected
            ? "1px solid rgba(255,199,69,0.45)"
            : "1px solid rgba(255,255,255,0.08)",
          boxSizing: "border-box",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div
            style={{
              width: "48px",
              height: "44px",
              borderRadius: "16px",
              backgroundColor: "rgba(255,255,255,0.12)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "24px",
            }}
          >
            {crate.emoji}
          </div>
          {crate.count > 0 ? (
            <div
              style={{
                minWidth: "28px",
                height: "28px",
                padding: "0 8px",
                borderRadius: "999px",
                backgroundColor: "rgba(255,255,255,0.14)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "12px",
                fontWeight: 700,
                color: textColor,
              }}
            >
              {crate.count}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div
            style={{
              fontSize: "14px",
              lineHeight: 1.1,
              fontWeight: 700,
              color: textColor,
              display: "flex",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {crate.name}
          </div>
          <div style={{ fontSize: "11px", color: secondaryTextColor, display: "flex" }}>
            {crate.available ? translations.readyToOpen : formatCooldown(Number(crate.cooldown || 0))}
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
        fontFamily: "Inter", fontWeight: 500,
        color: textColor,
        background: backgroundGradient,
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
          <img
            src={interaction.user.avatarURL}
            style={{
              width: "62px",
              height: "62px",
              borderRadius: "18px",
              backgroundColor: overlayBackground,
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
            }}
            alt={translations.userAvatarAlt}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
            }}
          >
            <div style={{ fontSize: "12px", letterSpacing: "0.16em", color: tertiaryTextColor, display: "flex" }}>
              {translations.commandLabel || "/cases"}
            </div>
          <div
            style={{
              fontSize: "34px",
              fontWeight: "bold",
              display: "flex",
              lineHeight: 1.04,
            }}
          >
            {translations.cratesTitle}
          </div>
          <div
            style={{
              fontSize: "13px",
              color: secondaryTextColor,
              display: "flex",
            }}
          >
            {interaction.user.displayName}
          </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <InfoRectangle
            icon="💵"
            background={overlayBackground}
            borderRadius="16px"
            padding="7px 10px"
            minWidth="0px"
            maxWidth="170px"
            iconSize="16px"
            iconMarginRight="8px"
            title={translations.balance}
            titleStyle={{ fontSize: "11px", color: tertiaryTextColor, letterSpacing: "0.08em" }}
            value={
              <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: textColor }}>
                {Number(database.balance || 0).toFixed(2)}
              </div>
            }
            style={{ position: "relative" }}
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
            borderRadius="16px"
            padding="7px 10px"
            minWidth="0px"
            maxWidth="150px"
            iconSize="14px"
            iconMarginRight="8px"
            title={translations.seasonXP}
            titleStyle={{ fontSize: "11px", color: tertiaryTextColor, letterSpacing: "0.08em" }}
            value={
              <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, color: textColor }}>
                {Math.floor(Number(database.seasonXp || 0))}
              </div>
            }
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "14px", minHeight: "178px" }}>
        <div
          style={{
            flex: "1 1 58%",
            borderRadius: "24px",
            padding: "14px",
            background: "linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            gap: "14px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "126px",
              minWidth: "126px",
              borderRadius: "22px",
              background: "linear-gradient(145deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "60px",
            }}
          >
            {selectedCrateData?.emoji || "🎁"}
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ fontSize: "12px", color: tertiaryTextColor, letterSpacing: "0.10em", display: "flex" }}>
                  {translations.selectedCrateLabel}
                </div>
                <div style={{ fontSize: "24px", fontWeight: "bold", lineHeight: 1.02, display: "flex" }}>
                  {selectedCrateData?.name || translations.noCratesAvailable}
                </div>
                <div style={{ fontSize: "12px", color: secondaryTextColor, display: "flex", marginTop: "6px" }}>
                  {selectedCrateData?.description || translations.emptyCrateDescription}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "999px",
                  backgroundColor: selectedCrateData?.available
                    ? "rgba(109,247,167,0.18)"
                    : "rgba(255,255,255,0.10)",
                  color: selectedCrateData?.available ? "#6df7a7" : textColor,
                  fontSize: "11px",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                <span>{selectedCrateData?.available ? "✅" : "⏳"}</span>
                <span>{selectedCooldownText}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <InfoRectangle
                icon="📦"
                background={overlayBackground}
                borderRadius="12px"
                padding="7px 8px"
                minWidth="0px"
                maxWidth="128px"
                iconSize="14px"
                iconMarginRight="6px"
                title={translations.quantityAvailable}
                titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                value={<div style={{ display: "flex", fontSize: "15px", fontWeight: 700, color: textColor }}>{Number(selectedCrateData?.count || 0)}</div>}
              />
              <InfoRectangle
                icon="🟢"
                background={overlayBackground}
                borderRadius="12px"
                padding="7px 8px"
                minWidth="0px"
                maxWidth="128px"
                iconSize="14px"
                iconMarginRight="6px"
                title={translations.readyNow}
                titleStyle={{ fontSize: "10px", color: tertiaryTextColor, letterSpacing: "0.06em" }}
                value={<div style={{ display: "flex", fontSize: "15px", fontWeight: 700, color: textColor }}>{readyCrates}</div>}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 42%",
            borderRadius: "24px",
            padding: "14px",
            backgroundColor: overlayBackground,
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "8px",
            boxSizing: "border-box",
          }}
        >
          <div style={{ fontSize: "12px", color: tertiaryTextColor, letterSpacing: "0.10em", display: "flex" }}>
            {translations.weekStatus}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: textColor, display: "flex" }}>
                {translations.streak}: {streak}
              </div>
              <div style={{ fontSize: "12px", color: secondaryTextColor, display: "flex" }}>
                {translations.rewardMultiplier}: x{rewardMultiplier.toFixed(2)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 9px",
                borderRadius: "999px",
                backgroundColor: dailyStatus?.available
                  ? "rgba(109,247,167,0.18)"
                  : "rgba(255,255,255,0.10)",
                color: dailyStatus?.available ? "#6df7a7" : textColor,
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              <span>{dailyStatus?.available ? "✅" : "⏳"}</span>
              <span>
                {dailyStatus?.available
                  ? translations.dailyReady
                  : formatCooldown(Number(dailyStatus?.cooldownRemainingMs || 0))}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", justifyContent: "space-between" }}>
            {visibleWeekEntries.map((entry) => (
              <div
                key={entry.dateKey}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "3px",
                  flex: 1,
                  minHeight: "58px",
                  borderRadius: "14px",
                  backgroundColor: entry.isToday
                    ? "rgba(255,255,255,0.16)"
                    : "rgba(255,255,255,0.08)",
                  border: entry.opened
                    ? "1px solid rgba(109,247,167,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                  color: entry.isFuture ? tertiaryTextColor : textColor,
                }}
              >
                <div style={{ fontSize: "10px", color: secondaryTextColor, display: "flex" }}>
                  {entry.dayLabel}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, display: "flex" }}>{entry.dayNumber}</div>
                <div style={{ fontSize: "12px", display: "flex" }}>
                  {entry.opened ? "✅" : entry.isFuture ? "•" : "○"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: textColor, display: "flex" }}>
            {translations.availableCrates}
          </div>
          <div style={{ fontSize: "12px", color: secondaryTextColor, display: "flex" }}>
            {translations.totalCrates}: {totalCrates}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", overflowX: "hidden" }}>
          {visibleCrates.map((crate, index) => renderCrateCard(crate, index))}
        </div>
      </div>
    </div>
  );
};

CratesDisplay.dimensions = {
  width: 750,
  height: 350,
};

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
  weekProgress: {
    en: "Daily calendar",
    ru: "Ежедневный календарь",
    uk: "Щоденний календар",
  },
  weekStatus: {
    en: "Daily streak",
    ru: "Ежедневная серия",
    uk: "Щоденна серія",
  },
  streak: {
    en: "Streak",
    ru: "Серия",
    uk: "Серія",
  },
  rewardMultiplier: {
    en: "Reward boost",
    ru: "Бонус к награде",
    uk: "Бонус до нагороди",
  },
  balance: {
    en: "Balance",
    ru: "Баланс",
    uk: "Баланс",
  },
  commandLabel: {
    en: "/cases",
    ru: "/cases",
    uk: "/cases",
  },
  selectedCrateLabel: {
    en: "Selected crate",
    ru: "Выбранный ящик",
    uk: "Обрана скриня",
  },
  totalCrates: {
    en: "Total crates",
    ru: "Всего ящиков",
    uk: "Усього скринь",
  },
  readyNow: {
    en: "Ready now",
    ru: "Готово сейчас",
    uk: "Готово зараз",
  },
  dailyReady: {
    en: "Daily ready",
    ru: "Ежедневный готов",
    uk: "Щоденна готова",
  },
  noCratesAvailable: {
    en: "No crates yet",
    ru: "Пока нет ящиков",
    uk: "Поки немає скринь",
  },
  emptyCrateTitle: {
    en: "Starter crate",
    ru: "Стартовый ящик",
    uk: "Стартова скриня",
  },
  emptyCrateDescription: {
    en: "Open /cases daily and weekly to build your stash.",
    ru: "Открывайте /cases ежедневно и еженедельно, чтобы собрать запас.",
    uk: "Відкривайте /cases щодня і щотижня, щоб зібрати запас.",
  },
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
