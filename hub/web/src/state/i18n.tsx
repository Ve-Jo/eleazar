import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Locale = "en" | "ru" | "uk";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
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
