import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { Collection } from "discord.js";
import { syncAllLocalizations } from "./syncLocalizations.js";
import i18n from "./i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadGames() {
  const games = new Collection();
  const gamesPath = path.join(__dirname, "../games");

  // Set default locale before loading games
  i18n.setLocale("en");

  // Sync all localizations if LOCALIZATION_SYNC is true
  if (process.env.LOCALIZATION_SYNC === "true") {
    await syncAllLocalizations();
  }

  try {
    const gameFiles = await fs.readdir(gamesPath);

    for (const file of gameFiles) {
      if (!file.endsWith(".js")) continue;

      const gamePath = path.join(gamesPath, file);
      const gameModule = await import(gamePath);

      if (gameModule.default) {
        const game = gameModule.default;

        // If game.data is a function, call it with i18n
        if (typeof game.data === "function") {
          try {
            game.data = game.data(i18n);
          } catch (error) {
            console.error(`Error building game data for ${file}:`, error);
            continue;
          }
        }

        // Add game to collection
        games.set(game.id || path.basename(file, ".js"), game);
        console.log(`Loaded game: ${game.id || path.basename(file, ".js")}`);
      }
    }
  } catch (error) {
    console.error("Error loading games:", error);
  }

  return games;
}
