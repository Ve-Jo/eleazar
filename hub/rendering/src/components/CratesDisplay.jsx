import CasesSectionView from "../../../shared/src/ui/CasesSectionView.jsx";

const CratesDisplay = (props) => {
  const {
    interaction,
    database,
    locale,
    crates = [],
    dailyStatus = null,
    selectedCrate = 0,
    rewards = null,
    openedCrate = null,
    viewMode = "menu",
    coloring,
    width = 500,
    height = 650,
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

  console.log(`[CratesDisplay] Using locale: "${locale}", translations keys:`, Object.keys(translations));

  const formatCooldown = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${minutes < 10 ? "0" + minutes : minutes}:${
      seconds < 10 ? "0" + seconds : seconds
    }`;
  };

  const dailyStatusRecord = (() => {
    if (typeof dailyStatus === "string") {
      try {
        const parsed = JSON.parse(dailyStatus);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch {
        return null;
      }
    }
    return dailyStatus && typeof dailyStatus === "object" ? dailyStatus : null;
  })();
  const streak = Number(dailyStatusRecord?.streak || 0);
  const rewardMultiplier = Number(dailyStatusRecord?.rewardMultiplier || 1);
  const rewardRecord = (() => {
    if (typeof rewards === "string") {
      try {
        const parsed = JSON.parse(rewards);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }
    return rewards && typeof rewards === "object" ? rewards : {};
  })();
  const hasRewardsView = viewMode === "rewards" || Object.keys(rewardRecord).length > 0;
  const history = Array.isArray(dailyStatusRecord?.history)
    ? dailyStatusRecord.history.filter((entry) => typeof entry === "string")
    : [];
  const selectedCrateData = crates[selectedCrate] || crates[0] || null;
  const totalCrates = (crates || []).reduce((sum, crate) => sum + Number(crate?.count || 0), 0);
  const readyCrates = (crates || []).filter((crate) => crate?.available).length;
  const weekdayLabels = locale === "ru"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    : locale === "uk"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const referenceDate = dailyStatusRecord?.nextAvailableAt
    ? new Date(Number(dailyStatusRecord.nextAvailableAt) - Number(dailyStatusRecord.cooldownRemainingMs || 0))
    : new Date();
  const monthLabel = `${String(referenceDate.getUTCMonth() + 1).padStart(2, "0")}.${referenceDate.getUTCFullYear()}`;
  const currentWeekOpenedSet = new Set(
    Array.isArray(dailyStatusRecord?.currentWeek)
      ? dailyStatusRecord.currentWeek
          .filter((entry) => entry?.opened && typeof entry?.dateKey === "string")
          .map((entry) => entry.dateKey)
      : []
  );
  const openedHistorySet = new Set([
    ...history,
    ...(typeof dailyStatusRecord?.lastOpenedDay === "string" ? [dailyStatusRecord.lastOpenedDay] : []),
    ...currentWeekOpenedSet,
  ]);
  const todayKey = (() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();
  const monthEntries = (() => {
    const year = referenceDate.getUTCFullYear();
    const monthIndex = referenceDate.getUTCMonth();
    const firstDayUtc = new Date(Date.UTC(year, monthIndex, 1));
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const leadingOffset = (firstDayUtc.getUTCDay() + 6) % 7;
    const cells = [];

    for (let i = 0; i < leadingOffset; i += 1) {
      const date = new Date(Date.UTC(year, monthIndex, 1 - (leadingOffset - i)));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      cells.push({
        dateKey: `${y}-${m}-${d}`,
        dayNumber: date.getUTCDate(),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateKey,
        dayNumber: day,
        inCurrentMonth: true,
      });
    }

    while (cells.length % 7 !== 0 || cells.length < 35) {
      const date = new Date(Date.UTC(year, monthIndex, daysInMonth + (cells.length - (leadingOffset + daysInMonth)) + 1));
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, "0");
      const d = String(date.getUTCDate()).padStart(2, "0");
      cells.push({
        dateKey: `${y}-${m}-${d}`,
        dayNumber: date.getUTCDate(),
        inCurrentMonth: false,
      });
    }

    return cells;
  })();
  const calendarWeeks = [];
  for (let i = 0; i < monthEntries.length; i += 7) {
    calendarWeeks.push(monthEntries.slice(i, i + 7));
  }
  const currentWeekIndex = Math.max(
    calendarWeeks.findIndex((week) =>
      week.some((entry) => entry.dateKey === todayKey)
    ),
    0
  );
  const visibleWeekCount = 3;
  const maxCalendarStart = Math.max(calendarWeeks.length - visibleWeekCount, 0);
  const visibleCalendarStart = Math.min(
    Math.max(currentWeekIndex - 1, 0),
    maxCalendarStart
  );
  const visibleCalendarWeeks = calendarWeeks.slice(
    visibleCalendarStart,
    visibleCalendarStart + visibleWeekCount
  );
  const hasCalendarWeeksBefore = visibleCalendarStart > 0;
  const hasCalendarWeeksAfter =
    visibleCalendarStart + visibleWeekCount < calendarWeeks.length;
  const visibleCrates = crates.length > 0 ? crates : [
    {
      name: translations.emptyCrateTitle,
      emoji: "🎁",
      available: false,
      cooldown: 0,
      count: 0,
    },
  ];
  const rewardItems = [];
  if (Number(rewardRecord?.coins || 0) > 0) {
    rewardItems.push({ emoji: "💵", label: translations.rewardCoinsLabel, value: `+${Number(rewardRecord.coins)}` });
  }
  if (Number(rewardRecord?.seasonXp || 0) > 0) {
    rewardItems.push({ emoji: "✨", label: translations.rewardSeasonXpLabel, value: `+${Number(rewardRecord.seasonXp)}` });
  }
  if (Number(rewardRecord?.discount || 0) > 0) {
    rewardItems.push({ emoji: "🏷️", label: translations.rewardDiscountLabel, value: `${Number(rewardRecord.discount)}%` });
  }
  Object.entries(rewardRecord?.cooldownReductions || {}).forEach(([cooldownType, amount]) => {
    const minutes = Math.floor(Number(amount || 0) / 60000);
    rewardItems.push({
      emoji: "⏱️",
      label: translations.rewardCooldownLabel,
      value: `-${minutes}m ${cooldownType}`,
    });
  });
  const displayName =
    interaction?.user?.displayName || interaction?.user?.username || "Player";

  const renderCrateCard = (crate, index) => {
    const isSelected = index === selectedCrate;
    if (!crate) {
      return null;
    }

    return (
      <div
        key={`crate-${index}`}
        style={{
          minWidth: "148px",
          width: "148px",
          height: "96px",
          borderRadius: "18px",
          padding: "10px",
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
              width: "42px",
              height: "36px",
              borderRadius: "12px",
              backgroundColor: "rgba(255,255,255,0.12)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "20px",
            }}
          >
            {crate.emoji}
          </div>
          {crate.count > 0 ? (
            <div
              style={{
                minWidth: "28px",
                height: "24px",
                padding: "0 8px",
                borderRadius: "999px",
                backgroundColor: "rgba(255,255,255,0.14)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "11px",
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
              fontSize: "13px",
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
          <div style={{ fontSize: "10px", color: secondaryTextColor, display: "flex" }}>
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
      <CasesSectionView
        eyebrow={translations.commandLabel || "/cases"}
        title={translations.cratesTitle}
        subtitle={displayName}
        coloring={{
          textColor,
          secondaryTextColor,
          tertiaryTextColor,
          overlayBackground,
          accentColor: "#ffb648",
          dominantColor: "#42c1ff",
        }}
        summaryCards={[
          {
            label: translations.balance,
            value: Number(database.balance || 0).toFixed(2),
          },
          {
            label: translations.totalCrates,
            value: String(totalCrates),
          },
        ]}
        calendar={{
          label: translations.monthStatus,
          value: monthLabel,
          headline: `${translations.streak}: ${streak}`,
          subline: `${translations.rewardMultiplier}: x${rewardMultiplier.toFixed(2)}`,
          badgeIcon: dailyStatusRecord?.available ? "✅" : "⏳",
          badgeText: dailyStatusRecord?.available
            ? translations.dailyReady
            : formatCooldown(Number(dailyStatusRecord?.cooldownRemainingMs || 0)),
          badgeTone: dailyStatusRecord?.available ? "ready" : "cooldown",
          weekdays: weekdayLabels,
          weeks: visibleCalendarWeeks.map((week) =>
            week.map((entry) => {
              const opened = openedHistorySet.has(entry.dateKey);
              return {
                id: entry.dateKey,
                display: opened ? "✓" : String(entry.dayNumber),
                opened,
                isCurrent: entry.dateKey === todayKey,
                isFuture: entry.dateKey > todayKey,
                isMuted: !entry.inCurrentMonth,
              };
            })
          ),
          showTopFade: hasCalendarWeeksBefore,
          showBottomFade: hasCalendarWeeksAfter,
        }}
        featuredCase={{
          kicker: translations.selectedCrateLabel,
          title: selectedCrateData?.name || translations.noCratesAvailable,
          description:
            selectedCrateData?.description || translations.emptyCrateDescription,
          emoji: selectedCrateData?.emoji || "🎁",
          countLabel: translations.quantityAvailable,
          countValue: String(selectedCrateData?.count || 0),
          statusLabel: translations.cooldown,
          statusValue: selectedCrateData?.available
            ? translations.readyToOpen
            : formatCooldown(Number(selectedCrateData?.cooldown || 0)),
          statusTone: selectedCrateData?.available ? "ready" : "cooldown",
          infoCards: [
            {
              icon: "💵",
              label: translations.rewardCoinsLabel,
              value: selectedCrateData
                ? `${Number(selectedCrateData?.rewards?.min_coins || selectedCrateData?.minCoins || 0)} - ${Number(selectedCrateData?.rewards?.max_coins || selectedCrateData?.maxCoins || 0)}`
                : "0",
            },
            {
              icon: "✨",
              label: translations.rewardSeasonXpLabel,
              value: rewardItems[1]?.value || `+${Number(selectedCrateData?.rewards?.seasonXp_amount || 0)}`,
            },
          ],
        }}
        collectionTitle={translations.availableCrates}
        collectionCountText={`${translations.totalCrates}: ${totalCrates}`}
        cases={visibleCrates.map((crate, index) => ({
          id: `crate-${index}`,
          title: crate.name,
          subtitle: crate.available
            ? translations.readyToOpen
            : formatCooldown(Number(crate.cooldown || 0)),
          emoji: crate.emoji,
          countLabel: crate.count > 0 ? String(crate.count) : "",
          isActive: index === selectedCrate,
        }))}
        detailPanel={
          hasRewardsView
            ? {
                title: translations.rewardsReceived,
                subtitle: `${translations.fromCrate}: ${openedCrate?.name || selectedCrateData?.name || "-"}`,
                items: rewardItems.map((item) => ({
                  icon: item.emoji,
                  label: item.label,
                  value: item.value,
                })),
                emptyText: translations.noRewards,
              }
            : null
        }
      />
    </div>
  );
};

CratesDisplay.dimensions = {
  width: 500,
  height: 650,
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
  monthStatus: {
    en: "Monthly calendar",
    ru: "Календарь месяца",
    uk: "Календар місяця",
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
  rewardsReceived: {
    en: "Rewards received",
    ru: "Полученные награды",
    uk: "Отримані нагороди",
  },
  fromCrate: {
    en: "From crate",
    ru: "Из ящика",
    uk: "Зі скрині",
  },
  rewardCoinsLabel: {
    en: "Coins",
    ru: "Монеты",
    uk: "Монети",
  },
  rewardSeasonXpLabel: {
    en: "Season XP",
    ru: "Сезонный опыт",
    uk: "Сезонний досвід",
  },
  rewardDiscountLabel: {
    en: "Discount",
    ru: "Скидка",
    uk: "Знижка",
  },
  rewardCooldownLabel: {
    en: "Cooldown reduction",
    ru: "Сокращение перезарядки",
    uk: "Скорочення перезарядки",
  },
  noRewards: {
    en: "No rewards received",
    ru: "Награды не получены",
    uk: "Нагороди не отримані",
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
