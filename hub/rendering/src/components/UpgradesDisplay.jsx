const UpgradesDisplay = (props) => {
  let {
    interaction,
    upgrades,
    currentUpgrade,
    balance,
    width = 1080,
    height = 680,
    i18n,
    coloring,
  } = props;

  const locale = i18n?.getLocale?.() || "en";
  const translations = Object.entries(UpgradesDisplay.localization_strings).reduce(
    (acc, [key, values]) => ({
      ...acc,
      [key]: values[locale] || values.en,
    }),
    {}
  );

  const {
    textColor = "white",
    secondaryTextColor = "rgba(255, 255, 255, 0.84)",
    tertiaryTextColor = "rgba(255, 255, 255, 0.64)",
    overlayBackground = "rgba(0, 0, 0, 0.24)",
    backgroundGradient = "linear-gradient(140deg, #1451c9 0%, #2f46bf 42%, #4e36a9 100%)",
  } = coloring || {};

  if (!Array.isArray(upgrades)) {
    upgrades = [];
  }
  if (typeof currentUpgrade !== "number") {
    currentUpgrade = 0;
  }
  if (!balance) {
    balance = 0;
  }

  const safeIndex = Math.min(Math.max(0, currentUpgrade), Math.max(0, upgrades.length - 1));
  const selectedUpgrade = upgrades[safeIndex] || null;
  const activeCategory = selectedUpgrade?.category || upgrades[0]?.category || "economy";
  const categoryUpgrades = upgrades.filter((upgrade) => (upgrade.category || "economy") === activeCategory);
  const activeDiscount = upgrades.find((upgrade) => upgrade.discountPercent)?.discountPercent || 0;
  const effectUnit = selectedUpgrade?.effectUnit === "m" ? "m" : "%";
  const safeEffect = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  };
  const formatNumber = (value) => Number(value || 0).toFixed(0);
  const nowValue = `${safeEffect(selectedUpgrade?.currentEffect)}${effectUnit}`;
  const nextValue = `${safeEffect(selectedUpgrade?.nextEffect)}${effectUnit}`;
  const gainValue = `+${safeEffect(selectedUpgrade?.deltaEffect)}${effectUnit}`;
  const priceValue = formatNumber(selectedUpgrade?.price);
  const affordable = Boolean(selectedUpgrade?.isAffordable);
  const progress = Math.min(100, Math.max(0, Number(selectedUpgrade?.progress || 0)));
  const needs = formatNumber(selectedUpgrade?.coinsNeeded);
  const progressTone = affordable ? "#6df7a7" : "#ffc745";
  const categoryMap = upgrades.reduce((acc, upgrade) => {
    const category = upgrade.category || "economy";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(upgrade);
    return acc;
  }, {});
  const categories = Object.keys(categoryMap);
  const activeCategoryCount = categoryUpgrades.length;
  const selectedPosition = Math.max(
    1,
    categoryUpgrades.findIndex((upgrade) => upgrade.id === selectedUpgrade?.id) + 1
  );
  const selectedLevel = selectedUpgrade?.currentLevel || 1;
  const nextLevel = selectedUpgrade?.nextLevel || selectedLevel + 1;
  const displayName = interaction?.user?.displayName || interaction?.user?.username || "Player";
  const cardShell = {
    backgroundColor: props.coloring?.overlayBackground || "rgba(255, 255, 255, 0.06)",

  };

  return (
    <div
      style={{
        width,
        height,
        background: backgroundGradient,
        borderRadius: "30px",
        padding: "28px",
        color: textColor,
        fontFamily: "Inter", fontWeight: 500,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "22px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontSize: "15px", color: tertiaryTextColor, letterSpacing: "0.18em", display: "flex" }}>
            {translations.commandLabel}
          </div>
          <div style={{ fontSize: "48px", fontWeight: "bold", display: "flex", lineHeight: 1.05 }}>{translations.title}</div>
          <div style={{ fontSize: "18px", color: secondaryTextColor, marginTop: "6px", display: "flex" }}>
            {displayName} · {translations.categoryCount}: {activeCategoryCount}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {activeDiscount > 0 ? (
            <div
              style={{
                ...cardShell,
                borderRadius: "16px",
                padding: "10px 16px",
                fontSize: "22px",
                display: "flex",
                alignItems: "center",
                color: "#6df84ed0",
              }}
            >
              🛒 {translations.discount}: {activeDiscount}%
            </div>
          ) : null}
          <div
            style={{
              ...cardShell,
              borderRadius: "16px",
              padding: "10px 16px",
              fontSize: "22px",
              display: "flex",
              alignItems: "center",
            }}
          >
            💵 {translations.balance}: {formatNumber(balance)}
          </div>
          <img
            src={interaction?.user?.avatarURL || "https://cdn.discordapp.com/embed/avatars/0.png"}
            alt="User Avatar"
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "16px",
              border: "2px solid rgba(255,255,255,0.28)",
              boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", flex: 1 }}>
        <div
          style={{
            flex: "1 1 70%",
            borderRadius: "28px",
            padding: "24px",
            backgroundColor: "rgba(0, 0, 0, 0.18)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
              <div
                style={{
                  width: "84px",
                  height: "84px",
                  borderRadius: "24px",
                  backgroundColor: "#ffb648",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "44px",
                }}
              >
                {selectedUpgrade?.emoji || "⬆️"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "14px",
                    color: tertiaryTextColor,
                    letterSpacing: "0.12em",
                    marginBottom: "6px",
                    display: "flex",
                  }}
                >
                  {translations.focusedUpgrade}
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    display: "flex",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "600px",
                  }}
                >
                  {selectedUpgrade?.title || "-"}
                </div>
                <div style={{ fontSize: "18px", color: secondaryTextColor, display: "flex", marginTop: "4px" }}>
                  {selectedUpgrade?.impactArea || "-"} · {translations.slot}: {selectedPosition}/{Math.max(activeCategoryCount, 1)}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              ...cardShell,
              borderRadius: "22px",
              padding: "14px 16px",
              marginBottom: "12px",
              fontSize: "16px",
              lineHeight: "1.35",
              color: secondaryTextColor,
              minHeight: "165px",
              display: "flex",
              flex: "0 0 auto",
            }}
          >
            {selectedUpgrade?.description || "-"}
          </div>

          <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
            <div
              style={{
                ...cardShell,
                flex: 1,
                borderRadius: "20px",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div style={{ color: tertiaryTextColor, fontSize: "12px", letterSpacing: "0.08em", marginBottom: "6px", display: "flex" }}>
                  {translations.effectSummary}
                </div>
                <div style={{ fontSize: "26px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <span style={{ display: "flex", whiteSpace: "nowrap" }}>{nowValue}</span>
                  <span style={{ color: tertiaryTextColor, display: "flex" }}>→</span>
                  <span style={{ display: "flex", whiteSpace: "nowrap" }}>{nextValue}</span>
                </div>
              </div>
              <div
                style={{
                  borderRadius: "16px",
                  padding: "10px 12px",
                  backgroundColor: affordable ? "rgba(36, 214, 123, 0.16)" : "rgba(255, 182, 72, 0.16)",
                  borderWidth: "3px",
                  borderStyle: "solid",
                  borderColor: affordable ? "rgba(36, 214, 123, 0.28)" : "rgba(255, 182, 72, 0.28)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexShrink: 0,
                }}
              >
                <div style={{ color: tertiaryTextColor, fontSize: "12px", letterSpacing: "0.08em", display: "flex" }}>
                  {translations.improvement}
                </div>
                <div style={{ fontSize: "22px", fontWeight: "bold", color: affordable ? "#8ff0b7" : "#ffd36d", display: "flex" }}>
                  {gainValue}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <div
              style={{
                ...cardShell,
                width: "240px",
                borderRadius: "20px",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ color: tertiaryTextColor, fontSize: "13px", letterSpacing: "0.08em", display: "flex" }}>{translations.level}</span>
                <span style={{ fontWeight: "bold", fontSize: "28px", display: "flex" }}>
                  {selectedLevel} → {nextLevel}
                </span>
              </div>
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.08)",
                  fontSize: "13px",
                  color: secondaryTextColor,
                  display: "flex",
                }}
              >
                {translations.levelBoost}
              </div>
            </div>

            <div
              style={{
                ...cardShell,
                flex: 1,
                borderRadius: "20px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                  <div style={{ color: textColor, fontSize: "24px", fontWeight: "bold", display: "flex", whiteSpace: "nowrap" }}>
                    {priceValue} 💵
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  <div style={{ color: secondaryTextColor, fontSize: "15px", display: "flex" }}>{progress}%</div>
                  <div style={{ color: affordable ? "#8ff0b7" : tertiaryTextColor, fontSize: "15px", display: "flex", whiteSpace: "nowrap" }}>
                    {affordable ? translations.affordable : `${translations.needMore}: ${needs}`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", width: "100%", height: "16px", borderRadius: "999px", backgroundColor: overlayBackground, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    width: `${progress}%`,
                    height: "100%",
                    backgroundColor: progressTone,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 45%",
            borderRadius: "28px",
            padding: "16px",
            backgroundColor: "rgba(0, 0, 0, 0.18)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "14px" }}>
            <div style={{ fontSize: "16px", color: tertiaryTextColor, letterSpacing: "0.12em", marginBottom: "10px", display: "flex" }}>
              {translations.categories}
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {categories.map((category) => (
              <div
                key={`cat-${category}`}
                style={{
                  fontSize: "16px",
                  borderRadius: "999px",
                  padding: "9px 14px",
                  backgroundColor: category === activeCategory ? "#ffb648" : overlayBackground,
                  color: category === activeCategory ? "white" : textColor,
                  fontWeight: category === activeCategory ? "bold" : "normal",
                  display: "flex",
                  border: category === activeCategory ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {translations[`category_${category}`] || category}
              </div>
            ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden" }}>
            {categoryUpgrades.slice(0, 7).map((upgrade) => {
              const selected = upgrade.id === selectedUpgrade?.id;
              const listAffordable = Boolean(upgrade.isAffordable);
              return (
                <div
                  key={`mini-${upgrade.id}`}
                  style={{
                    borderRadius: "18px",
                    padding: "14px",
                    backgroundColor: selected ? "#ffb648" : "rgba(255,255,255,0.14)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.14)",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "22px",
                        display: "flex",
                        flexShrink: 0,
                      }}
                    >
                      {upgrade.emoji}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: "16px",
                          color: textColor,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "flex",
                        }}
                      >
                        {upgrade.title}
                      </span>
                      <span style={{ fontSize: "13px", color: tertiaryTextColor, display: "flex" }}>
                        LVL {upgrade.currentLevel || 1}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                    <span style={{ fontSize: "15px", color: secondaryTextColor, fontWeight: "bold", display: "flex" }}>
                      {formatNumber(upgrade.price)} 💵
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: listAffordable ? "#8ff0b7" : tertiaryTextColor,
                        display: "flex",
                      }}
                    >
                      {listAffordable ? translations.ready : translations.locked}
                    </span>
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

UpgradesDisplay.dimensions = {
  width: 1080,
  height: 680,
};

UpgradesDisplay.localization_strings = {
  title: { en: "Upgrades", ru: "Улучшения", uk: "Покращення" },
  level: { en: "Level", ru: "Уровень", uk: "Рівень" },
  price: { en: "Price", ru: "Цена", uk: "Ціна" },
  balance: { en: "Balance", ru: "Баланс", uk: "Баланс" },
  discount: { en: "Discount", ru: "Скидка", uk: "Знижка" },
  now: { en: "Now", ru: "Сейчас", uk: "Зараз" },
  next: { en: "Next", ru: "След.", uk: "Далі" },
  gain: { en: "Gain", ru: "Прирост", uk: "Приріст" },
  affordable: { en: "Affordable", ru: "Доступно", uk: "Доступно" },
  needMore: { en: "Need", ru: "Нужно", uk: "Потрібно" },
  ready: { en: "Ready", ru: "Готово", uk: "Готово" },
  locked: { en: "Locked", ru: "Недоступно", uk: "Недоступно" },
  progress: { en: "Progress to purchase", ru: "Прогресс к покупке", uk: "Прогрес до покупки" },
  purchaseProgress: { en: "Purchase progress", ru: "Прогресс покупки", uk: "Прогрес покупки" },
  effectSummary: { en: "Effect summary", ru: "Сводка эффекта", uk: "Підсумок ефекту" },
  improvement: { en: "Improvement", ru: "Улучшение", uk: "Покращення" },
  categories: { en: "Categories", ru: "Категории", uk: "Категорії" },
  categoryFocus: { en: "Focused category", ru: "Активная категория", uk: "Активна категорія" },
  categoryCount: { en: "items in category", ru: "элементов в категории", uk: "елементів у категорії" },
  focusedUpgrade: { en: "Focused upgrade", ru: "Выбранное улучшение", uk: "Вибране покращення" },
  slot: { en: "Slot", ru: "Позиция", uk: "Позиція" },
  levelBoost: { en: "Level jump", ru: "Рост уровня", uk: "Ріст рівня" },
  commandLabel: { en: "UPGRADE COMMAND CENTER", ru: "ЦЕНТР УЛУЧШЕНИЙ", uk: "ЦЕНТР ПОКРАЩЕНЬ" },
  category_economy: { en: "Economy", ru: "Экономика", uk: "Економіка" },
  category_cooldowns: { en: "Cooldowns", ru: "Перезарядки", uk: "Перезарядки" },
};

export default UpgradesDisplay;
