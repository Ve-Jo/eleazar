import fs from "node:fs";
import path from "node:path";

import type {
  ActivityLauncherStrings,
  ActivitySupportedLocale,
} from "../../../shared/src/contracts/hub.ts";

type LocaleDocument = Record<string, unknown>;

const localeCache = new Map<ActivitySupportedLocale, LocaleDocument>();

const ACTIVITY_STRINGS: Record<ActivitySupportedLocale, ActivityLauncherStrings> = {
  en: {
    nav: {
      balance: "Balance",
      cases: "Cases",
      upgrades: "Upgrades",
      games: "Games",
      launcher: "Eleazar Activity",
      readOnly: "Read-only preview",
      playable: "Playable",
      comingSoon: "Coming soon",
      backToLauncher: "Back To Launcher",
    },
    common: {
      loading: "Loading Activity...",
      coins: "coins",
      wallet: "Wallet",
      bank: "Bank",
      total: "Total",
      available: "Available",
      highScore: "High Score",
      dailyLeft: "Daily Left",
      annualRate: "Annual Rate",
      liveGrowth: "Live bank growth",
      streak: "Streak",
      rewardMultiplier: "Reward Multiplier",
      unavailableInPreview: "Unavailable in read-only preview",
      submit: "Submit",
      refresh: "Refresh",
    },
    balance: {
      walletTitle: "Wallet",
      bankTitle: "Bank",
      projectedTitle: "Projected Total",
      cycleTitle: "Growth Cycle",
      discountTitle: "Upgrade Discount",
      depositHint: "Deposit into bank",
      withdrawHint: "Withdraw into wallet",
    },
    cases: {
      rewardTitle: "Case Rewards",
      dailyTitle: "Daily Case",
      weeklyTitle: "Weekly Case",
      readyNow: "Ready now",
      openSuccess: "Case opened",
    },
    upgrades: {
      focusTitle: "Upgrade Shop",
      buyNow: "Buy Upgrade",
      boughtSuccess: "Upgrade purchased",
      needMore: "Need more coins",
      impact: "Impact",
      current: "Current",
      next: "Next",
      gain: "Gain",
    },
    games: {
      title: "Games Launcher",
      subtitle: "2048 is live in the Activity. Other games stay visible while we migrate them.",
      play2048: "Play 2048",
      stopAndSubmit: "Stop And Submit",
      sceneTitle: "2048",
      score: "Score",
      moves: "Moves",
      best: "Best",
      submitting: "Submitting run...",
      runSubmitted: "Run Submitted",
    },
    modal: {
      amountLabel: "Amount",
      amountPlaceholder: "Enter amount",
      source: "Source",
      destination: "Destination",
      cancel: "Cancel",
      confirmDeposit: "Deposit",
      confirmWithdraw: "Withdraw",
      preset25: "25%",
      preset50: "50%",
      preset100: "100%",
    },
  },
  ru: {
    nav: {
      balance: "Баланс",
      cases: "Кейсы",
      upgrades: "Улучшения",
      games: "Игры",
      launcher: "Eleazar Activity",
      readOnly: "Режим предпросмотра",
      playable: "Доступно",
      comingSoon: "Скоро",
      backToLauncher: "Назад в лаунчер",
    },
    common: {
      loading: "Загрузка Activity...",
      coins: "монет",
      wallet: "Кошелёк",
      bank: "Банк",
      total: "Всего",
      available: "Доступно",
      highScore: "Рекорд",
      dailyLeft: "Осталось сегодня",
      annualRate: "Годовая ставка",
      liveGrowth: "Рост банка в реальном времени",
      streak: "Серия",
      rewardMultiplier: "Множитель награды",
      unavailableInPreview: "Недоступно в режиме предпросмотра",
      submit: "Отправить",
      refresh: "Обновить",
    },
    balance: {
      walletTitle: "Кошелёк",
      bankTitle: "Банк",
      projectedTitle: "Прогноз итога",
      cycleTitle: "Цикл роста",
      discountTitle: "Скидка на улучшения",
      depositHint: "Пополнить банк",
      withdrawHint: "Вывести в кошелёк",
    },
    cases: {
      rewardTitle: "Награды кейса",
      dailyTitle: "Ежедневный кейс",
      weeklyTitle: "Еженедельный кейс",
      readyNow: "Готово",
      openSuccess: "Кейс открыт",
    },
    upgrades: {
      focusTitle: "Магазин улучшений",
      buyNow: "Купить улучшение",
      boughtSuccess: "Улучшение куплено",
      needMore: "Нужно больше монет",
      impact: "Влияние",
      current: "Сейчас",
      next: "Следующий",
      gain: "Прирост",
    },
    games: {
      title: "Лаунчер игр",
      subtitle: "2048 уже доступна в Activity. Остальные игры пока видимы как следующие этапы миграции.",
      play2048: "Играть в 2048",
      stopAndSubmit: "Остановить и отправить",
      sceneTitle: "2048",
      score: "Счёт",
      moves: "Ходы",
      best: "Лучший",
      submitting: "Отправляем результат...",
      runSubmitted: "Результат отправлен",
    },
    modal: {
      amountLabel: "Сумма",
      amountPlaceholder: "Введите сумму",
      source: "Источник",
      destination: "Назначение",
      cancel: "Отмена",
      confirmDeposit: "Пополнить",
      confirmWithdraw: "Вывести",
      preset25: "25%",
      preset50: "50%",
      preset100: "100%",
    },
  },
  uk: {
    nav: {
      balance: "Баланс",
      cases: "Кейси",
      upgrades: "Покращення",
      games: "Ігри",
      launcher: "Eleazar Activity",
      readOnly: "Режим перегляду",
      playable: "Доступно",
      comingSoon: "Скоро",
      backToLauncher: "Назад до лаунчера",
    },
    common: {
      loading: "Завантаження Activity...",
      coins: "монет",
      wallet: "Гаманець",
      bank: "Банк",
      total: "Усього",
      available: "Доступно",
      highScore: "Рекорд",
      dailyLeft: "Залишилось сьогодні",
      annualRate: "Річна ставка",
      liveGrowth: "Зростання банку в реальному часі",
      streak: "Серія",
      rewardMultiplier: "Множник нагороди",
      unavailableInPreview: "Недоступно в режимі перегляду",
      submit: "Надіслати",
      refresh: "Оновити",
    },
    balance: {
      walletTitle: "Гаманець",
      bankTitle: "Банк",
      projectedTitle: "Прогноз підсумку",
      cycleTitle: "Цикл росту",
      discountTitle: "Знижка на покращення",
      depositHint: "Поповнити банк",
      withdrawHint: "Вивести в гаманець",
    },
    cases: {
      rewardTitle: "Нагороди кейса",
      dailyTitle: "Щоденний кейс",
      weeklyTitle: "Щотижневий кейс",
      readyNow: "Готово",
      openSuccess: "Кейс відкрито",
    },
    upgrades: {
      focusTitle: "Магазин покращень",
      buyNow: "Купити покращення",
      boughtSuccess: "Покращення куплено",
      needMore: "Потрібно більше монет",
      impact: "Вплив",
      current: "Зараз",
      next: "Далі",
      gain: "Приріст",
    },
    games: {
      title: "Лаунчер ігор",
      subtitle: "2048 вже доступна в Activity. Інші ігри поки лишаються видимими як наступний етап міграції.",
      play2048: "Грати в 2048",
      stopAndSubmit: "Зупинити й надіслати",
      sceneTitle: "2048",
      score: "Рахунок",
      moves: "Ходи",
      best: "Кращий",
      submitting: "Надсилаємо результат...",
      runSubmitted: "Результат надіслано",
    },
    modal: {
      amountLabel: "Сума",
      amountPlaceholder: "Введіть суму",
      source: "Джерело",
      destination: "Призначення",
      cancel: "Скасувати",
      confirmDeposit: "Поповнити",
      confirmWithdraw: "Вивести",
      preset25: "25%",
      preset50: "50%",
      preset100: "100%",
    },
  },
};

