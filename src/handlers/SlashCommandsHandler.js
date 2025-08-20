import { REST, Routes } from "discord.js";
import { hubClient } from "../api/hubClient.js"; // Replace i18n import

class CommandManager {
  constructor(client) {
    this.client = client;
    this.rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  }

  async registerCommands(commands) {
    try {
      console.log("Starting command registration process...");

      const { serverCommands, globalCommands } = await this.prepareCommands(
        commands
      );

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

  async prepareCommands(commands) {
    const serverCommands = [];
    const globalCommands = [];
    const processedNames = new Set();

    for (const [name, cmd] of commands) {
      if (processedNames.has(name)) {
        console.warn(`Skipping duplicate command: ${name}`);
        continue;
      }
      processedNames.add(name);

      const commandData = await this.buildCommandData(cmd);
      if (cmd.server) {
        serverCommands.push(commandData);
      } else {
        globalCommands.push(commandData);
      }
    }

    return { serverCommands, globalCommands };
  }

  async buildCommandData(cmd) {
    const json = cmd.data.toJSON();

    // Handle localizations
    await this.applyLocalizations(json, cmd);

    // Handle subcommands
    if (json.options?.length > 0) {
      await this.processSubcommands(json, cmd);
    }

    return json;
  }

  async applyLocalizations(json, cmd) {
    // Make async
    // Register command localizations with hubClient
    if (cmd.localization_strings) {
      await hubClient.registerLocalizations(
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

  // In processSubcommands, make async if needed or use await
  async processSubcommands(json, cmd) {
    await Promise.all(
      json.options.map(async (option) => {
        if (option.type === 1) {
          let locStrings = cmd.localization_strings?.subcommands?.[option.name];
          let subcommandObj = null;
          if (!locStrings && cmd.subcommands) {
            subcommandObj = cmd.subcommands[option.name];
            locStrings = subcommandObj?.localization_strings;
          }
          if (locStrings) {
            await hubClient.registerLocalizations(
              "commands",
              `${cmd.data.name}.${option.name}`,
              locStrings
            );
            this.applySubcommandLocalizations(
              option,
              locStrings,
              cmd,
              subcommandObj
            );
          }
        }
      })
    );
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
