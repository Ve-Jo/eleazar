import { REST, Routes } from "discord.js";
import i18n from "../utils/newI18n.js";

class CommandManager {
  constructor(client) {
    this.client = client;
    this.rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  }

  async registerCommands(commands) {
    try {
      console.log("Starting command registration process...");

      const { serverCommands, globalCommands } = this.prepareCommands(commands);

      // Check if SERVER_SLASHES is true
      const forceServer = process.env.SERVER_SLASHES === "true";

      if (forceServer) {
        console.log(
          "Forcing all commands to be registered to the testing server."
        );
        await this.registerNewCommands(
          serverCommands.concat(globalCommands),
          []
        );
      } else {
        await this.cleanupOldCommands(serverCommands, globalCommands);
        await this.registerNewCommands(serverCommands, globalCommands);
      }

      console.log("Command registration completed successfully.");
    } catch (error) {
      console.error("Error in command registration:", error);
    }
  }

  prepareCommands(commands) {
    const serverCommands = [];
    const globalCommands = [];
    const processedNames = new Set();

    commands.forEach((cmd, name) => {
      if (processedNames.has(name)) {
        console.warn(`Skipping duplicate command: ${name}`);
        return;
      }
      processedNames.add(name);

      const commandData = this.buildCommandData(cmd);
      if (cmd.server) {
        serverCommands.push(commandData);
      } else {
        globalCommands.push(commandData);
      }
    });

    return { serverCommands, globalCommands };
  }

  buildCommandData(cmd) {
    const json = cmd.data.toJSON();

    // Handle localizations
    this.applyLocalizations(json, cmd);

    // Handle subcommands
    if (json.options?.length > 0) {
      this.processSubcommands(json, cmd);
    }

    return json;
  }

  applyLocalizations(json, cmd) {
    // Register command localizations with i18n
    if (cmd.localization_strings) {
      i18n.registerLocalizations(
        "commands",
        cmd.data.name,
        cmd.localization_strings
      );
    }

    // Apply name localizations (Check nested structure first)
    if (cmd.localization_strings?.command?.name) {
      json.name_localizations = this.filterLocalizations(
        cmd.localization_strings.command.name
      );
    } else if (cmd.localization_strings?.name) {
      // Fallback to direct key
      json.name_localizations = this.filterLocalizations(
        cmd.localization_strings.name
      );
    } else if (cmd.data.name_localizations) {
      json.name_localizations = cmd.data.name_localizations;
    }

    // Apply description localizations (Check nested structure first)
    if (cmd.localization_strings?.command?.description) {
      json.description_localizations = this.filterLocalizations(
        cmd.localization_strings.command.description
      );
    } else if (cmd.localization_strings?.description) {
      // Fallback to direct key
      json.description_localizations = this.filterLocalizations(
        cmd.localization_strings.description
      );
    } else if (cmd.data.description_localizations) {
      json.description_localizations = cmd.data.description_localizations;
    }
  }

  filterLocalizations(localizations) {
    const filtered = {};
    Object.entries(localizations).forEach(([locale, value]) => {
      if (locale !== "en") {
        filtered[locale] = value;
      }
    });
    return filtered;
  }

  processSubcommands(json, cmd) {
    json.options.forEach((option) => {
      // Check if it's a subcommand definition (type 1)
      if (option.type === 1) {
        // Prioritize localizations defined directly in the main command file's structure
        let locStrings = cmd.localization_strings?.subcommands?.[option.name];
        let isFromMainFile = !!locStrings;

        // If not found there, try finding the loaded subcommand object (for separate files)
        let subcommandObj = null;
        if (!locStrings && cmd.subcommands) {
          subcommandObj = cmd.subcommands[option.name];
          locStrings = subcommandObj?.localization_strings;
        }

        // If localization strings were found from either source, apply them
        if (locStrings) {
          // Register subcommand localizations with i18n (use the combined key)
          // Ensure registration happens only once if possible, though i18n might handle overwrites
          i18n.registerLocalizations(
            "commands",
            `${cmd.data.name}.${option.name}`,
            locStrings // Register the found strings
          );

          // Apply to the JSON structure
          // Pass the found locStrings directly, and the original cmd/subcommandObj for context if needed
          this.applySubcommandLocalizations(
            option,
            locStrings,
            cmd,
            subcommandObj
          );
        }
      }
      // TODO: Add handling for subcommand groups (type 2) if necessary
    });
  }

