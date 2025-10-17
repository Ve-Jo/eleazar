import hubClient from "../api/hubClient.js";

/**
 * Main I18n class that handles internationalization
 */
export class I18n {
  constructor() {
    this.currentLocale = "en";
    this.supportedLocales = ["en", "ru", "uk"];
  }

  async initialize() {
    // Register level-up notification strings
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
    await hubClient.registerLocalizations("levelUp", "", levelUpStrings, true);
  }

  setLocale(locale) {
    if (this.supportedLocales.includes(locale)) {
      this.currentLocale = locale;
    } else {
      this.currentLocale = "en";
    }
    return this.currentLocale;
  }

  getLocale() {
    return this.currentLocale;
  }

  getLocales() {
    return hubClient.getSupportedLocales();
  }

  async __(key, varsOrLocale = {}, locale) {
    // Handle different parameter patterns:
    // __(key) -> key, {}, currentLocale
    // __(key, variables) -> key, variables, currentLocale
    // __(key, locale) -> key, {}, locale
    // __(key, variables, locale) -> key, variables, locale

    let variables = {};
    let effectiveLocale = this.currentLocale;

    if (typeof varsOrLocale === "string") {
      // Second parameter is a locale string
      effectiveLocale = varsOrLocale;
    } else if (typeof varsOrLocale === "object" && varsOrLocale !== null) {
      // Second parameter is variables object
      variables = varsOrLocale;
      effectiveLocale = locale || this.currentLocale;
    }

    const response = await hubClient.getTranslation(
      key,
      variables,
      effectiveLocale,
    );

    // Extract the translation string from the response object
    if (response && typeof response === "object" && response.translation) {
      return response.translation;
    }

    // Fallback to the response itself if it's already a string
    return response;
  }

  getTranslationGroup(groupKey, locale = null) {
    return hubClient.getTranslationGroup(
      groupKey,
      locale || this.currentLocale,
    );
  }

  addTranslation(locale, key, value, save = false) {
    return hubClient.addTranslation(locale, key, value, save);
  }

  registerLocalizations(category, name, localizations, save = false) {
    return hubClient.registerLocalizations(category, name, localizations, save);
  }

  saveAllTranslations() {
    return hubClient.saveAllTranslations();
  }
}

/**
 * Adapter class to provide compatibility with the old i18n system
 * This helps with transitioning code without breaking existing functionality
 */
class I18nAdapter {
  constructor(i18n) {
    this.i18n = i18n;

    // Create a mock API for compatibility
    this.api = {
      setTranslation: (locale, category, key, value) => {
        // In the new i18n, we just add the translation directly with the full path
        const fullKey = `${category}.${key}`;
        this.i18n.addTranslation(locale, fullKey, value, false);
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

    // Mock internal catalog access for compatibility
    this._inMemoryCatalogs = this.i18n.translations;
  }

  /**
   * Main translation function - directly maps to new await i18n.__
   */
  __(key, varsOrLocale = {}, locale) {
    return this.i18n.__(key, varsOrLocale, locale);
  }

  /**
   * Set the current locale
   */
  setLocale(locale) {
    return this.i18n.setLocale(locale);
  }

  /**
   * Get the current locale
   */
  getLocale() {
    return this.i18n.getLocale();
  }

  /**
   * Get all supported locales
   */
  getLocales() {
    return this.i18n.getLocales();
  }

  /**
   * Get translation group
   */
  getTranslationGroup(key, category, commandName, locale) {
    const effectiveLocale = locale || this.i18n.getLocale();

    // Build the full key based on parameters
    let fullKey;
    if (commandName) {
      fullKey = `${category}.${commandName}.${key}`;
    } else {
      fullKey = `${category}.${key}`;
    }

    return this.i18n.getTranslationGroup(fullKey, effectiveLocale);
  }

  /**
   * Register command translations
   */
  registerCommand(category, commandName, translations) {
    this.i18n.extractLocalizations(
      "commands",
      `${category}.${commandName}`,
      translations,
    );
    return true;
  }

  /**
   * Register component strings
   */
  registerComponentStrings(componentName, translations) {
    this.i18n.extractLocalizations("components", componentName, translations);
    return true;
  }

  /**
   * Debug catalog - compatibility function
   */
  debugCatalog(locale, category) {
    console.log(`\n======== i18n CATALOG DEBUG ========`);
    console.log(`Locale: ${locale}`);

    const catalog = this.i18n.translations[locale] || {};

    if (Object.keys(catalog).length === 0) {
      console.log(`No entries found for locale: ${locale}`);
      return;
    }

    if (category) {
      // Print only a specific category
      console.log(`Category: ${category}`);
      if (!catalog[category]) {
        console.log(`Category "${category}" not found in locale ${locale}`);
        return;
      }

      this.printNestedObject(category, catalog[category], 0);
    } else {
      // Print all categories
      console.log(`All categories: ${Object.keys(catalog).join(", ")}`);

      for (const cat in catalog) {
        console.log(`\n=== Category: ${cat} ===`);
        this.printNestedObject(cat, catalog[cat], 0);
      }
    }

    console.log(`\n===================================`);
  }

  /**
   * Helper function to print a nested object
   */
  printNestedObject(key, value, level) {
    const indent = "  ".repeat(level);

    if (typeof value === "object" && value !== null) {
      console.log(`${indent}${key}:`);
      for (const subKey in value) {
        this.printNestedObject(subKey, value[subKey], level + 1);
      }
    } else {
      console.log(`${indent}${key}: "${value}"`);
    }
  }

  /**
   * Helper to replace variables in text
   */
  replaceVariables(text, replacements) {
    return this.i18n.replaceVariables(text, replacements);
  }
}

// Create the main i18n instance
const i18n = new I18n();
i18n.initialize();

// Create an adapter instance wrapping our i18n
const i18nAdapter = new I18nAdapter(i18n);

// Export the main i18n instance as default
export default i18n;

// Export the adapter for compatibility
export { i18nAdapter };

// Legacy adapter functions for backward compatibility
const setTranslations = (translations) => {
  for (const [locale, data] of Object.entries(translations)) {
    for (const [key, value] of Object.entries(data)) {
      hubClient.addTranslation(locale, key, value, true);
    }
  }
};

const getCatalog = (locale) => {
  return hubClient.getTranslationGroup("", locale);
};

let currentLocale = "en";
const setLocale = (locale) => {
  currentLocale = hubClient.setHubLocale(locale);
  return currentLocale;
};

const getLocale = () => {
  return hubClient.getHubLocale();
};

const registerCommandStrings = (commandName, localizations) => {
  hubClient.registerLocalizations("commands", commandName, localizations, true);
};

const registerComponentStrings = (componentName, localizations) => {
  hubClient.registerLocalizations(
    "components",
    componentName,
    localizations,
    true,
  );
};

const __ = async (key, varsOrLocale = {}, locale) => {
  return await hubClient.getTranslation(key, varsOrLocale, locale);
};

// Export legacy functions
export {
  setTranslations,
  getCatalog,
  setLocale,
  getLocale,
  registerCommandStrings,
  registerComponentStrings,
  __,
};
