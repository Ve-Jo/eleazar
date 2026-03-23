import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Locale = "en" | "ru" | "uk";

type Dictionary = Record<string, string>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string) => string;
};

const dictionaries: Record<Locale, Dictionary> = {
  en: {
    "nav.features": "Features",
    "nav.dashboard": "Dashboard",
    "nav.pricing": "Pricing",
    "nav.login": "Log in",
    "hero.title": "Eleazar Control Center",
    "hero.subtitle": "Manage your bot across guilds with clean controls, real stats, and fast workflows.",
    "hero.cta.primary": "Open Dashboard",
    "hero.cta.secondary": "Explore Features",
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Your profile and guild overview",
    "login.title": "Sign in with Discord",
    "login.subtitle": "Authenticate to manage your guild settings.",
    "pricing.title": "Pricing (Scaffold)",
    "pricing.subtitle": "Plans are placeholders for future subscription rollout.",
  },
  ru: {
    "nav.features": "Функции",
    "nav.dashboard": "Панель",
    "nav.pricing": "Тарифы",
    "nav.login": "Войти",
    "hero.title": "Центр управления Eleazar",
    "hero.subtitle": "Управляйте ботом по серверам через понятные настройки и удобную статистику.",
    "hero.cta.primary": "Открыть панель",
    "hero.cta.secondary": "Посмотреть функции",
    "dashboard.title": "Панель",
    "dashboard.subtitle": "Ваш профиль и обзор сервера",
    "login.title": "Вход через Discord",
    "login.subtitle": "Авторизуйтесь, чтобы управлять настройками серверов.",
    "pricing.title": "Тарифы (заготовка)",
    "pricing.subtitle": "Планы пока подготовлены для будущей подписки.",
  },
  uk: {
    "nav.features": "Можливості",
    "nav.dashboard": "Панель",
    "nav.pricing": "Тарифи",
    "nav.login": "Увійти",
    "hero.title": "Центр керування Eleazar",
    "hero.subtitle": "Керуйте ботом по серверах через зручні налаштування та зрозумілу статистику.",
    "hero.cta.primary": "Відкрити панель",
    "hero.cta.secondary": "Переглянути можливості",
    "dashboard.title": "Панель",
    "dashboard.subtitle": "Ваш профіль і огляд сервера",
    "login.title": "Вхід через Discord",
    "login.subtitle": "Авторизуйтеся, щоб керувати налаштуваннями серверів.",
    "pricing.title": "Тарифи (каркас)",
    "pricing.subtitle": "Плани поки що заготовлені для майбутньої підписки.",
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getInitialLocale(): Locale {
  const saved = localStorage.getItem("web.locale");
  if (saved === "en" || saved === "ru" || saved === "uk") {
    return saved;
  }

  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser === "ru" || browser === "uk") {
    return browser;
  }

  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale());

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("web.locale", next);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key,
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