  applySubcommandLocalizations(option, locStrings, mainCmd, subcommandObj) {
    // const locStrings = subcommand.localization_strings; // No longer needed

    // Handle name localizations (Check nested structure first)
    if (locStrings.command?.name) {
      option.name_localizations = this.filterLocalizations(
        locStrings.command.name
      );
    } else if (locStrings.name) {
      // Fallback
      option.name_localizations = this.filterLocalizations(locStrings.name);
    }

    // Handle description localizations (Check nested structure first)
    if (locStrings.command?.description) {
      option.description_localizations = this.filterLocalizations(
        locStrings.command.description
      );
    } else if (locStrings.description) {
      // Fallback
      option.description_localizations = this.filterLocalizations(
        locStrings.description
      );
    }

    // Handle subcommand options
    if (option.options?.length > 0 && locStrings.options) {
      // Pass the correct part of locStrings
      this.processSubcommandOptions(option.options, locStrings.options);
    }
  }

  processSubcommandOptions(options, locStrings) {
    options.forEach((option) => {
      const optionStrings = locStrings[option.name];
      if (optionStrings) {
        if (optionStrings.name) {
          option.name_localizations = this.filterLocalizations(
            optionStrings.name
          );
        }
        if (optionStrings.description) {
          option.description_localizations = this.filterLocalizations(
            optionStrings.description
          );
        }
      }
    });
  }

  async cleanupOldCommands(serverCommands, globalCommands) {
    if (process.env.SERVER_TESTING) {
      const existingServerCommands = await this.rest.get(
        Routes.applicationGuildCommands(
          this.client.user.id,
          process.env.SERVER_TESTING
        )
      );
      await this.removeOldCommands(
        existingServerCommands,
        serverCommands,
        true
      );
    }

    const existingGlobalCommands = await this.rest.get(
      Routes.applicationCommands(this.client.user.id)
    );
    await this.removeOldCommands(existingGlobalCommands, globalCommands, false);
  }

  async removeOldCommands(existingCommands, newCommands, isServer) {
    for (const existingCommand of existingCommands) {
      const shouldKeep = newCommands.some(
        (cmd) => cmd.name === existingCommand.name
      );

      if (!shouldKeep) {
        const route = isServer
          ? Routes.applicationGuildCommand(
              this.client.user.id,
              process.env.SERVER_TESTING,
              existingCommand.id
            )
          : Routes.applicationCommand(this.client.user.id, existingCommand.id);

        await this.rest.delete(route);
        console.log(
          `Removed ${isServer ? "server" : "global"} command: ${
            existingCommand.name
          }`
        );
      }
    }
  }

  async registerNewCommands(serverCommands, globalCommands) {
    if (serverCommands.length > 0 && process.env.SERVER_TESTING) {
      await this.rest.put(
        Routes.applicationGuildCommands(
          this.client.user.id,
          process.env.SERVER_TESTING
        ),
        { body: serverCommands }
      );
      console.log(`Registered ${serverCommands.length} server commands`);
    }

    if (globalCommands.length > 0) {
      await this.rest.put(Routes.applicationCommands(this.client.user.id), {
        body: globalCommands,
      });
      console.log(`Registered ${globalCommands.length} global commands`);
    }
  }
}

export async function SlashCommandsHandler(client, commands) {
  const manager = new CommandManager(client);
  await manager.registerCommands(commands);
}
