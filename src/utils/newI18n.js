import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
  constructor() {
    this.translations = {};
    this.currentLocale = "en";
    this.initialized = false;
    this.translationCache = new Map();
    this.supportedLocales = ["en", "ru", "uk"];
    this.localesDir = path.join(__dirname, "../locales");
  }

  /**
   * Initialize the i18n system
   * Loads all translations from files and sets up the system
   */
  initialize() {
    if (this.initialized) return;

    // Ensure locales directory exists
    if (!fs.existsSync(this.localesDir)) {
      fs.mkdirSync(this.localesDir, { recursive: true });
    }

    // Load translations for each supported locale
    for (const locale of this.supportedLocales) {
      this.loadTranslations(locale);
    }

    // Register level-up notification strings
    this.registerNestedLocalizations(
      "levelUp",
      "",
      {
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
      },
      true
    );

    // Add direct translation entries as fallback
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

    // Register the legacy levelUpStrings (now with the new structure)
    this.registerNestedLocalizations("levelUp", "", levelUpStrings, true);

    this.initialized = true;
  }

  /**
   * Load translations for a specific locale from file
   * @param {string} locale - The locale to load
   */
  loadTranslations(locale) {
    const filePath = path.join(this.localesDir, `${locale}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        this.translations[locale] = JSON.parse(fileContent);
      } else {
        // Create empty translations file if it doesn't exist
        this.translations[locale] = {};
        this.saveTranslations(locale);
      }
    } catch (error) {
      console.error(`Error loading translations for ${locale}:`, error);
      this.translations[locale] = {};
    }
  }

  /**
   * Save translations for a specific locale to file
   * @param {string} locale - The locale to save
   */
  saveTranslations(locale) {
    const filePath = path.join(this.localesDir, `${locale}.json`);

    try {
      fs.writeFileSync(
        filePath,
        JSON.stringify(this.translations[locale], null, 2),
        "utf8"
      );
    } catch (error) {
      console.error(`Error saving translations for ${locale}:`, error);
    }
  }

  /**
   * Set the current locale
   * @param {string} locale - The locale to set
   */
  setLocale(locale) {
    if (!locale) return this.currentLocale;

    // Normalize locale (e.g., convert "en-US" to "en")
    const normalizedLocale = locale.split("-")[0].toLowerCase();

    // Check if the locale is supported
    if (!this.supportedLocales.includes(normalizedLocale)) {
      console.warn(
        `Locale ${normalizedLocale} not supported, falling back to en`
      );
      this.currentLocale = "en";
    } else {
      this.currentLocale = normalizedLocale;
    }

    return this.currentLocale;
  }

  /**
   * Get the current locale
   * @returns {string} - The current locale
   */
  getLocale() {
    return this.currentLocale;
  }

  /**
   * Get supported locales
   * @returns {string[]} - Array of supported locales
   */
  getLocales() {
    return this.supportedLocales;
  }

  /**
   * Main translation function
   * @param {string} key - The translation key (using dot notation)
   * @param {Object|string} varsOrLocale - Variables for substitution or locale override
   * @param {string} [locale] - Locale override (if first param is variables)
   * @returns {string} - Translated string
   */
  __(key, varsOrLocale = {}, locale) {
    if (!this.initialized) {
      this.initialize();
    }

    // Handle different calling patterns
    let replacements = {};
    let effectiveLocale = this.currentLocale;

    if (typeof varsOrLocale === "string") {
      // First argument is a locale string
      effectiveLocale = varsOrLocale.split("-")[0].toLowerCase();
    } else if (typeof varsOrLocale === "object" && varsOrLocale !== null) {
      // First argument is a replacements object
      replacements = varsOrLocale;
    }

    // If third param exists, it's a locale override
    if (locale) {
      effectiveLocale = locale.split("-")[0].toLowerCase();
    }

    // Check if locale is supported, fallback to English if not
    if (!this.supportedLocales.includes(effectiveLocale)) {
      console.warn(
        `Locale ${effectiveLocale} not supported, falling back to en`
      );
      effectiveLocale = "en";
    }

    // Check cache first
    const cacheKey = `${effectiveLocale}:${key}`;
    if (this.translationCache.has(cacheKey)) {
      const cachedTranslation = this.translationCache.get(cacheKey);
      return this.replaceVariables(cachedTranslation, replacements);
    }

    // Get the translation using nested property lookup
    const translation = this.getNestedValue(
      this.translations[effectiveLocale],
      key
    );

    // If no translation found, try English as fallback
    if (translation === undefined && effectiveLocale !== "en") {
      const fallbackTranslation = this.getNestedValue(
        this.translations.en,
        key
      );

      if (fallbackTranslation !== undefined) {
        console.log(
          `No ${effectiveLocale} translation for ${key}, using English fallback`
        );
        return this.replaceVariables(fallbackTranslation, replacements);
      }
    }

    // If still no translation, return the key itself
    if (translation === undefined) {
      console.warn(`No translation found for key: ${key}`);
      return key;
    }

    // Cache the translation
    this.translationCache.set(cacheKey, translation);

    // Replace variables in the translation
    return this.replaceVariables(translation, replacements);
  }

  /**
   * Get a translation group (useful for components, games, etc.)
   * @param {string} groupKey - The group key (e.g., 'components.Balance')
   * @param {string} [locale] - Optional locale override
   * @returns {Object} - Object with all translations for the group
   */
  getTranslationGroup(groupKey, locale = null) {
    const effectiveLocale = locale || this.currentLocale;

    // Get the group object
    const group = this.getNestedValue(
      this.translations[effectiveLocale],
      groupKey
    );

    if (!group || typeof group !== "object") {
      console.warn(`No translation group found for: ${groupKey}`);
      return {};
    }

    return group;
  }

  /**
   * Helper to access nested properties with dot notation
   * @param {Object} obj - The object to traverse
   * @param {string} path - The path with dot notation
   * @returns {*} - The value at the path or undefined
   */
  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    const parts = path.split(".");
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Replace variables in translation strings
   * @param {string} text - The text with variables
   * @param {Object} replacements - The variables to replace
   * @returns {string} - The text with replaced variables
   */
  replaceVariables(text, replacements) {
    if (!replacements || typeof replacements !== "object" || !text) {
      return text;
    }

    let result = text;

    // Process each replacement
    for (const [key, value] of Object.entries(replacements)) {
      // Skip undefined values
      if (value === undefined) continue;

      // Convert value to string
      const stringValue = String(value);

      // Replace {{key}} pattern (double braces)
      const doublePattern = `{{${key}}}`;
      result = result.replace(new RegExp(doublePattern, "g"), stringValue);

      // Replace {key} pattern (single braces)
      const singlePattern = `{${key}}`;
      result = result.replace(new RegExp(singlePattern, "g"), stringValue);
    }

    return result;
  }

  /**
   * Add a translation
   * @param {string} locale - The locale
   * @param {string} key - The translation key (dot notation)
   * @param {string} value - The translation value
   * @param {boolean} [save=false] - Whether to save to file immediately
   */
  addTranslation(locale, key, value, save = false) {
    if (!this.supportedLocales.includes(locale)) {
      console.error(`Cannot add translation for unsupported locale: ${locale}`);
      return;
    }

    // Split the key into parts
    const parts = key.split(".");
    let current = this.translations[locale];

    // Navigate to the correct position, creating objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the value at the final position
    current[parts[parts.length - 1]] = value;

    // Clear cache for this key
    this.translationCache.delete(`${locale}:${key}`);

    // Save to file if requested
    if (save) {
      this.saveTranslations(locale);
    }
  }

  /**
   * Register localizations from a module
   * @param {string} category - The category (e.g., 'commands', 'components')
   * @param {string} name - The name within the category
   * @param {Object} localizations - The localization strings
   * @param {boolean} [save=false] - Whether to save to file immediately
   */
  registerLocalizations(category, name, localizations, save = false) {
    if (!localizations || typeof localizations !== "object") {
      console.warn(`Invalid localizations for ${category}.${name}`);
      return;
    }

    console.log(
      `Registering localizations for ${category}.${name}`,
      Object.keys(localizations)
    );

    // Process each key in the localizations
    for (const key in localizations) {
      const value = localizations[key];

      if (typeof value === "object" && value !== null) {
        // Check if this is a locale map
        const isLocaleMap = this.supportedLocales.some(
          (locale) => locale in value
        );

        if (isLocaleMap) {
          // Handle locale map
          for (const locale in value) {
            if (this.supportedLocales.includes(locale)) {
              const translationKey = `${category}.${name}.${key}`;
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          // Handle nested object
          this.registerNestedLocalizations(
            category,
            `${name}.${key}`,
            value,
            save
          );
        }
      }
    }

    // Save all translations if requested
    if (save) {
      for (const locale of this.supportedLocales) {
        this.saveTranslations(locale);
      }
    }
  }

  /**
   * Helper to register nested localization objects
   * @param {string} category - The category
   * @param {string} path - The current path
   * @param {Object} obj - The nested object
   * @param {boolean} save - Whether to save to file
   */
  registerNestedLocalizations(category, path, obj, save) {
    console.log(
      `Registering nested localizations for category: ${category}, path: ${
        path || "(root)"
      }`
    );

    for (const key in obj) {
      const value = obj[key];

      if (typeof value === "object" && value !== null) {
        // Check if this is a locale map
        const isLocaleMap = this.supportedLocales.some(
          (locale) => locale in value
        );

        if (isLocaleMap) {
          // Handle locale map
          for (const locale in value) {
            if (this.supportedLocales.includes(locale)) {
              // Build the translation key based on whether path is empty
              const translationKey = path
                ? `${category}.${path}.${key}`
                : `${category}.${key}`;
              console.log(
                `Adding translation: ${locale}:${translationKey} = ${value[locale]}`
              );
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          // Recurse deeper with proper path joining
          const nextPath = path ? `${path}.${key}` : key;
          this.registerNestedLocalizations(category, nextPath, value, save);
        }
      }
    }
  }

  /**
   * Clear the translation cache
   */
  clearCache() {
    this.translationCache.clear();
  }

  /**
   * Save translations for all supported locales to their respective files.
   */
  saveAllTranslations() {
    console.log(
      `Attempting to save translations for locales: ${this.supportedLocales.join(
        ", "
      )}`
    );
    for (const locale of this.supportedLocales) {
      this.saveTranslations(locale); // Use the existing save method
    }
  }

  /**
   * Debug method to dump the translation table for a specific key
   * @param {string} key - The translation key to debug
   */
  debugTranslations(key) {
    console.log(`\n=== DEBUG TRANSLATIONS FOR KEY: ${key} ===`);

    for (const locale of this.supportedLocales) {
      const translation = this.getNestedValue(this.translations[locale], key);

      if (translation !== undefined) {
        if (typeof translation === "object") {
          // For nested objects, show the structure
          console.log(
            `${locale} (object):`,
            JSON.stringify(translation, null, 2)
          );
        } else {
          // For direct strings, show the value
          console.log(`${locale}: "${translation}"`);
        }
      } else {
        // Try a direct translation lookup
        const directTranslation = this.__(key, {}, locale);
        if (directTranslation !== key) {
          console.log(`${locale}: "${directTranslation}" (via __ method)`);
        } else {
          console.log(`${locale}: undefined`);
        }
      }
    }

    console.log(`=== END DEBUG ===`);
    return this;
  }
}

// Create and initialize a single instance
const i18n = new I18n();
i18n.initialize();

// Debug the level-up translations after initialization
i18n.debugTranslations("levelUp");

export default i18n;