function getLocalesDir() {
  return path.resolve(import.meta.dir, "../../../localization/locales");
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

export function buildActivityStrings(locale: ActivitySupportedLocale): ActivityLauncherStrings {
  const base = ACTIVITY_STRINGS[locale];

  return {
    nav: {
      ...base.nav,
      balance: getActivityLocaleValue(locale, "commands.economy.balance.title", base.nav.balance),
      cases: getActivityLocaleValue(locale, "commands.economy.cases.title", base.nav.cases),
      upgrades: getActivityLocaleValue(locale, "commands.economy.shop.title", base.nav.upgrades),
    },
    common: base.common,
    balance: {
      ...base.balance,
      title: getActivityLocaleValue(locale, "commands.economy.balance.title", base.balance.walletTitle),
      depositTitle: getActivityLocaleValue(locale, "commands.economy.deposit.title", base.modal.confirmDeposit),
      withdrawTitle: getActivityLocaleValue(locale, "commands.economy.withdraw.title", base.modal.confirmWithdraw),
    },
    cases: {
      ...base.cases,
      title: getActivityLocaleValue(locale, "commands.economy.cases.title", base.nav.cases),
      openButton: getActivityLocaleValue(locale, "commands.economy.cases.openButton", "Open"),
      noCratesAvailable: getActivityLocaleValue(
        locale,
        "commands.economy.cases.noCratesAvailable",
        "No cases available"
      ),
      dailyName: getActivityLocaleValue(locale, "commands.economy.cases.types.daily.name", base.cases.dailyTitle),
      dailyDescription: getActivityLocaleValue(
        locale,
        "commands.economy.cases.types.daily.description",
        base.cases.dailyTitle
      ),
      weeklyName: getActivityLocaleValue(locale, "commands.economy.cases.types.weekly.name", base.cases.weeklyTitle),
      weeklyDescription: getActivityLocaleValue(
        locale,
        "commands.economy.cases.types.weekly.description",
        base.cases.weeklyTitle
      ),
    },
    upgrades: {
      ...base.upgrades,
      title: getActivityLocaleValue(locale, "commands.economy.shop.title", base.upgrades.focusTitle),
      purchaseButton: getActivityLocaleValue(locale, "commands.economy.shop.purchaseButton", base.upgrades.buyNow),
      insufficientFunds: getActivityLocaleValue(
        locale,
        "commands.economy.shop.insufficientFunds",
        base.upgrades.needMore
      ),
    },
    games: base.games,
    modal: base.modal,
  };
}
