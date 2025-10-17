import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import hubClient from "../api/hubClient.js";

const gamesCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadGames() {
  if (gamesCache.size > 0) {
    console.log(`[loadGames] Using cached games`);
    return new Map(gamesCache);
  }
  console.log(`[loadGames] Loading games`);
  let games = new Map();
  try {
    const gameDirs = [
      path.join(__dirname, "../games"),
      path.join(__dirname, "../games/risky"),
      path.join(__dirname, "../games/ported"),
    ];
    for (const gamesDir of gameDirs) {
      if (!fs.existsSync(gamesDir)) continue;
      const gameFiles = fs
        .readdirSync(gamesDir)
        .filter((file) => file.endsWith(".js"));
      for (const file of gameFiles) {
        const gameId = file.replace(".js", "");
        if (games.has(gameId)) continue;
        const gamePath = path.join(gamesDir, file);
        const relativePath = path.relative(
          path.join(__dirname, ".."),
          gamePath,
        );
        try {
          const gameModule = await import(gamePath);
          const gameData = {
            id: gameId,
            title: gameId,
            emoji: "🎮",
            file: relativePath,
            isLegacy: false,
          };
          if (gameModule.default) {
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
            if (gameModule.default.localization_strings) {
              hubClient.registerLocalizations(
                "games",
                gameId,
                gameModule.default.localization_strings,
              );
              gameData.title =
                (await hubClient.getTranslation(`games.${gameId}.name`)) ||
                gameData.title;
              gameData.description =
                (await hubClient.getTranslation(
                  `games.${gameId}.description`,
                )) || gameData.description;
            } else if (gameModule.default.game_info) {
              gameData.title = gameModule.default.game_info.name || gameId;
              gameData.emoji = gameModule.default.game_info.emoji || "🎮";
              gameData.description =
                gameModule.default.game_info.description || "";
            }
          }
          games.set(gameId, gameData);
          console.log(
            `[loadGames] Loaded game: ${gameId} (Legacy: ${gameData.isLegacy})`,
          );
        } catch (error) {
          console.error(
            `Error loading game ${gameId} from ${gamePath}:`,
            error,
          );
        }
      }
    }
  } catch (error) {
    console.error("[loadGames] Error loading games:", error);
  }
  gamesCache.clear();
  games.forEach((value, key) => gamesCache.set(key, value));
  return new Map(games);
}

export async function getGameModule(gameId) {
  try {
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
    if (!gamePath) {
      console.error(
        `Game file not found for ${gameId} in checked directories.`,
      );
      return null;
    }
    console.log(`[getGameModule] Importing game module from: ${gamePath}`);
    const gameModule = await import(gamePath);
    if (!gameModule.default) {
      console.error(`Invalid game module format for ${gameId}`);
      return null;
    }
    if (gameModule.default.localization_strings) {
      hubClient.registerLocalizations(
        "games",
        gameId,
        gameModule.default.localization_strings,
      );
    }
    return gameModule.default;
  } catch (error) {
    console.error(`Error getting game module for ${gameId}:`, error);
    return null;
  }
}

export function clearGamesCache() {
  gamesCache.clear();
}
