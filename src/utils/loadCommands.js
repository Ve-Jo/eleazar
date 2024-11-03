import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Collection } from "discord.js";
import { syncLocalizations } from "./syncLocalizations.js";
import i18n from "./i18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, "..", "cmds");
  let commandFolders = fs.readdirSync(commandsPath);

  // Set default locale before loading commands
  i18n.setLocale("en");

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (!fs.statSync(folderPath).isDirectory()) continue;

    const indexFile = path.join(folderPath, "index.js");
    if (!fs.existsSync(indexFile)) continue;

    try {
      // Sync localizations before loading command if LOCALIZATION_SYNC is true
      if (process.env.LOCALIZATION_SYNC === "true") {
        await syncLocalizations(indexFile);
      }

      // Load the index file first
      const commandIndex = await import(indexFile);
      const command = commandIndex.default;

      // Load all subcommands from the folder
      const subcommands = [];
      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        if (file === "index.js" || !file.endsWith(".js")) continue;

        const subcommandPath = path.join(folderPath, file);

        // Sync localizations for subcommand if LOCALIZATION_SYNC is true
        if (process.env.LOCALIZATION_SYNC === "true") {
          await syncLocalizations(subcommandPath);
        }

        const subcommandModule = await import(subcommandPath);
        if (
          subcommandModule.default?.data &&
          subcommandModule.default?.execute
        ) {
          // If data is a function, call it with i18n
          if (typeof subcommandModule.default.data === "function") {
            try {
              subcommandModule.default.data =
                subcommandModule.default.data(i18n);
            } catch (error) {
              console.error(
                `Error building subcommand data for ${file}:`,
                error
              );
              continue;
            }
          }
          subcommands.push(subcommandModule.default);
        }
      }

      // If command.data is a function, call it with i18n
      if (typeof command.data === "function") {
        try {
          command.data = command.data(i18n);
        } catch (error) {
          console.error(`Error building command data for ${folder}:`, error);
          continue;
        }
      }

      // Add subcommands to the command builder
      for (const subcommand of subcommands) {
        command.data.addSubcommand(subcommand.data);
      }

      // Store subcommands in a map for easy access
      command.subcommands = {};
      for (const subcommand of subcommands) {
        command.subcommands[subcommand.data.name] = subcommand;
      }

      // Register the command
      client.commands.set(command.data.name, command);
      console.log(
        `Loaded ${command.server ? "server" : "global"} command: ${
          command.data.name
        } with ${subcommands.length} subcommands`
      );
    } catch (error) {
      console.error(`Error loading command from ${folder}:`, error);
    }
  }
}
