import UpgradesSectionView from "../../../shared/src/ui/UpgradesSectionView.jsx";

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
      <UpgradesSectionView
        eyebrow={translations.commandLabel}
        title={translations.title}
        subtitle={`${displayName} · ${translations.categoryCount}: ${activeCategoryCount}`}
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
            value: formatNumber(balance),
          },
          {
            label: translations.discount,
            value: `${activeDiscount}%`,
          },
        ]}
        featuredUpgrade={{
          kicker: translations.focusedUpgrade,
          title: selectedUpgrade?.title || "-",
          subtitle: `${selectedUpgrade?.impactArea || "-"} · ${translations.slot}: ${selectedPosition}/${Math.max(activeCategoryCount, 1)}`,
          emoji: selectedUpgrade?.emoji || "⬆️",
          description: selectedUpgrade?.description || "-",
          effectLabel: translations.effectSummary,
          currentValue: nowValue,
          nextValue: nextValue,
          gainLabel: translations.improvement,
          gainValue: gainValue,
          gainTone: affordable ? "positive" : "warning",
          levelLabel: translations.level,
          levelValue: `${selectedLevel} → ${nextLevel}`,
          levelHint: translations.levelBoost,
          priceValue: `${priceValue} 💵`,
          progressPercent: progress,
          progressText: affordable
            ? translations.affordable
            : `${translations.needMore}: ${needs}`,
          progressTone: affordable ? "positive" : "warning",
        }}
        categoriesTitle={translations.categories}
        categoriesHint={`${activeCategory} · ${activeCategoryCount}`}
        categories={categories.map((category) => ({
          id: category,
          label: translations[`category_${category}`] || category,
          isActive: category === activeCategory,
        }))}
        upgrades={categoryUpgrades.slice(0, 7).map((upgrade) => ({
          id: upgrade.id,
          title: upgrade.title,
          emoji: upgrade.emoji,
          levelLabel: `LVL ${upgrade.currentLevel || 1}`,
          priceLabel: `${formatNumber(upgrade.price)} 💵`,
          statusLabel: upgrade.isAffordable ? translations.ready : translations.locked,
          statusTone: upgrade.isAffordable ? "#8ff0b7" : tertiaryTextColor,
          isActive: upgrade.id === selectedUpgrade?.id,
        }))}
      />
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
  category_economy: { en: "💰 Economy", ru: "💰 Экономика", uk: "💰 Економіка" },
  category_activity: { en: "🎯 Activity", ru: "🎯 Активность", uk: "🎯 Активність" },
  category_cooldowns: { en: "⏳ Cooldowns", ru: "⏳ Перезарядки", uk: "⏳ Перезарядки" },
  category_defense: { en: "🛡️ Defense", ru: "🛡️ Защита", uk: "🛡️ Захист" },
  category_banking: { en: "🏦 Banking", ru: "🏦 Банк", uk: "🏦 Банк" },
  effectPerLevel: { en: "Per level", ru: "За уровень", uk: "За рівень" },
  maxLevel: { en: "Max level", ru: "Макс. уровень", uk: "Макс. рівень" },
  currentBonus: { en: "Current bonus", ru: "Текущий бонус", uk: "Поточний бонус" },
  nextBonus: { en: "Next level bonus", ru: "Бонус след. уровня", uk: "Бонус наст. рівня" },
};

export default UpgradesDisplay;
