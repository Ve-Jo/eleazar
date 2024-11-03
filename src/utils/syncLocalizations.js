import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "./i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function syncLocalizations(commandPath) {
  try {
    const localesDir = path.join(__dirname, "../locales");
    const commandModule = await import(commandPath);

    if (!commandModule.default?.localization_strings) return;

    // Get the command category and name
    const pathParts = commandPath.split(path.sep);
    const categoryIndex = pathParts.indexOf("cmds");
    if (categoryIndex === -1) return;

    const category = pathParts[categoryIndex + 1];
    const commandName = path.basename(commandPath, ".js");

    // For each supported locale
    const locales = ["en", "ru", "uk"];
    for (const locale of locales) {
      const localeFile = path.join(localesDir, `${locale}.json`);
      let localeData = {};

      // Read existing locale file or create new one
      try {
        const content = await fs.readFile(localeFile, "utf8");
        localeData = JSON.parse(content);
      } catch (err) {
        // File doesn't exist or is empty, create new structure
        console.log(`Creating new locale file for ${locale}`);
      }

      // Initialize category if it doesn't exist
      if (!localeData[category]) {
        localeData[category] = {};
      }

      function syncNestedTranslations(source, target, parentKey = "") {
        for (const [key, value] of Object.entries(source)) {
          const currentKey = parentKey ? `${parentKey}.${key}` : key;

          if (value && typeof value === "object" && !Array.isArray(value)) {
            if (value[locale]) {
              // If it has direct translations, use them immediately
              target[key] = value[locale];
            } else {
              // If it's a nested structure
              target[key] = target[key] || {};
              syncNestedTranslations(value, target[key], currentKey);
            }
          }
        }
      }

      // If it's an index file, sync directly to category
      if (commandName === "index") {
        syncNestedTranslations(
          commandModule.default.localization_strings,
          localeData[category]
        );
      } else {
        // For subcommands, sync to category.commandName
        localeData[category][commandName] =
          localeData[category][commandName] || {};
        syncNestedTranslations(
          commandModule.default.localization_strings,
          localeData[category][commandName]
        );
      }

      // Write updated locale file
      await fs.writeFile(
        localeFile,
        JSON.stringify(localeData, null, 2),
        "utf8"
      );

      console.log(`Synced localizations for ${locale} in ${commandPath}`);
    }
  } catch (error) {
    console.error("Error syncing localizations:", error);
  }
}
