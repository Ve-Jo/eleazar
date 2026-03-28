import fs from "node:fs";
import path from "node:path";

import type {
  ActivityLauncherStrings,
  ActivitySupportedLocale,
} from "../../../shared/src/contracts/hub.ts";

type LocaleDocument = Record<string, unknown>;
type LocalizedLeaf = Record<ActivitySupportedLocale, string>;

type LocalizedGroup<TStrings extends Record<string, string>> = {
  [K in keyof TStrings]: LocalizedLeaf;
};

type ActivityLauncherLocalizationTree = {
  [K in keyof ActivityLauncherStrings]: LocalizedGroup<ActivityLauncherStrings[K]>;
};

const localeCache = new Map<ActivitySupportedLocale, LocaleDocument>();

export const ACTIVITY_LAUNCHER_LOCALIZATIONS = {
  nav: {
    balance: { en: "Balance", ru: "Баланс", uk: "Баланс" },
    level: { en: "Level", ru: "Уровень", uk: "Рівень" },
    cases: { en: "Cases", ru: "Кейсы", uk: "Кейси" },
    upgrades: { en: "Upgrades", ru: "Улучшения", uk: "Покращення" },
    games: { en: "Games", ru: "Игры", uk: "Ігри" },
    launcher: { en: "Eleazar Activity", ru: "Eleazar Activity", uk: "Eleazar Activity" },
    readOnly: { en: "Read-only preview", ru: "Режим предпросмотра", uk: "Режим перегляду" },
    playable: { en: "Playable", ru: "Доступно", uk: "Доступно" },
    comingSoon: { en: "Coming soon", ru: "Скоро", uk: "Скоро" },
    backToLauncher: { en: "Back To Launcher", ru: "Назад в лаунчер", uk: "Назад до лаунчера" },
    expandNavigation: { en: "Expand navigation", ru: "Развернуть навигацию", uk: "Розгорнути навігацію" },
    collapseNavigation: { en: "Collapse navigation", ru: "Свернуть навигацию", uk: "Згорнути навігацію" },
  },
  common: {
    loading: { en: "Loading Activity...", ru: "Загрузка Activity...", uk: "Завантаження Activity..." },
    close: { en: "Close", ru: "Закрыть", uk: "Закрити" },
    coins: { en: "coins", ru: "монет", uk: "монет" },
    wallet: { en: "Wallet", ru: "Кошелёк", uk: "Гаманець" },
    bank: { en: "Bank", ru: "Банк", uk: "Банк" },
    total: { en: "Total", ru: "Всего", uk: "Усього" },
    totalSuffix: { en: "total", ru: "всего", uk: "усього" },
    available: { en: "Available", ru: "Доступно", uk: "Доступно" },
    highScore: { en: "High Score", ru: "Рекорд", uk: "Рекорд" },
    dailyLeft: { en: "Daily Left", ru: "Осталось сегодня", uk: "Залишилось сьогодні" },
    annualRate: { en: "Annual Rate", ru: "Годовая ставка", uk: "Річна ставка" },
    liveGrowth: { en: "Live bank growth", ru: "Рост банка в реальном времени", uk: "Зростання банку в реальному часі" },
    streak: { en: "Streak", ru: "Серия", uk: "Серія" },
    rewardMultiplier: { en: "Reward Multiplier", ru: "Множитель награды", uk: "Множник нагороди" },
    unavailableInPreview: {
      en: "Unavailable in read-only preview",
      ru: "Недоступно в режиме предпросмотра",
      uk: "Недоступно в режимі перегляду",
    },
    submit: { en: "Submit", ru: "Отправить", uk: "Надіслати" },
    refresh: { en: "Refresh", ru: "Обновить", uk: "Оновити" },
    married: { en: "Married", ru: "В браке", uk: "У шлюбі" },
    crime: { en: "Crime", ru: "Преступление", uk: "Злочин" },
    xp: { en: "XP", ru: "XP", uk: "XP" },
    discount: { en: "Discount", ru: "Скидка", uk: "Знижка" },
    seasonXp: { en: "Season XP", ru: "Сезонный XP", uk: "Сезонний XP" },
    xpDiscount: { en: "XP / Discount", ru: "XP / Скидка", uk: "XP / Знижка" },
    newRecord: { en: "NEW", ru: "NEW", uk: "NEW" },
    items: { en: "items", ru: "элементов", uk: "елементів" },
    effectSummary: { en: "Effect summary", ru: "Сводка эффекта", uk: "Зведення ефекту" },
    levelShort: { en: "LVL", ru: "УР.", uk: "РІВ." },
    unitDayShort: { en: "d", ru: "д", uk: "д" },
    unitHourShort: { en: "h", ru: "ч", uk: "г" },
    unitMinuteShort: { en: "m", ru: "м", uk: "хв" },
    unitSecondShort: { en: "s", ru: "с", uk: "с" },
  },
  balance: {
    walletTitle: { en: "Wallet", ru: "Кошелёк", uk: "Гаманець" },
    bankTitle: { en: "Bank", ru: "Банк", uk: "Банк" },
    projectedTitle: { en: "Projected Total", ru: "Прогноз итога", uk: "Прогноз підсумку" },
    cycleTitle: { en: "Growth Cycle", ru: "Цикл роста", uk: "Цикл росту" },
    discountTitle: { en: "Upgrade Discount", ru: "Скидка на улучшения", uk: "Знижка на покращення" },
    depositHint: { en: "Deposit into bank", ru: "Пополнить банк", uk: "Поповнити банк" },
    withdrawHint: { en: "Withdraw into wallet", ru: "Вывести в кошелёк", uk: "Вивести в гаманець" },
    title: { en: "Balance", ru: "Баланс", uk: "Баланс" },
    depositTitle: { en: "Deposit", ru: "Пополнить", uk: "Поповнити" },
    withdrawTitle: { en: "Withdraw", ru: "Вывести", uk: "Вивести" },
  },
  cases: {
    rewardTitle: { en: "Case Rewards", ru: "Награды кейса", uk: "Нагороди кейса" },
    dailyTitle: { en: "Daily Case", ru: "Ежедневный кейс", uk: "Щоденний кейс" },
    weeklyTitle: { en: "Weekly Case", ru: "Еженедельный кейс", uk: "Щотижневий кейс" },
    readyNow: { en: "Ready now", ru: "Готово", uk: "Готово" },
    openSuccess: { en: "Case opened", ru: "Кейс открыт", uk: "Кейс відкрито" },
    title: { en: "Cases", ru: "Кейсы", uk: "Кейси" },
    openButton: { en: "Open Case", ru: "Открыть кейс", uk: "Відкрити кейс" },
    noCratesAvailable: {
      en: "No cases available",
      ru: "Нет доступных кейсов",
      uk: "Немає доступних кейсів",
    },
    dailyName: { en: "Daily Crate", ru: "Ежедневный ящик", uk: "Щоденна скриня" },
    dailyDescription: {
      en: "A crate you can open once every 24 hours",
      ru: "Ящик, который можно открыть раз в 24 часа",
      uk: "Скриня, яку можна відкрити раз на 24 години",
    },
    weeklyName: { en: "Weekly Crate", ru: "Еженедельный ящик", uk: "Щотижнева скриня" },
    weeklyDescription: {
      en: "A crate you can open once every 7 days",
      ru: "Ящик, который можно открыть раз в 7 дней",
      uk: "Скриня, яку можна відкрити раз на 7 днів",
    },
    monthlyCalendar: { en: "Monthly calendar", ru: "Календарь месяца", uk: "Календар місяця" },
  },
  upgrades: {
    focusTitle: { en: "Upgrade Shop", ru: "Магазин улучшений", uk: "Магазин покращень" },
    buyNow: { en: "Buy Upgrade", ru: "Купить улучшение", uk: "Купити покращення" },
    boughtSuccess: { en: "Upgrade purchased", ru: "Улучшение куплено", uk: "Покращення куплено" },
    needMore: { en: "Need more coins", ru: "Нужно больше монет", uk: "Потрібно більше монет" },
    impact: { en: "Impact", ru: "Влияние", uk: "Вплив" },
    current: { en: "Current", ru: "Сейчас", uk: "Зараз" },
    next: { en: "Next", ru: "Следующий", uk: "Далі" },
    gain: { en: "Gain", ru: "Прирост", uk: "Приріст" },
    title: { en: "Shop", ru: "Магазин", uk: "Магазин" },
    purchaseButton: { en: "Purchase", ru: "Купить", uk: "Купити" },
    insufficientFunds: {
      en: "You don't have enough coins for this upgrade",
      ru: "У вас недостаточно монет для этого улучшения",
      uk: "У вас недостатньо монет для цього покращення",
    },
    impactDailyRewards: { en: "Daily rewards", ru: "Ежедневные награды", uk: "Щоденні нагороди" },
    impactGamePayouts: { en: "Game payouts", ru: "Выплаты игр", uk: "Виплати ігор" },
    impactCrimeMastery: { en: "Crime success & fines", ru: "Успех и штрафы crime", uk: "Успіх та штрафи crime" },
    impactDailyWeekly: { en: "Daily/Weekly cooldowns", ru: "Daily/Weekly перезарядки", uk: "Daily/Weekly перезарядки" },
    impactDefense: { en: "Defense & fees", ru: "Защита и комиссии", uk: "Захист та комісії" },
    impactBankMaxTime: { en: "Bank max time", ru: "Макс. время банка", uk: "Макс. час банку" },
    categoryEconomy: { en: "Economy Upgrades", ru: "Улучшения Экономики", uk: "Покращення Економіки" },
    categoryActivity: { en: "Activity Upgrades", ru: "Улучшения Активности", uk: "Покращення Активності" },
    categoryCooldowns: { en: "Cooldown Upgrades", ru: "Улучшения Перезарядки", uk: "Покращення Перезарядки" },
    categoryDefense: { en: "Defense Upgrades", ru: "Улучшения Защиты", uk: "Покращення Захисту" },
    categoryBanking: { en: "Banking Upgrades", ru: "Улучшения Банка", uk: "Покращення Банку" },
  },
  games: {
    title: { en: "Games Launcher", ru: "Лаунчер игр", uk: "Лаунчер ігор" },
    subtitle: {
      en: "2048 is live in the Activity. Other games stay visible while we migrate them.",
      ru: "2048 уже доступна в Activity. Остальные игры пока видимы как следующие этапы миграции.",
      uk: "2048 вже доступна в Activity. Інші ігри поки лишаються видимими як наступний етап міграції.",
    },
    play2048: { en: "Play 2048", ru: "Играть в 2048", uk: "Грати в 2048" },
    stopAndSubmit: { en: "Stop And Submit", ru: "Остановить и отправить", uk: "Зупинити й надіслати" },
    sceneTitle: { en: "2048", ru: "2048", uk: "2048" },
    score: { en: "Score", ru: "Счёт", uk: "Рахунок" },
    moves: { en: "Moves", ru: "Ходы", uk: "Ходи" },
    best: { en: "Best", ru: "Лучший", uk: "Кращий" },
    submitting: { en: "Submitting run...", ru: "Отправляем результат...", uk: "Надсилаємо результат..." },
    runSubmitted: { en: "Run Submitted", ru: "Результат отправлен", uk: "Результат надіслано" },
    controlUp: { en: "Up", ru: "Вверх", uk: "Вгору" },
    controlDown: { en: "Down", ru: "Вниз", uk: "Вниз" },
    controlLeft: { en: "Left", ru: "Влево", uk: "Вліво" },
    controlRight: { en: "Right", ru: "Вправо", uk: "Вправо" },
  },
  level: {
    title: { en: "Level", ru: "Уровень", uk: "Рівень" },
    season: { en: "Season", ru: "Сезон", uk: "Сезон" },
    chat: { en: "Chat", ru: "Чат", uk: "Чат" },
    voice: { en: "Voice", ru: "Голос", uk: "Голос" },
    games: { en: "Games", ru: "Игры", uk: "Ігри" },
    nextRole: { en: "Next Role", ru: "След. роль", uk: "Наст. роль" },
    level: { en: "Level", ru: "Уровень", uk: "Рівень" },
    xp: { en: "XP", ru: "XP", uk: "XP" },
    lvlSuffix: { en: "lvl", ru: "ур.", uk: "рів." },
    noNextRole: { en: "No upcoming role", ru: "Нет ближайшей роли", uk: "Немає найближчої ролі" },
    all: { en: "All", ru: "Все", uk: "Усе" },
  },
  modal: {
    amountLabel: { en: "Amount", ru: "Сумма", uk: "Сума" },
    amountPlaceholder: { en: "Enter amount", ru: "Введите сумму", uk: "Введіть суму" },
    source: { en: "Source", ru: "Источник", uk: "Джерело" },
    destination: { en: "Destination", ru: "Назначение", uk: "Призначення" },
    cancel: { en: "Cancel", ru: "Отмена", uk: "Скасувати" },
    confirmDeposit: { en: "Deposit", ru: "Пополнить", uk: "Поповнити" },
    confirmWithdraw: { en: "Withdraw", ru: "Вывести", uk: "Вивести" },
    preset25: { en: "25%", ru: "25%", uk: "25%" },
    preset50: { en: "50%", ru: "50%", uk: "50%" },
    preset100: { en: "100%", ru: "100%", uk: "100%" },
    enterValidAmount: { en: "Enter a valid amount.", ru: "Введите корректную сумму.", uk: "Введіть коректну суму." },
    moveFailed: { en: "Failed to move funds.", ru: "Не удалось перевести средства.", uk: "Не вдалося переказати кошти." },
  },
  errors: {
    failedLoadLauncher: { en: "Failed to load launcher.", ru: "Не удалось загрузить лаунчер.", uk: "Не вдалося завантажити лаунчер." },
    failedOpenCase: { en: "Failed to open case.", ru: "Не удалось открыть кейс.", uk: "Не вдалося відкрити кейс." },
    failedPurchaseUpgrade: {
      en: "Failed to purchase upgrade.",
      ru: "Не удалось купить улучшение.",
      uk: "Не вдалося купити покращення.",
    },
    failedCompleteGame: { en: "Failed to complete game.", ru: "Не удалось завершить игру.", uk: "Не вдалося завершити гру." },
  },
} as const satisfies ActivityLauncherLocalizationTree;

