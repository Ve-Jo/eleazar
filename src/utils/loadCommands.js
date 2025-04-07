import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Collection } from "discord.js";
import i18n from "./newI18n.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads commands from specified categories using the new i18n system
 * @param {Object} client - The Discord client
 * @param {Array} categories - Array of category names to load (e.g. ['economy']). If empty, loads all categories.
 */
export async function loadCommands(
  client,
  categories = [
    "economy",
    "emotions",
    "filters",
    "help",
    "images",
    "ai",
    "music",
  ]
) {
  console.log(
    `Loading commands for categories: ${
      categories.length ? categories.join(", ") : "all"
    }`
  );

  // Initialize commands collection
  client.commands = new Collection();

  // Set default locale
  i18n.setLocale("en");

  try {
    const commandsPath = path.join(__dirname, "..", "cmds");

    // Load all categories if none specified
    if (!categories.length) {
      const categoryDirs = fs
        .readdirSync(commandsPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
      categories = categoryDirs;
      console.log(`Found categories: ${categories.join(", ")}`);
    }

    // Process each requested category
    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);

      // Check if the category directory exists
      if (!fs.existsSync(categoryPath)) {
        console.error(`Category directory not found at ${categoryPath}`);
        continue;
      }

      console.log(`Loading commands from category: ${category}`);

      // Load the index.js (main category command)
      const indexPath = path.join(categoryPath, "index.js");
      if (!fs.existsSync(indexPath)) {
        console.error(`Index file not found at ${indexPath}`);
        continue;
      }

      // Import the main command module
      console.log(`Loading main command from ${indexPath}`);
      const commandModule = await import(indexPath);

      if (!commandModule.default?.data) {
        console.error(`Command is missing data property in ${indexPath}`);
        continue;
      }

      const command = commandModule.default;

      // If command.data is a function, call it to get the command builder
      let commandData;
      if (typeof command.data === "function") {
        try {
          commandData = command.data();
          // Store the built data for future reference
          command.data = commandData;
        } catch (error) {
          console.error(`Error building command data for ${category}:`, error);
          continue;
        }
      } else {
        commandData = command.data;
      }

      // Extract localizations from the command
      if (commandData.localizationStrings) {
        console.log(
          `Registering localizations for ${category}.${commandData.name}`
        );

        // Register command localizations with new i18n system - Remove duplicate category
        i18n.registerLocalizations(
          "commands",
          category,
          commandData.localization_strings
        );
      }

      // Load all subcommands in the category directory
      const subcommandFiles = fs
        .readdirSync(categoryPath)
        .filter((file) => file.endsWith(".js") && file !== "index.js");

      console.log(
        `Found ${subcommandFiles.length} subcommands in ${category} category`
      );

      // Store subcommands for reference
      if (!command.subcommands) command.subcommands = {};

      // Process each subcommand
      for (const subcommandFile of subcommandFiles) {
        const subcommandPath = path.join(categoryPath, subcommandFile);
        console.log(`Loading subcommand from ${subcommandPath}`);

        try {
          // Import the subcommand module
          const subcommandModule = await import(subcommandPath);

          if (
            subcommandModule.default?.data &&
            subcommandModule.default?.execute
          ) {
            // Get the subcommand
            const subcommand = subcommandModule.default;
            const subcommandName = subcommandFile.replace(".js", "");

            // Add the subcommand to the main command
            commandData.addSubcommand(subcommand.data);

            // Register subcommand localizations if available
            if (subcommand.localization_strings) {
              if (!subcommand.localization_strings.command) {
                console.error(
                  `Subcommand ${subcommandName} is missing localization strings`
                );
                console.log(subcommand.localization_strings);
                console.log(JSON.stringify(subcommandModule.default, null, 2));
              }
              // Fix path to avoid duplicate category
              i18n.registerLocalizations(
                "commands",
                `${category}.${subcommandName}`,
                subcommand.localization_strings
              );
              console.log(
                `Registered localizations for ${category}.${subcommandName}`
              );
            }

            // Store the subcommand for later reference
            command.subcommands[subcommandName] = subcommand;
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

      // Register the command
      client.commands.set(command.data.name || category, command);
      console.log(
        `Successfully loaded ${category} command with ${
          Object.keys(command.subcommands).length
        } subcommands`
      );
    }
  } catch (error) {
    console.error("Error loading commands:", error);
  }
}
