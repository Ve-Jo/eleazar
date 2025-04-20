import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const gamesCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Default i18n object (basic fallback) ---
const defaultI18n = {
  getLocale: () => "en",
  __: (key) => key, // Return the key itself
  registerLocalizations: () => {},
  has: (key) => false, // Add missing 'has' method to default i18n
};
// --------------------------------------------

/**
 * Load all games from the games directory, including ported legacy games.
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
    // Directories to scan for games
    const gameDirs = [
      path.join(__dirname, "../games"),
      path.join(__dirname, "../games/risky"), // Add risky directory
      path.join(__dirname, "../games/ported"), // Add ported directory
    ];

    // Create games map
    const games = new Map();

    // Load games from each directory
    for (const gamesDir of gameDirs) {
      if (!fs.existsSync(gamesDir)) {
        console.warn(`[loadGames] Directory not found: ${gamesDir}`);
        continue; // Skip if directory doesn't exist
      }

      const gameFiles = fs
        .readdirSync(gamesDir)
        .filter((file) => file.endsWith(".js"));

      for (const file of gameFiles) {
        const gameId = file.replace(".js", "");
        const gamePath = path.join(gamesDir, file);
        const relativePath = path.relative(
          path.join(__dirname, ".."),
          gamePath
        ); // Get path relative to src

        // Avoid duplicates if a game exists in both dirs (though unlikely)
        if (games.has(gameId)) continue;

        try {
          // Import game module using the full path
          const gameModule = await import(gamePath);

          // Set up basic game info
          const gameData = {
            id: gameId,
            title: gameId, // Default title
            emoji: "🎮", // Default emoji
            file: relativePath, // Store relative path
            isLegacy: false, // Default legacy status
          };

          if (gameModule.default) {
            // Update with data from module
            gameData.title =
              gameModule.default.title ||
              gameModule.default?.game_info?.name ||
              gameId;
            gameData.emoji =
              gameModule.default.emoji ||
              gameModule.default?.game_info?.emoji ||
              "🎮";
            gameData.isLegacy = gameModule.default.isLegacy || false;
            gameData.description =
              gameModule.default.description ||
              gameModule.default?.game_info?.description ||
              "";

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
              const localizedTitleKey = `games.${gameId}.name`;
              if (
                gameModule.default.localization_strings.name &&
                typeof i18n.has === "function" &&
                i18n.has(localizedTitleKey)
              ) {
                gameData.title = i18n.__(localizedTitleKey);
              }
              // Get localized description if available
              const localizedDescKey = `games.${gameId}.description`;
              if (
                gameModule.default.localization_strings.description &&
                typeof i18n.has === "function" &&
                i18n.has(localizedDescKey)
              ) {
                gameData.description = i18n.__(localizedDescKey);
              }
            }
            // Attempt to use game_info if localization_strings not present
            else if (gameModule.default.game_info) {
              gameData.title = gameModule.default.game_info.name || gameId;
              gameData.emoji = gameModule.default.game_info.emoji || "🎮";
              gameData.description =
                gameModule.default.game_info.description || "";
            }
          }

          // Add to games map
          games.set(gameId, gameData);
          console.log(
            `[loadGames] Loaded game: ${gameId} (Legacy: ${gameData.isLegacy})`
          );
        } catch (error) {
          console.error(
            `Error loading game ${gameId} from ${gamePath}:`,
            error
          );
        }
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
 * @returns {Promise<object|null>} The game module or null on error
 */
export async function getGameModule(gameId, i18n) {
  try {
    // Define potential paths
    const possiblePaths = [
      path.join(__dirname, "..", "games", `${gameId}.js`),
      path.join(__dirname, "..", "games", "risky", `${gameId}.js`),
      path.join(__dirname, "..", "games", "ported", `${gameId}.js`),
    ];

    let gamePath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        gamePath = p;
        break;
      }
    }

    // If no path was found
    if (!gamePath) {
      console.error(
        `Game file not found for ${gameId} in checked directories.`
      );
      return null;
    }

    console.log(`[getGameModule] Importing game module from: ${gamePath}`);
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