function getLocalesDir() {
  return path.resolve(import.meta.dir, "../../../localization/locales");
}

function resolveLocalizedGroup<TEntries extends Record<string, LocalizedLeaf>>(
  locale: ActivitySupportedLocale,
  group: string,
  entries: TEntries
): { [K in keyof TEntries]: string } {
  const resolved = {} as { [K in keyof TEntries]: string };

  for (const [key, localizedValue] of Object.entries(entries)) {
    const defaultValue = localizedValue[locale];
    resolved[key as keyof TEntries] = getActivityLocaleValue(
      locale,
      `activities.launcher.${group}.${key}`,
      defaultValue
    );
  }

  return resolved;
}

function getUpgradeCategoryFallback(
  category: string,
  strings: ActivityLauncherStrings
): string {
  switch (category) {
    case "economy":
      return strings.upgrades.categoryEconomy;
    case "activity":
      return strings.upgrades.categoryActivity;
    case "cooldowns":
      return strings.upgrades.categoryCooldowns;
    case "defense":
      return strings.upgrades.categoryDefense;
    case "banking":
      return strings.upgrades.categoryBanking;
    default:
      return strings.nav.upgrades;
  }
}

export function normalizeActivityLocale(input: unknown): ActivitySupportedLocale {
  const raw = String(input || "").trim().toLowerCase();
  if (raw.startsWith("ru")) {
    return "ru";
  }
  if (raw.startsWith("uk") || raw.startsWith("ua")) {
    return "uk";
  }
  return "en";
}

