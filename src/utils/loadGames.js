import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import i18n from "./newI18n.js";

const gamesCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a context-specific i18n instance for a game
 * @param {string} gameId - The game ID
 * @param {string} locale - The locale to use
 * @returns {object} - Context-specific i18n instance
 */
export function createGameI18n(gameId, locale = null) {
  const currentLocale = locale || i18n.getLocale();
  return i18n.createContextI18n("games", gameId, currentLocale);
}

/**
 * Load all games from the games directory
 * @returns {Map} Map of games with their data
 */
export function loadGames() {
  const currentLocale = i18n.getLocale();
  console.log(`[loadGames] Loading games for locale ${currentLocale}`);

  // First check if we have cached games for this locale
  const cacheKey = `games_${currentLocale}`;
  if (gamesCache.has(cacheKey)) {
    console.log(`[loadGames] Using cached games for locale ${currentLocale}`);
    return gamesCache.get(cacheKey);
  }

  try {
    // Get all game files
    const gamesDir = path.join(__dirname, "../games");
    const gameFiles = fs
      .readdirSync(gamesDir)
      .filter((file) => file.endsWith(".js"));

    // Create games map
    const games = new Map();

    // Load each game
    for (const file of gameFiles) {
      const gameId = file.replace(".js", "");

      try {
        // Import game module
        const gameModule = import(`../games/${gameId}.js`);

        // Set up basic game info
        const gameData = {
          id: gameId,
          title: gameId, // Default title
          emoji: "🎮", // Default emoji
          file: file,
        };

        // Process imported module when available
        gameModule
          .then((module) => {
            if (module.default) {
              // Update with data from module
              gameData.title = module.default.title || gameId;
              gameData.emoji = module.default.emoji || "🎮";

              // Register localizations if available
              if (module.default.localization_strings) {
                i18n.registerLocalizations(
                  "games",
                  gameId,
                  module.default.localization_strings,
                  false
                );

                // Get localized title if available
                const gameI18n = createGameI18n(gameId, currentLocale);
                if (module.default.localization_strings.name) {
                  const localizedTitle = gameI18n.__("name");
                  if (localizedTitle !== "name") {
                    gameData.title = localizedTitle;
                  }
                }
              }
            }
          })
          .catch((error) => {
            console.error(`Error processing game module ${gameId}:`, error);
          });

        // Add to games map
        games.set(gameId, gameData);
      } catch (error) {
        console.error(`Error loading game ${gameId}:`, error);
      }
    }

    // Cache results
    gamesCache.set(cacheKey, games);

    return games;
  } catch (error) {
    console.error("[loadGames] Error loading games:", error);
    return new Map();
  }
}

/**
 * Clear games cache
 */
export function clearGamesCache() {
  gamesCache.clear();
}

/**
 * Get a specific game module with context-specific i18n
 * @param {string} gameId - The game ID to load
 * @param {string} locale - The locale to use (optional)
 * @returns {Promise<object>} The game module with context-specific i18n
 */
export async function getGameModule(gameId, locale = null) {
  try {
    const gamePath = path.join(__dirname, "..", "games", `${gameId}.js`);
    const gameModule = await import(gamePath);

    // If no game module or invalid format, return null
    if (!gameModule.default) {
      console.error(`Invalid game module format for ${gameId}`);
      return null;
    }

    // Register localizations if available
    if (gameModule.default.localization_strings) {
      i18n.registerLocalizations(
        "games",
        gameId,
        gameModule.default.localization_strings,
        false
      );
    }

    // Create context-specific i18n for the game
    const currentLocale = locale || i18n.getLocale();
    gameModule.default.i18n = createGameI18n(gameId, currentLocale);

    return gameModule;
  } catch (error) {
    console.error(`Error loading game module ${gameId}:`, error);
    return null;
  }
}
