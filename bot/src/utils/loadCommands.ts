import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Collection } from "discord.js";
import hubClient from "../api/hubClient.ts";

type CommandLocalizationStrings = {
  command?: unknown;
  [key: string]: unknown;
};

type CommandDataShape = {
  name?: string;
  addSubcommand?: (subcommand: unknown) => unknown;
};

type CommandModuleShape = {
  data?: CommandDataShape | (() => CommandDataShape);
  execute?: (...args: unknown[]) => unknown;
  localization_strings?: CommandLocalizationStrings;
  subcommands?: Record<string, CommandModuleShape>;
};

type CommandImportShape = {
  default?: CommandModuleShape;
};

type ClientWithCommands = {
  commands: Collection<string, CommandModuleShape>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolvePreferredModulePath = (
  directoryPath: string,
  baseName: string
): string | null => {
  const tsPath = path.join(directoryPath, `${baseName}.ts`);
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  const jsPath = path.join(directoryPath, `${baseName}.js`);
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }

  return null;
};

const getPreferredSubcommandFiles = (categoryPath: string): string[] => {
  const subcommandFiles = fs
    .readdirSync(categoryPath)
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".js")) &&
        !["index.js", "index.ts"].includes(file)
    );

  const preferredFiles = new Map<string, string>();

  for (const file of subcommandFiles) {
    const extension = path.extname(file);
    const baseName = path.basename(file, extension);
    const existing = preferredFiles.get(baseName);

    if (!existing || extension === ".ts") {
      preferredFiles.set(baseName, file);
    }
  }

  return Array.from(preferredFiles.values());
};

async function loadCommands(
  client: ClientWithCommands,
  categories: string[] = [
    "economy",
    "emotions",
    "filters",
    "help",
    "images",
    "ai",
    "music",
    "counting",
    "marriage",
    "settings",
    "personalization",
  ]
): Promise<void> {
  console.log(
    `Loading commands for categories: ${categories.length ? categories.join(", ") : "all"}`
  );

  client.commands = new Collection<string, CommandModuleShape>();

  try {
    const commandsPath = path.join(__dirname, "..", "cmds");
    let resolvedCategories = categories;

    if (!resolvedCategories.length) {
      resolvedCategories = fs
        .readdirSync(commandsPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
      console.log(`Found categories: ${resolvedCategories.join(", ")}`);
    }

    for (const category of resolvedCategories) {
      const categoryPath = path.join(commandsPath, category);

      if (!fs.existsSync(categoryPath)) {
        console.error(`Category directory not found at ${categoryPath}`);
        continue;
      }

      console.log(`Loading commands from category: ${category}`);

      const indexPath = resolvePreferredModulePath(categoryPath, "index");
      if (!indexPath) {
        console.error(`Index file not found in ${categoryPath}`);
        continue;
      }
      if (!fs.existsSync(indexPath)) {
        console.error(`Index file not found at ${indexPath}`);
        continue;
      }

      console.log(`Loading main command from ${indexPath}`);
      const commandModule = (await import(indexPath)) as CommandImportShape;

      if (!commandModule.default?.data) {
        console.error(`Command is missing data property in ${indexPath}`);
        continue;
      }

      const command = commandModule.default;
      let commandData: CommandDataShape;

      if (typeof command.data === "function") {
        try {
          commandData = command.data();
          command.data = commandData;
        } catch (error) {
          console.error(`Error building command data for ${category}:`, error);
          continue;
        }
      } else {
        if (!command.data) {
          console.error(`Command is missing concrete data in ${indexPath}`);
          continue;
        }
        commandData = command.data;
      }

      if (command.localization_strings && commandData.name) {
        console.log(`Registering localizations for ${category}.${commandData.name}`);

        hubClient.registerLocalizations(
          "commands",
          commandData.name,
          command.localization_strings
        );
      }

      const subcommandFiles = getPreferredSubcommandFiles(categoryPath);

      console.log(
        `Found ${subcommandFiles.length} subcommands in ${category} category`
      );

      if (!command.subcommands) {
        command.subcommands = {};
      }

      for (const subcommandFile of subcommandFiles) {
        const subcommandPath = path.join(categoryPath, subcommandFile);
        console.log(`Loading subcommand from ${subcommandPath}`);

        try {
          const subcommandModule = (await import(subcommandPath)) as CommandImportShape;
          const loadedSubcommand = subcommandModule.default;

          if (loadedSubcommand?.data && loadedSubcommand?.execute) {
            const subcommandName = path.basename(
              subcommandFile,
              path.extname(subcommandFile)
            );

            if (typeof commandData.addSubcommand === "function") {
              commandData.addSubcommand(loadedSubcommand.data);
            }

            if (loadedSubcommand.localization_strings && commandData.name) {
              if (!loadedSubcommand.localization_strings.command) {
                console.error(
                  `Subcommand ${subcommandName} is missing localization strings`
                );
                console.log(loadedSubcommand.localization_strings);
                console.log(JSON.stringify(subcommandModule.default, null, 2));
              }

              hubClient.registerLocalizations(
                "commands",
                `${commandData.name}.${subcommandName}`,
                loadedSubcommand.localization_strings
              );
              console.log(
                `Registered localizations for ${commandData.name}.${subcommandName}`
              );
            }

            command.subcommands[subcommandName] = loadedSubcommand;
            console.log(`Successfully loaded ${subcommandName} subcommand`);
          } else {
            console.error(
              `Subcommand ${subcommandFile} doesn't have required data or execute properties`
            );
          }
        } catch (error) {
          console.error(`Error importing subcommand ${subcommandFile}:`, error);
        }
      }

      client.commands.set(commandData.name || category, command);
      console.log(
        `Successfully loaded ${category} command with ${Object.keys(command.subcommands).length} subcommands`
      );
    }
  } catch (error) {
    console.error("Error loading commands:", error);
  }
}

export { loadCommands };
