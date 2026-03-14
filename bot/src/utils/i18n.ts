import hubClient from "../api/hubClient.ts";

type LocaleCode = "en" | "ru" | "uk";
interface TranslationCatalog {
  [key: string]: string | TranslationCatalog;
}

type TranslationValue = string | TranslationCatalog;
type TranslationResponse = { translation?: string } | string | null;

type Localizations = Record<string, unknown>;

type I18nAPI = {
  setTranslation: (locale: string, category: string, key: string, value: unknown) => boolean;
  getCatalog: (locale: string) => TranslationCatalog;
  setCatalog: (locale: string, catalog: TranslationCatalog) => boolean;
};

const supportedLocales: LocaleCode[] = ["en", "ru", "uk"];
const levelUpStrings = {
  chat: {
    title: {
      en: "Level Up!",
      ru: "Повышение уровня!",
      uk: "Підвищення рівня!",
    },
    description: {
      en: "You've leveled up from {oldLevel} to {newLevel}!",
      ru: "Вы повысили уровень с {oldLevel} до {newLevel}!",
      uk: "Ви підвищили рівень з {oldLevel} до {newLevel}!",
    },
    footer: {
      en: "Keep chatting to gain more XP!",
      ru: "Продолжайте общаться, чтобы получить больше XP!",
      uk: "Продовжуйте спілкуватися, щоб отримати більше XP!",
    },
  },
  game: {
    title: {
      en: "Game Level Up!",
      ru: "Повышение игрового уровня!",
      uk: "Підвищення ігрового рівня!",
    },
    description: {
      en: "You've leveled up your gaming skill from {oldLevel} to {newLevel} playing {game}!",
      ru: "Вы повысили свой игровой уровень с {oldLevel} до {newLevel}, играя в {game}!",
      uk: "Ви підвищили свій ігровий рівень з {oldLevel} до {newLevel}, граючи в {game}!",
    },
    footer: {
      en: "Keep playing games to gain more Game XP!",
      ru: "Продолжайте играть, чтобы получить больше игрового XP!",
      uk: "Продовжуйте грати, щоб отримати більше ігрового XP!",
    },
  },
};

function isTranslationCatalog(value: TranslationValue | undefined): value is TranslationCatalog {
  return typeof value === "object" && value !== null;
}

class I18n {
  currentLocale: LocaleCode;
  supportedLocales: LocaleCode[];
  translations: Record<string, TranslationCatalog>;
  initialized: boolean;

  constructor() {
    this.currentLocale = "en";
    this.supportedLocales = [...supportedLocales];
    this.translations = {};
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    await hubClient.registerLocalizations("levelUp", "", levelUpStrings, true);
    this.initialized = true;
  }

  setLocale(locale: string): LocaleCode {
    if (this.supportedLocales.includes(locale as LocaleCode)) {
      this.currentLocale = locale as LocaleCode;
    } else {
      this.currentLocale = "en";
    }
    return this.currentLocale;
  }

  getLocale(): LocaleCode {
    return this.currentLocale;
  }

  getLocales(): Promise<unknown> {
    return hubClient.getSupportedLocales();
  }

  async __(
    key: string,
    varsOrLocale: Record<string, unknown> | string = {},
    locale?: string
  ): Promise<TranslationResponse> {
    let variables: Record<string, unknown> = {};
    let effectiveLocale = this.currentLocale;

    if (typeof varsOrLocale === "string") {
      effectiveLocale = this.setLocale(varsOrLocale);
    } else if (typeof varsOrLocale === "object" && varsOrLocale !== null) {
      variables = varsOrLocale;
      effectiveLocale = (locale as LocaleCode | undefined) || this.currentLocale;
    }

    const response = (await hubClient.getTranslation(
      key,
      variables,
      effectiveLocale
    )) as TranslationResponse;

    if (response && typeof response === "object" && "translation" in response) {
      return response.translation || null;
    }

    return response;
  }

  getTranslationGroup(groupKey: string, locale: string | null = null): Promise<unknown> {
    return hubClient.getTranslationGroup(groupKey, locale || this.currentLocale);
  }

  addTranslation(
    locale: string,
    key: string,
    value: unknown,
    save = false
  ): Promise<unknown> {
    const localeCatalog = this.translations[locale] || {};
    localeCatalog[key] = value as TranslationValue;
    this.translations[locale] = localeCatalog;
    return hubClient.addTranslation(locale, key, value, save);
  }

  registerLocalizations(
    category: string,
    name: string,
    localizations: Localizations,
    save = false
  ): Promise<unknown> {
    return hubClient.registerLocalizations(category, name, localizations, save);
  }

  saveAllTranslations(): Promise<unknown> {
    return hubClient.saveAllTranslations();
  }

  extractLocalizations(category: string, name: string, translations: Localizations): Promise<unknown> {
    return this.registerLocalizations(category, name, translations, false);
  }

