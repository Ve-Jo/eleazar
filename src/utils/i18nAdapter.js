import newI18n from "./newI18n.js";

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
   * Main translation function - directly maps to new i18n.__
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
      translations
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

// Create an adapter instance wrapping our new i18n
const i18nAdapter = new I18nAdapter(newI18n);

export default i18nAdapter;
