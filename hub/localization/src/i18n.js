import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class I18n {
  constructor() {
    this.translations = {};
    this.currentLocale = 'en';
    this.initialized = false;
    this.translationCache = new Map();
    this.supportedLocales = ['en', 'ru', 'uk'];
    this.localesDir = path.join(__dirname, '../locales');
  }

  initialize() {
    if (this.initialized) return;

    if (!fs.existsSync(this.localesDir)) {
      fs.mkdirSync(this.localesDir, { recursive: true });
    }

    for (const locale of this.supportedLocales) {
      this.loadTranslations(locale);
    }

    this.initialized = true;
  }

  loadTranslations(locale) {
    const filePath = path.join(this.localesDir, `${locale}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        this.translations[locale] = JSON.parse(fileContent);
      } else {
        this.translations[locale] = {};
        this.saveTranslations(locale);
      }
    } catch (error) {
      console.error(`Error loading translations for ${locale}:`, error);
      this.translations[locale] = {};
    }
  }

  saveTranslations(locale) {
    const filePath = path.join(this.localesDir, `${locale}.json`);

    try {
      fs.writeFileSync(filePath, JSON.stringify(this.translations[locale], null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving translations for ${locale}:`, error);
    }
  }

  setLocale(locale) {
    if (!locale) return this.currentLocale;

    const normalizedLocale = locale.split('-')[0].toLowerCase();

    if (!this.supportedLocales.includes(normalizedLocale)) {
      console.warn(`Locale ${normalizedLocale} not supported, falling back to en`);
      this.currentLocale = 'en';
    } else {
      this.currentLocale = normalizedLocale;
    }

    return this.currentLocale;
  }

  getLocale() {
    return this.currentLocale;
  }

  getLocales() {
    return this.supportedLocales;
  }

  __(key, varsOrLocale = {}, locale) {
    if (!this.initialized) {
      this.initialize();
    }

    let replacements = {};
    let effectiveLocale = this.currentLocale;

    if (typeof varsOrLocale === 'string') {
      effectiveLocale = varsOrLocale.split('-')[0].toLowerCase();
    } else if (typeof varsOrLocale === 'object' && varsOrLocale !== null) {
      replacements = varsOrLocale;
    }

    if (locale) {
      effectiveLocale = locale.split('-')[0].toLowerCase();
    }

    if (!this.supportedLocales.includes(effectiveLocale)) {
      console.warn(`Locale ${effectiveLocale} not supported, falling back to en`);
      effectiveLocale = 'en';
    }

    const cacheKey = `${effectiveLocale}:${key}`;
    if (this.translationCache.has(cacheKey)) {
      const cachedTranslation = this.translationCache.get(cacheKey);
      return this.replaceVariables(cachedTranslation, replacements);
    }

    const translation = this.getNestedValue(this.translations[effectiveLocale], key);

    if (translation === undefined && effectiveLocale !== 'en') {
      const fallbackTranslation = this.getNestedValue(this.translations.en, key);

      if (fallbackTranslation !== undefined) {
        console.log(`No ${effectiveLocale} translation for ${key}, using English fallback`);
        return this.replaceVariables(fallbackTranslation, replacements);
      }
    }

    if (translation === undefined) {
      console.warn(`No translation found for key: ${key}`);
      return key;
    }

    this.translationCache.set(cacheKey, translation);

    return this.replaceVariables(translation, replacements);
  }

  getTranslationGroup(groupKey, locale = null) {
    const effectiveLocale = locale || this.currentLocale;

    const group = this.getNestedValue(this.translations[effectiveLocale], groupKey);

    if (!group || typeof group !== 'object') {
      console.warn(`No translation group found for: ${groupKey}`);
      return {};
    }

    return group;
  }

  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    return current;
  }

  replaceVariables(text, replacements) {
    if (!replacements || typeof replacements !== 'object' || !text) {
      return text;
    }

    let result = text;

    for (const [key, value] of Object.entries(replacements)) {
      if (value === undefined) continue;

      const stringValue = String(value);

      const doublePattern = `{{${key}}}`;
      result = result.replace(new RegExp(doublePattern, 'g'), stringValue);

      const singlePattern = `{${key}}`;
      result = result.replace(new RegExp(singlePattern, 'g'), stringValue);
    }

    return result;
  }

  addTranslation(locale, key, value, save = false) {
    if (!this.supportedLocales.includes(locale)) {
      console.error(`Cannot add translation for unsupported locale: ${locale}`);
      return;
    }

    const parts = key.split('.');
    let current = this.translations[locale];

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;

    this.translationCache.delete(`${locale}:${key}`);

    if (save) {
      this.saveTranslations(locale);
    }
  }

  registerLocalizations(category, name, localizations, save = false) {
    if (!localizations || typeof localizations !== 'object') {
      console.warn(`Invalid localizations for ${category}.${name}`);
      return;
    }

    console.log(`Registering localizations for ${category}.${name}`, Object.keys(localizations));

    for (const key in localizations) {
      const value = localizations[key];

      if (typeof value === 'object' && value !== null) {
        const isLocaleMap = this.supportedLocales.some(locale => locale in value);

        if (isLocaleMap) {
          for (const locale in value) {
            if (this.supportedLocales.includes(locale)) {
              const translationKey = `${category}.${name}.${key}`;
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          this.registerNestedLocalizations(category, `${name}.${key}`, value, save);
        }
      }
    }

    if (save) {
      for (const locale of this.supportedLocales) {
        this.saveTranslations(locale);
      }
    }
  }

  registerNestedLocalizations(category, path, obj, save) {
    for (const key in obj) {
      const value = obj[key];

      if (typeof value === 'object' && value !== null) {
        const isLocaleMap = this.supportedLocales.some(locale => locale in value);

        if (isLocaleMap) {
          for (const locale in value) {
            if (this.supportedLocales.includes(locale)) {
              const translationKey = path ? `${category}.${path}.${key}` : `${category}.${key}`;
              this.addTranslation(locale, translationKey, value[locale]);
            }
          }
        } else {
          const nextPath = path ? `${path}.${key}` : key;
          this.registerNestedLocalizations(category, nextPath, value, save);
        }
      }
    }
  }

  clearCache() {
    this.translationCache.clear();
  }

  saveAllTranslations() {
    console.log(`Attempting to save translations for locales: ${this.supportedLocales.join(', ')}`);
    for (const locale of this.supportedLocales) {
      this.saveTranslations(locale);
    }
  }

  debugTranslations(key) {
    console.log(`\n=== DEBUG TRANSLATIONS FOR KEY: ${key} ===`);

    for (const locale of this.supportedLocales) {
      const translation = this.getNestedValue(this.translations[locale], key);

      if (translation !== undefined) {
        if (typeof translation === 'object') {
          console.log(`${locale} (object):`, JSON.stringify(translation, null, 2));
        } else {
          console.log(`${locale}: "${translation}"`);
        }
      } else {
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

export default i18n;