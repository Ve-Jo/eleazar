import i18n from "../i18n.js";

export class BaseCommandBuilder {
  constructor(category, name = "") {
    this.category = category;
    this.name = name;
    this.translationPath = category
      ? `${category}${name ? `.${name}` : ""}`
      : name;
  }

  translate(key, locale) {
    const path = `${this.translationPath}.${key}`;
    try {
      return locale ? i18n.__({ phrase: path, locale }) : i18n.__(path);
    } catch (error) {
      console.error(`Translation error for path ${path}:`, error);
      return this.name || this.category || "unknown";
    }
  }

  getLocalizations(key) {
    return {
      ru: this.translate(key, "ru"),
      uk: this.translate(key, "uk"),
    };
  }

  // Helper method to get simple name (for Discord's requirements)
  getSimpleName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 32);
  }
}
