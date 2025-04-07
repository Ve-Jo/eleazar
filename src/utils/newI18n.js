import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
  constructor() {
    this.translations = {
      en: {},
      ru: {},
      uk: {},
    };
    this.currentLocale = "en";
    this.initialized = false;
  }

  /**
   * Load all translations from the locale directory
   */
  initialize() {
    if (this.initialized) return;

    const localesDir = path.join(__dirname, "../locales");

    // Ensure the directory exists
    if (!fs.existsSync(localesDir)) {
      fs.mkdirSync(localesDir, { recursive: true });
      console.log(`Created locales directory at ${localesDir}`);
    }

    const supportedLocales = ["en", "ru", "uk"];

    for (const locale of supportedLocales) {
      const filePath = path.join(localesDir, `${locale}.json`);

      try {
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath, "utf8");
          this.translations[locale] = JSON.parse(fileContent);
          console.log(`Loaded translations for ${locale}`);
        } else {
          console.log(
            `No translations file found for ${locale}, creating empty file`
          );
          fs.writeFileSync(filePath, JSON.stringify({}, null, 2), "utf8");
        }
      } catch (error) {
        console.error(`Error loading translations for ${locale}:`, error);
        this.translations[locale] = {};
      }
    }

    this.initialized = true;
  }

  /**
   * Set the current locale
   * @param {string} locale - The locale to set
   * @returns {string} - The normalized locale
   */
  setLocale(locale) {
    if (!locale) return this.currentLocale;

    // Normalize locale (e.g., convert "en-US" to "en")
    const normalizedLocale = locale.split("-")[0].toLowerCase();

    // Check if the locale is supported
    if (!this.translations[normalizedLocale]) {
      console.warn(
        `Locale ${normalizedLocale} not supported, falling back to en`
      );
      this.currentLocale = "en";
    } else {
      this.currentLocale = normalizedLocale;
    }

    console.log(`Set locale to ${this.currentLocale}`);
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
    return Object.keys(this.translations);
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
    if (!this.translations[effectiveLocale]) {
      console.warn(
        `Locale ${effectiveLocale} not supported, falling back to en`
      );
      effectiveLocale = "en";
    }

    // Check if the key contains array-like access with square brackets
    // For example: categories[total] should look for translations.categories.total
    const modifiedKey = key.replace(/\[([^\]]+)\]/g, ".$1");

    // Get the translation using nested property lookup
    const translation = this.getNestedValue(
      this.translations[effectiveLocale],
      modifiedKey
    );

    // If no translation found, try English as fallback
    if (translation === undefined && effectiveLocale !== "en") {
      const fallbackTranslation = this.getNestedValue(
        this.translations.en,
        modifiedKey
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
   * Save translations back to file
   * Useful during development to add new translations
   * @param {string} locale - The locale to save
   */
  saveTranslations(locale) {
    if (!this.translations[locale]) {
      console.error(
        `Cannot save translations for unsupported locale: ${locale}`
      );
      return;
    }

    const filePath = path.join(__dirname, "../locales", `${locale}.json`);

    try {
      fs.writeFileSync(
        filePath,
        JSON.stringify(this.translations[locale], null, 2),
        "utf8"
      );
      console.log(`Saved translations for ${locale}`);
    } catch (error) {
      console.error(`Error saving translations for ${locale}:`, error);
    }
  }

  /**
   * Add a translation
   * @param {string} locale - The locale
   * @param {string} key - The translation key (dot notation)
   * @param {string} value - The translation value
   * @param {boolean} [save=false] - Whether to save to file immediately
   */
  addTranslation(locale, key, value, save = false) {
    if (!this.translations[locale]) {
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

    // Save to file if requested
    if (save) {
      this.saveTranslations(locale);
    }
  }

  /**
   * Extract localization strings from objects into the translation system
   * @param {string} category - The category (e.g., 'commands', 'components')
   * @param {string} name - The name within the category
   * @param {Object} strings - The localization strings
   * @param {boolean} [save=false] - Whether to save to file immediately
   */
  extractLocalizations(category, name, strings, save = false) {
    if (!strings || typeof strings !== "object") {
      console.warn(
        `No valid localization strings provided for ${category}.${name}`
      );
      return;
    }

    console.log(`Extracting localizations for ${category}.${name}`);

    // Process each key in the strings
    for (const key in strings) {
      const value = strings[key];

      // Skip non-object values
      if (typeof value !== "object" || value === null) continue;

      // Handle 'command' property specially - flatten the structure
      if (key === "command") {
        // Handle command.name and command.description directly
        for (const cmdKey in value) {
          const cmdValue = value[cmdKey];

          if (typeof cmdValue === "object" && cmdValue !== null) {
            // Check if this is a locale map
            const isLocaleMap = ["en", "ru", "uk"].some(
              (locale) => locale in cmdValue
            );

            if (isLocaleMap) {
              // Register it at the top level (without 'command' prefix)
              for (const locale in cmdValue) {
                if (this.translations[locale]) {
                  const translationKey = `${category}.${name}.${cmdKey}`;
                  this.addTranslation(locale, translationKey, cmdValue[locale]);
                }
              }
            } else {
              // Recurse deeper if not a locale map
              this.extractNestedLocalizations(
                category,
                `${name}.${cmdKey}`,
                cmdValue
              );
            }
          }
        }
      } else {
        // Check if this is a nested object or a locale map
        const isLocaleMap = ["en", "ru", "uk"].some(
          (locale) => locale in value
        );

        if (isLocaleMap) {
          // Handle locale map
          for (const locale in value) {
            if (this.translations[locale]) {
              const translationKey = `${category}.${name}.${key}`;
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          // Handle nested object by recursing with extended path
          this.extractNestedLocalizations(category, `${name}.${key}`, value);
        }
      }
    }

    // Save all translations if requested
    if (save) {
      for (const locale of this.getLocales()) {
        this.saveTranslations(locale);
      }
    }
  }

  /**
   * Helper to extract nested localization objects
   * @param {string} category - The category
   * @param {string} path - The current path
   * @param {Object} obj - The nested object
   */
  extractNestedLocalizations(category, path, obj) {
    for (const key in obj) {
      const value = obj[key];

      if (typeof value === "object" && value !== null) {
        // Check if this is a locale map
        const isLocaleMap = ["en", "ru", "uk"].some(
          (locale) => locale in value
        );

        if (isLocaleMap) {
          // Handle locale map
          for (const locale in value) {
            if (this.translations[locale]) {
              const translationKey = `${category}.${path}.${key}`;
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          // Recurse deeper with the current key added to the path
          this.extractNestedLocalizations(category, `${path}.${key}`, value);
        }
      }
    }
  }

  /**
   * Register localizations defined directly in command/component files
   * This allows for keeping the convenience of local definitions while still having
   * a centralized storage system
   * @param {string} category - The category (e.g., 'commands', 'components', 'games')
   * @param {string} name - The name within the category
   * @param {Object} localizations - The localization object with keys and translations
   * @param {boolean} [saveToFile=false] - Whether to persist to file immediately
   */
  registerLocalizations(category, name, localizations, saveToFile = false) {
    if (!localizations || typeof localizations !== "object") {
      console.warn(`Invalid localizations for ${category}.${name}`);
      return;
    }

    console.log(
      `Registering localizations for ${category}.${name}`,
      Object.keys(localizations)
    );

    // Special handling for subcommands - store everything under the main command category
    if (category === "commands" && name.includes(".")) {
      // Don't split the name - keep subcommand strings nested under the main command
      this.extractLocalizations(category, name, localizations, saveToFile);

      // ALSO register the subcommand strings directly at the main command level
      // This ensures they can be accessed both ways - with context path and direct path
      const mainCommand = name.split(".")[0];

      // Create a nested structure to properly place the subcommand translations
      const nestedLocalizations = {};
      const subcommandName = name.split(".")[1]; // Get subcommand name

      nestedLocalizations[subcommandName] = {};

      // Copy all localizations into the nested structure
      Object.keys(localizations).forEach((key) => {
        if (key === "command") {
          // Skip command key as it's handled differently
          return;
        }

        // For each key like "blush", "dance", etc., create entries in the nested structure
        if (typeof localizations[key] === "object") {
          nestedLocalizations[subcommandName][key] = localizations[key];
        }
      });

      console.log(
        `Also registering at main command level: ${category}.${mainCommand}`,
        Object.keys(nestedLocalizations)
      );

      // Register at main command level
      this.extractLocalizations(
        category,
        mainCommand,
        nestedLocalizations,
        saveToFile
      );
    } else {
      // Regular case - extract as normal
      this.extractLocalizations(category, name, localizations, saveToFile);
    }

    return true;
  }

  /**
   * Create an enhanced i18n instance for a specific context (command, game, etc.)
   * This prefixes all translation keys with the provided path
   * @param {string} category - The category (e.g., 'commands', 'games')
   * @param {string} name - The name within the category
   * @param {string} [currentLocale=null] - Optional locale override
   * @returns {Object} - Enhanced i18n instance
   */
  createContextI18n(category, name, currentLocale = null) {
    const baseLocale = currentLocale || this.currentLocale;
    const basePath = `${category}.${name}`;

    return {
      // Keep reference to original i18n
      _baseI18n: this,

      // Main translation function with prefixed path
      __: (key, varsOrLocale = {}, localeOverride) => {
        // Handle different calling patterns
        let vars = {};
        let locale = baseLocale;

        if (typeof varsOrLocale === "string") {
          // If varsOrLocale is a string, it's a locale override
          locale = varsOrLocale;
        } else if (typeof varsOrLocale === "object" && varsOrLocale !== null) {
          // If it's an object, it's variable replacements
          vars = varsOrLocale;
        }

        // If third param exists, it's a locale override
        if (localeOverride) {
          locale = localeOverride;
        }

        // Case 1: If the key already includes the full category path (like "commands.music"), use it directly
        if (key.includes(`${category}.`)) {
          return this.__(key, vars, locale);
        }

        // Case 2: If the key starts with the category name (like "music.something"),
        // then it's accessing the parent category strings
        const categoryName = name.split(".")[0]; // In case name is like "music.play"
        if (key.startsWith(`${categoryName}.`)) {
          return this.__(`${category}.${key}`, vars, locale);
        }

        // Case 3: If the key contains dots but not the category (like "something.else"),
        // assume it's a full path that doesn't need our prefix
        if (key.includes(".")) {
          return this.__(key, vars, locale);
        }

        // Case 4: Default case - prefix with basePath for subcommand-specific strings
        const fullKey = `${basePath}.${key}`;
        return this.__(fullKey, vars, locale);
      },

      // Allow adding new translations at runtime
      register: (key, translations) => {
        if (!translations || typeof translations !== "object") return;

        const translationObj = {};
        translationObj[key] = translations;

        return this.registerLocalizations(category, name, translationObj);
      },

      // Get the current locale
      getLocale: () => {
        return this.getLocale();
      },

      // Set the current locale
      setLocale: (locale) => {
        return this.setLocale(locale);
      },

      // Get translation group under current context
      getGroup: (key) => {
        return this.getTranslationGroup(`${basePath}.${key}`);
      },
    };
  }
}

// Create and initialize a single instance
const i18n = new I18n();
i18n.initialize();

export default i18n;
