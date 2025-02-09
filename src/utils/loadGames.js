import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const gamesCache = new Map();
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load available games from the games directory
 * @param {object} i18n - i18n instance for localization
 * @returns {Map} Map of games with their data
 */
export async function loadGames(i18n) {
  // First check if we have cached games
  if (gamesCache.has("games")) {
    return gamesCache.get("games");
  }

  try {
    // Get available games using correct path resolution
    const gamesDir = join(__dirname, "..", "games");
    console.log("Loading games from directory:", gamesDir);
    const gameFiles = readdirSync(gamesDir).filter((file) =>
      file.endsWith(".js")
    );
    console.log("Found game files:", gameFiles);

    // Import and process each game
    const gameModules = await Promise.all(
      gameFiles.map(async (file) => {
        try {
          console.log("Importing game module:", file);
          // Use proper path for imports
          const gameModule = await import(join(gamesDir, file));
          if (!gameModule.default) {
            console.error(`Game module ${file} has no default export`);
            return null;
          }
          const game = gameModule.default;
          if (!game.id || !game.title || !game.emoji) {
            console.error(
              `Game module ${file} is missing required properties:`,
              {
                id: game.id,
                title: game.title,
                emoji: game.emoji,
              }
            );
            return null;
          }
          const gameData = {
            id: game.id,
            title:
              game.localization_strings?.name?.[i18n.getLocale()] || game.title,
            emoji: game.emoji,
          };
          console.log("Successfully loaded game:", gameData);
          return gameData;
        } catch (error) {
          console.error(`Error loading game module ${file}:`, error);
          return null;
        }
      })
    );

    // Create games map
    const games = new Map();
    for (const game of gameModules.filter(Boolean)) {
      if (game) {
        games.set(game.id, game);
      }
    }

    console.log("Final games map:", Array.from(games.entries()));

    // Cache games globally
    gamesCache.set("games", games);

    // Add cache invalidation after 5 minutes
    setTimeout(() => {
      gamesCache.delete("games");
    }, 5 * 60 * 1000);

    return games;
  } catch (error) {
    console.error("Error loading games:", error);
    return new Map();
  }
}

/**
 * Clear games cache
 */
export function clearGamesCache() {
  gamesCache.clear();
}
