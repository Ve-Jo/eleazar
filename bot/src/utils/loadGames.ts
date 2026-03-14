import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import hubClient from "../api/hubClient.ts";

type GameInfoShape = {
  name?: string;
  emoji?: string;
  description?: string;
};

type GameModuleDefault = {
  title?: string;
  emoji?: string;
  isLegacy?: boolean;
  description?: string;
  game_info?: GameInfoShape;
  localization_strings?: Record<string, unknown>;
  [key: string]: unknown;
};

type LoadedGameData = {
  id: string;
  title: string;
  emoji: string;
  file: string;
  isLegacy: boolean;
  description?: string;
};

type GameModuleImport = {
  default?: GameModuleDefault;
};

const gamesCache = new Map<string, LoadedGameData>();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPreferredGameFiles = (gamesDir: string): string[] => {
  const gameFiles = fs
    .readdirSync(gamesDir)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  const preferredFiles = new Map<string, string>();

  for (const file of gameFiles) {
    const extension = path.extname(file);
    const baseName = path.basename(file, extension);
    const existing = preferredFiles.get(baseName);

    if (!existing || extension === ".ts") {
      preferredFiles.set(baseName, file);
    }
  }

  return Array.from(preferredFiles.values());
};

async function loadGames(): Promise<Map<string, LoadedGameData>> {
  if (gamesCache.size > 0) {
    console.log("[loadGames] Using cached games");
    return new Map(gamesCache);
  }

  console.log("[loadGames] Loading games");
  const games = new Map<string, LoadedGameData>();

  try {
    const gameDirs = [
      path.join(__dirname, "../games"),
      path.join(__dirname, "../games/risky"),
      path.join(__dirname, "../games/ported"),
    ];

    for (const gamesDir of gameDirs) {
      if (!fs.existsSync(gamesDir)) {
        continue;
      }

      const gameFiles = getPreferredGameFiles(gamesDir);

      for (const file of gameFiles) {
        const gameId = path.basename(file, path.extname(file));
        if (games.has(gameId)) {
          continue;
        }

        const gamePath = path.join(gamesDir, file);
        const relativePath = path.relative(path.join(__dirname, ".."), gamePath);

        try {
          const gameModule = (await import(gamePath)) as GameModuleImport;
          const gameData: LoadedGameData = {
            id: gameId,
            title: gameId,
            emoji: "🎮",
            file: relativePath,
            isLegacy: false,
          };

          if (gameModule.default) {
            gameData.title =
              gameModule.default.title || gameModule.default.game_info?.name || gameId;
            gameData.emoji =
              gameModule.default.emoji || gameModule.default.game_info?.emoji || "🎮";
            gameData.isLegacy = gameModule.default.isLegacy || false;
            gameData.description =
              gameModule.default.description || gameModule.default.game_info?.description || "";

            if (gameModule.default.localization_strings) {
              hubClient.registerLocalizations(
                "games",
                gameId,
                gameModule.default.localization_strings
              );
              const localizedName = await hubClient.getTranslation(
                `games.${gameId}.name`
              );
              const localizedDescription = await hubClient.getTranslation(
                `games.${gameId}.description`
              );
              gameData.title =
                localizedName.translation ||
                gameData.title;
              gameData.description =
                localizedDescription.translation || gameData.description;
            } else if (gameModule.default.game_info) {
              gameData.title = gameModule.default.game_info.name || gameId;
              gameData.emoji = gameModule.default.game_info.emoji || "🎮";
              gameData.description = gameModule.default.game_info.description || "";
            }
          }

          games.set(gameId, gameData);
          console.log(`[loadGames] Loaded game: ${gameId} (Legacy: ${gameData.isLegacy})`);
        } catch (error) {
          console.error(`Error loading game ${gameId} from ${gamePath}:`, error);
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

async function getGameModule(gameId: string): Promise<GameModuleDefault | null> {
  try {
    const possiblePaths = [
      path.join(__dirname, "..", "games", `${gameId}.ts`),
      path.join(__dirname, "..", "games", `${gameId}.js`),
      path.join(__dirname, "..", "games", "risky", `${gameId}.ts`),
      path.join(__dirname, "..", "games", "risky", `${gameId}.js`),
      path.join(__dirname, "..", "games", "ported", `${gameId}.ts`),
      path.join(__dirname, "..", "games", "ported", `${gameId}.js`),
    ];

    let gamePath: string | null = null;
    for (const candidatePath of possiblePaths) {
      if (fs.existsSync(candidatePath)) {
        gamePath = candidatePath;
        break;
      }
    }

    if (!gamePath) {
      console.error(`Game file not found for ${gameId} in checked directories.`);
      return null;
    }

    console.log(`[getGameModule] Importing game module from: ${gamePath}`);
    const gameModule = (await import(gamePath)) as GameModuleImport;
    if (!gameModule.default) {
      console.error(`Invalid game module format for ${gameId}`);
      return null;
    }

    if (gameModule.default.localization_strings) {
      hubClient.registerLocalizations(
        "games",
        gameId,
        gameModule.default.localization_strings
      );
    }

    return gameModule.default;
  } catch (error) {
    console.error(`Error getting game module for ${gameId}:`, error);
    return null;
  }
}

function clearGamesCache(): void {
  gamesCache.clear();
}

export { loadGames, getGameModule, clearGamesCache };
