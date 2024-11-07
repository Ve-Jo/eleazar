import { SlashCommand } from "./SlashCommand.js";
import i18n from "../i18n.js";

export class I18nCommandBuilder {
  constructor(category, name = "") {
    this.category = category;
    this.name = name;
    this.translationPath = name ? `${category}.${name}` : category;
  }

  createCommand() {
    const command = new SlashCommand({
      name: this.getSimpleName(this.translate("name")) || this.category,
      description: this.translate("description") || "No description provided",
      description_localizations: this.getLocalizations("description", false),
      name_localizations: this.getLocalizations("name", true),
    });

    return command;
  }

  translate(key, locale) {
    try {
      const fullPath = key.includes(".")
        ? key
        : `${this.translationPath}.${key}`;

      const translation = locale
        ? i18n.__({ phrase: fullPath, locale })
        : i18n.__(fullPath);

      if (!translation || translation === fullPath) {
        console.warn(`Warning: Missing translation for key: ${fullPath}`);
        return key.split(".").pop();
      }

      return translation;
    } catch (error) {
      console.error(
        `Translation error for ${this.translationPath}.${key}:`,
        error
      );
      return key.split(".").pop();
    }
  }

  getLocalizations(key, simplify = false) {
    return {
      ru: simplify
        ? this.getSimpleName(this.translate(key, "ru") || this.category)
        : this.translate(key, "ru"),
      uk: simplify
        ? this.getSimpleName(this.translate(key, "uk") || this.category)
        : this.translate(key, "uk"),
    };
  }

  getSimpleName(name) {
    if (!name) {
      console.warn(`Warning: Empty name provided to getSimpleName`);
      return this.category; /*.toLowerCase().slice(0, 32);*/
    }

    const simplified = name; /*.toLowerCase().slice(0, 32);*/
    return simplified;
  }

  translateOption(optionKey, type = "name", locale = null) {
    try {
      const fullPath = `${this.translationPath}.options.${optionKey}.${type}`;
      let translation = locale
        ? i18n.__({ phrase: fullPath, locale })
        : i18n.__(fullPath);

      if (!translation || translation === fullPath) {
        const shortPath = `options.${optionKey}.${type}`;
        translation = locale
          ? i18n.__({ phrase: shortPath, locale })
          : i18n.__(shortPath);
      }

      if (!translation || translation.includes("options.")) {
        console.warn(
          `Warning: Translation might be missing for option: ${fullPath}`
        );
        return optionKey;
      }

      return type === "name" ? this.getSimpleName(translation) : translation;
    } catch (error) {
      console.error(`Option translation error:`, error);
      return optionKey;
    }
  }

  getOptionLocalizations(optionKey, type = "name") {
    const localizations = {
      ru: this.translateOption(optionKey, type, "ru"),
      uk: this.translateOption(optionKey, type, "uk"),
    };
    return localizations;
  }
}