  replaceVariables(text: string, replacements: Record<string, unknown> = {}): string {
    return Object.entries(replacements).reduce((acc, [key, value]) => {
      return acc.replaceAll(`{${key}}`, String(value));
    }, text);
  }
}

class I18nAdapter {
  i18n: I18n;
  api: I18nAPI;
  _inMemoryCatalogs: Record<string, TranslationCatalog>;

  constructor(i18n: I18n) {
    this.i18n = i18n;
    this.api = {
      setTranslation: (locale, category, key, value) => {
        const fullKey = `${category}.${key}`;
        void this.i18n.addTranslation(locale, fullKey, value, false);
        return true;
      },
      getCatalog: (locale) => {
        return this.i18n.translations[locale] || {};
      },
      setCatalog: (locale, catalog) => {
        this.i18n.translations[locale] = catalog;
        return true;
      },
    };
    this._inMemoryCatalogs = this.i18n.translations;
  }

  __(
    key: string,
    varsOrLocale: Record<string, unknown> | string = {},
    locale?: string
  ): Promise<TranslationResponse> {
    return this.i18n.__(key, varsOrLocale, locale);
  }

  setLocale(locale: string): LocaleCode {
    return this.i18n.setLocale(locale);
  }

  getLocale(): LocaleCode {
    return this.i18n.getLocale();
  }

  getLocales(): Promise<unknown> {
    return this.i18n.getLocales();
  }

  getTranslationGroup(
    key: string,
    category: string,
    commandName?: string,
    locale?: string
  ): Promise<unknown> {
    const effectiveLocale = locale || this.i18n.getLocale();
    const fullKey = commandName ? `${category}.${commandName}.${key}` : `${category}.${key}`;
    return this.i18n.getTranslationGroup(fullKey, effectiveLocale);
  }

  registerCommand(category: string, commandName: string, translations: Localizations): boolean {
    void this.i18n.extractLocalizations("commands", `${category}.${commandName}`, translations);
    return true;
  }

  registerComponentStrings(componentName: string, translations: Localizations): boolean {
    void this.i18n.extractLocalizations("components", componentName, translations);
    return true;
  }

  debugCatalog(locale: string, category?: string): void {
    console.log("\n======== i18n CATALOG DEBUG ========");
    console.log(`Locale: ${locale}`);

    const catalog = this.i18n.translations[locale] || {};

    if (Object.keys(catalog).length === 0) {
      console.log(`No entries found for locale: ${locale}`);
      return;
    }

    if (category) {
      console.log(`Category: ${category}`);
      if (!catalog[category] || !isTranslationCatalog(catalog[category])) {
        console.log(`Category "${category}" not found in locale ${locale}`);
        return;
      }

      this.printNestedObject(category, catalog[category], 0);
    } else {
      console.log(`All categories: ${Object.keys(catalog).join(", ")}`);

      for (const cat in catalog) {
        const categoryValue = catalog[cat];
        if (categoryValue !== undefined) {
          this.printNestedObject(cat, categoryValue, 0);
        }
      }
    }

    console.log("\n===================================");
  }

  printNestedObject(key: string, value: TranslationValue, level: number): void {
    const indent = "  ".repeat(level);

    if (isTranslationCatalog(value)) {
      console.log(`${indent}${key}:`);
      for (const subKey in value) {
        this.printNestedObject(subKey, value[subKey] as TranslationValue, level + 1);
      }
    } else {
      console.log(`${indent}${key}: \"${value}\"`);
    }
  }

  replaceVariables(text: string, replacements: Record<string, unknown>): string {
    return this.i18n.replaceVariables(text, replacements);
  }
}

const i18n = new I18n();
void i18n.initialize();

const i18nAdapter = new I18nAdapter(i18n);

const setTranslations = (translations: Record<string, Record<string, unknown>>): void => {
  for (const [locale, data] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(data)) {
      void hubClient.addTranslation(locale, key, value, true);
    }
  }
};

const getCatalog = (locale: string): Promise<unknown> => {
  return hubClient.getTranslationGroup("", locale);
};

let currentLocale = "en";
const setLocale = (locale: string): Promise<unknown> => {
  currentLocale = locale;
  return hubClient.setHubLocale(locale);
};

const getLocale = (): Promise<unknown> => {
  return hubClient.getHubLocale();
};

const registerCommandStrings = (
  commandName: string,
  localizations: Localizations
): Promise<unknown> => {
  return hubClient.registerLocalizations("commands", commandName, localizations, true);
};

const registerComponentStrings = (
  componentName: string,
  localizations: Localizations
): Promise<unknown> => {
  return hubClient.registerLocalizations("components", componentName, localizations, true);
};

const __ = async (
  key: string,
  varsOrLocale: Record<string, unknown> | string = {},
  locale?: string
): Promise<unknown> => {
  return await hubClient.getTranslation(key, varsOrLocale, locale || currentLocale);
};

export default i18n;
export {
  I18n,
  i18nAdapter,
  setTranslations,
  getCatalog,
  setLocale,
  getLocale,
  registerCommandStrings,
  registerComponentStrings,
  __,
};
