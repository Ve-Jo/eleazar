import fs from "fs/promises";
import { promises as fsPromises } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "./i18n.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function for finding game files
async function findGameFiles() {
  try {
    const gamesPath = path.join(__dirname, "../games");
    const files = await fsPromises.readdir(gamesPath);
    return files
      .filter((file) => file.endsWith(".js"))
      .map((file) => path.join(gamesPath, file));
  } catch (error) {
    console.error("Error finding game files:", error);
    return [];
  }
}

// Helper function for finding component files
async function findComponentFiles() {
  try {
    const componentsPath = path.join(__dirname, "../render-server/components");
    const files = await fsPromises.readdir(componentsPath);
    return files
      .filter((file) => file.endsWith(".jsx"))
      .map((file) => path.join(componentsPath, file));
  } catch (error) {
    console.error("Error finding component files:", error);
    return [];
  }
}

// Helper function for finding command files recursively
async function findCommandFiles() {
  const results = [];
  try {
    const commandsPath = path.join(__dirname, "../cmds");
    const categories = await fsPromises.readdir(commandsPath);

    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      const stats = await fsPromises.stat(categoryPath);

      if (stats.isDirectory()) {
        const files = await fsPromises.readdir(categoryPath);
        const jsFiles = files
          .filter((file) => file.endsWith(".js"))
          .map((file) => path.join(categoryPath, file));
        results.push(...jsFiles);
      }
    }
  } catch (error) {
    console.error("Error finding command files:", error);
  }
  return results;
}

// Helper function for syncing nested translations
function syncNestedTranslations(source, target, locale, parentKey = "") {
  for (const [key, value] of Object.entries(source)) {
    const currentKey = parentKey ? `${parentKey}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value[locale]) {
        // If it has direct translations, use them immediately
        target[key] = value[locale];
      } else {
        // If it's a nested structure
        target[key] = target[key] || {};
        syncNestedTranslations(value, target[key], locale, currentKey);
      }
    }
  }
}

// Main function to sync a single file's localizations
export async function syncLocalizations(filePath) {
  try {
    const localesDir = path.join(__dirname, "../locales");
    const moduleToSync = await import(filePath);

    if (!moduleToSync.default?.localization_strings) return;

    // Get the path parts to determine category and name
    const pathParts = filePath.split(path.sep);

    // Determine category and name based on file path
    let category;
    let itemName;

    // Check if it's a command, component, or game
    if (pathParts.includes("cmds")) {
      const categoryIndex = pathParts.indexOf("cmds");
      if (categoryIndex === -1) return;
      category = pathParts[categoryIndex + 1];
      itemName = path.basename(filePath, path.extname(filePath));
    } else if (
      pathParts.includes("render-server") &&
      pathParts.includes("components")
    ) {
      category = "components";
      itemName = path.basename(filePath, path.extname(filePath));
    } else if (pathParts.includes("games")) {
      category = "games";
      itemName = path.basename(filePath, path.extname(filePath));
    } else {
      return; // Not a command, component, or game
    }

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

      // If it's an index file, sync directly to category
      if (itemName === "index") {
        syncNestedTranslations(
          moduleToSync.default.localization_strings,
          localeData[category],
          locale
        );
      } else {
        // For subcommands/components, sync to category.itemName
        localeData[category][itemName] = localeData[category][itemName] || {};

        // Handle shared translations between components and commands
        if (category === "components" && itemName === "GameLauncher") {
          // Also sync relevant translations to economy.work for backwards compatibility
          if (!localeData.economy) localeData.economy = {};
          if (!localeData.economy.work) localeData.economy.work = {};

          // Sync specific shared translations
          if (moduleToSync.default.localization_strings.specialForCategory) {
            const specialForCategory =
              moduleToSync.default.localization_strings.specialForCategory[
                locale
              ];
            if (specialForCategory) {
              if (!localeData.economy.work) localeData.economy.work = {};
              localeData.economy.work.specialForCategory = specialForCategory;
            }
          }
        }

        // Sync translations to the component's location
        syncNestedTranslations(
          moduleToSync.default.localization_strings,
          localeData[category][itemName],
          locale
        );
      }

      // Write updated locale file
      await fs.writeFile(
        localeFile,
        JSON.stringify(localeData, null, 2),
        "utf8"
      );

      console.log(`Synced localizations for ${locale} in ${filePath}`);
    }
  } catch (error) {
    console.error("Error syncing localizations:", error);
  }
}

// Function to sync all localizations (both commands and components)
export async function syncAllLocalizations() {
  console.log("Finding files to synchronize...");

  // Get all files that need syncing
  const [commandFiles, componentFiles, gameFiles] = await Promise.all([
    findCommandFiles(),
    findComponentFiles(),
    findGameFiles(),
  ]);

  console.log(
    `Found ${commandFiles.length} command files, ${componentFiles.length} component files, and ${gameFiles.length} game files`
  );

  // Sync all files
  const allFiles = [...commandFiles, ...componentFiles, ...gameFiles];
  for (const file of allFiles) {
    await syncLocalizations(file);
  }

  console.log("Finished synchronizing all localizations");
}

// Run if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncAllLocalizations().catch(console.error);
}