export function clearActivityLocaleCache(): void {
  localeCache.clear();
}

export function loadActivityLocaleDocument(locale: ActivitySupportedLocale): LocaleDocument {
  const cached = localeCache.get(locale);
  if (cached) {
    return cached;
  }

  const targetPath = path.join(getLocalesDir(), `${locale}.json`);
  const payload = JSON.parse(fs.readFileSync(targetPath, "utf-8")) as LocaleDocument;
  localeCache.set(locale, payload);
  return payload;
}

export function getActivityLocaleValue(
  locale: ActivitySupportedLocale,
  keyPath: string,
  fallback = ""
): string {
  const document = loadActivityLocaleDocument(locale);
  const value = keyPath.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, document);

  return typeof value === "string" ? value : fallback;
}

export function getActivityLocalizationPayload(): ActivityLauncherLocalizationTree {
  return ACTIVITY_LAUNCHER_LOCALIZATIONS;
}

export function buildActivityStrings(locale: ActivitySupportedLocale): ActivityLauncherStrings {
  const base: ActivityLauncherStrings = {
    nav: resolveLocalizedGroup(locale, "nav", ACTIVITY_LAUNCHER_LOCALIZATIONS.nav),
    common: resolveLocalizedGroup(locale, "common", ACTIVITY_LAUNCHER_LOCALIZATIONS.common),
    balance: resolveLocalizedGroup(locale, "balance", ACTIVITY_LAUNCHER_LOCALIZATIONS.balance),
    cases: resolveLocalizedGroup(locale, "cases", ACTIVITY_LAUNCHER_LOCALIZATIONS.cases),
    upgrades: resolveLocalizedGroup(locale, "upgrades", ACTIVITY_LAUNCHER_LOCALIZATIONS.upgrades),
    games: resolveLocalizedGroup(locale, "games", ACTIVITY_LAUNCHER_LOCALIZATIONS.games),
    level: resolveLocalizedGroup(locale, "level", ACTIVITY_LAUNCHER_LOCALIZATIONS.level),
    modal: resolveLocalizedGroup(locale, "modal", ACTIVITY_LAUNCHER_LOCALIZATIONS.modal),
    errors: resolveLocalizedGroup(locale, "errors", ACTIVITY_LAUNCHER_LOCALIZATIONS.errors),
  };

  return {
    nav: {
      ...base.nav,
      balance: getActivityLocaleValue(locale, "commands.economy.balance.title", base.nav.balance),
      level: getActivityLocaleValue(locale, "commands.economy.level.title", base.nav.level),
      cases: getActivityLocaleValue(locale, "commands.economy.cases.title", base.nav.cases),
      upgrades: getActivityLocaleValue(locale, "commands.economy.shop.title", base.nav.upgrades),
    },
    common: base.common,
    balance: {
      ...base.balance,
      title: getActivityLocaleValue(locale, "commands.economy.balance.title", base.balance.title),
      depositTitle: getActivityLocaleValue(locale, "commands.economy.deposit.title", base.balance.depositTitle),
      withdrawTitle: getActivityLocaleValue(locale, "commands.economy.withdraw.title", base.balance.withdrawTitle),
    },
    cases: {
      ...base.cases,
      title: getActivityLocaleValue(locale, "commands.economy.cases.title", base.cases.title),
      openButton: getActivityLocaleValue(locale, "commands.economy.cases.openButton", base.cases.openButton),
      noCratesAvailable: getActivityLocaleValue(
        locale,
        "commands.economy.cases.noCratesAvailable",
        base.cases.noCratesAvailable
      ),
      dailyName: getActivityLocaleValue(locale, "commands.economy.cases.types.daily.name", base.cases.dailyName),
      dailyDescription: getActivityLocaleValue(
        locale,
        "commands.economy.cases.types.daily.description",
        base.cases.dailyDescription
      ),
      weeklyName: getActivityLocaleValue(locale, "commands.economy.cases.types.weekly.name", base.cases.weeklyName),
      weeklyDescription: getActivityLocaleValue(
        locale,
        "commands.economy.cases.types.weekly.description",
        base.cases.weeklyDescription
      ),
    },
    upgrades: {
      ...base.upgrades,
      title: getActivityLocaleValue(locale, "commands.economy.shop.title", base.upgrades.title),
      purchaseButton: getActivityLocaleValue(
        locale,
        "commands.economy.shop.purchaseButton",
        base.upgrades.purchaseButton
      ),
      insufficientFunds: getActivityLocaleValue(
        locale,
        "commands.economy.shop.insufficientFunds",
        base.upgrades.insufficientFunds
      ),
      impactDailyRewards: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_daily_rewards",
        base.upgrades.impactDailyRewards
      ),
      impactGamePayouts: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_game_payouts",
        base.upgrades.impactGamePayouts
      ),
      impactCrimeMastery: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_crime_mastery",
        base.upgrades.impactCrimeMastery
      ),
      impactDailyWeekly: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_daily_weekly",
        base.upgrades.impactDailyWeekly
      ),
      impactDefense: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_defense",
        base.upgrades.impactDefense
      ),
      impactBankMaxTime: getActivityLocaleValue(
        locale,
        "commands.economy.shop.impact_bank_max_time",
        base.upgrades.impactBankMaxTime
      ),
      categoryEconomy: getActivityLocaleValue(
        locale,
        "commands.economy.shop.category_economy",
        base.upgrades.categoryEconomy
      ),
      categoryActivity: getActivityLocaleValue(
        locale,
        "commands.economy.shop.category_activity",
        base.upgrades.categoryActivity
      ),
      categoryCooldowns: getActivityLocaleValue(
        locale,
        "commands.economy.shop.category_cooldowns",
        base.upgrades.categoryCooldowns
      ),
      categoryDefense: getActivityLocaleValue(
        locale,
        "commands.economy.shop.category_defense",
        base.upgrades.categoryDefense
      ),
      categoryBanking: getActivityLocaleValue(
        locale,
        "commands.economy.shop.category_banking",
        base.upgrades.categoryBanking
      ),
    },
    games: base.games,
    level: {
      ...base.level,
      title: getActivityLocaleValue(locale, "commands.economy.level.title", base.level.title),
      level: getActivityLocaleValue(locale, "commands.economy.level.level", base.level.level),
      xp: getActivityLocaleValue(locale, "commands.economy.level.xp", base.level.xp),
      nextRole: getActivityLocaleValue(locale, "commands.economy.level.nextLevel", base.level.nextRole),
    },
    modal: base.modal,
    errors: base.errors,
  };
}

export function getUpgradeCategoryTitle(
  locale: ActivitySupportedLocale,
  strings: ActivityLauncherStrings,
  category: string
): string {
  return getActivityLocaleValue(
    locale,
    `commands.economy.shop.category_${category}`,
    getUpgradeCategoryFallback(category, strings)
  );
}
