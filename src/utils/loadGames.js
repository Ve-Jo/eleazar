import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const gamesCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all games from the games directory
 * @param {object} i18n - The i18n instance to use
 * @returns {Map} Map of games with their data
 */
export async function loadGames(i18n = defaultI18n) {
  const currentLocale = i18n.getLocale();
  console.log(`[loadGames] Loading games for locale ${currentLocale}`);

  // First check if we have cached games for this locale
  /*const cacheKey = `games_${currentLocale}`;
  if (gamesCache.has(cacheKey)) {
    console.log(`[loadGames] Using cached games for locale ${currentLocale}`);
    return gamesCache.get(cacheKey);
  }*/

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
        const gameModule = await import(`../games/${gameId}.js`);

        // Set up basic game info
        const gameData = {
          id: gameId,
          title: gameId, // Default title
          emoji: "🎮", // Default emoji
          file: file,
        };

        if (gameModule.default) {
          // Update with data from module
          gameData.title = gameModule.default.title || gameId;
          gameData.emoji = gameModule.default.emoji || "🎮";

          // Register localizations if available
          if (
            gameModule.default.localization_strings &&
            i18n &&
            typeof i18n.registerLocalizations === "function"
          ) {
            i18n.registerLocalizations(
              "games",
              gameId,
              gameModule.default.localization_strings
            );

            // Get localized title if available
            if (gameModule.default.localization_strings.name) {
              const localizedTitle = i18n.__(`games.${gameId}.name`);
              if (localizedTitle !== "name") {
                gameData.title = localizedTitle;
              }
            }
          }
        }

        // Add to games map
        games.set(gameId, gameData);
      } catch (error) {
        console.error(`Error loading game ${gameId}:`, error);
      }
    }

    /*gamesCache.set(cacheKey, games);*/

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
 * Get a specific game module
 * @param {string} gameId - The game ID to load
 * @param {object} i18n - The i18n instance to use
 * @returns {Promise<object>} The game module
 */
export async function getGameModule(gameId, i18n) {
  try {
    const gamePath = path.join(__dirname, "..", "games", `${gameId}.js`);
    const gameModule = await import(gamePath);

    // If no game module or invalid format, return null
    if (!gameModule.default) {
      console.error(`Invalid game module format for ${gameId}`);
      return null;
    }

    // Register localizations if available
    if (
      gameModule.default.localization_strings &&
      i18n &&
      typeof i18n.registerLocalizations === "function"
    ) {
      i18n.registerLocalizations(
        "games",
        gameId,
        gameModule.default.localization_strings
      );
    }

    return gameModule;
  } catch (error) {
    console.error(`Error loading game module ${gameId}:`, error);
    return null;
  }
}
