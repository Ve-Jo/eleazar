import { REST, Routes } from "discord.js";

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
    const locStrings =
      cmd.localization_strings || cmd.data.localizationStrings || {};

    // Apply name localizations
    if (locStrings.name) {
      json.name_localizations = this.filterLocalizations(locStrings.name);
    } else if (cmd.data.name_localizations) {
      json.name_localizations = cmd.data.name_localizations;
    }

    // Apply description localizations
    if (locStrings.description) {
      json.description_localizations = this.filterLocalizations(
        locStrings.description
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
      if (option.type === 1 && cmd.subcommands) {
        // Type 1 = SUB_COMMAND
        const subcommand = cmd.subcommands[option.name];
        if (subcommand?.localization_strings) {
          this.applySubcommandLocalizations(option, subcommand);
        }
      }
    });
  }

  applySubcommandLocalizations(option, subcommand) {
    const locStrings = subcommand.localization_strings;

    // Handle name localizations
    if (locStrings.name) {
      option.name_localizations = this.filterLocalizations(locStrings.name);
    } else if (locStrings.command?.name) {
      option.name_localizations = this.filterLocalizations(
        locStrings.command.name
      );
    }

    // Handle description localizations
    if (locStrings.description) {
      option.description_localizations = this.filterLocalizations(
        locStrings.description
      );
    } else if (locStrings.command?.description) {
      option.description_localizations = this.filterLocalizations(
        locStrings.command.description
      );
    }

    // Handle subcommand options
    if (option.options?.length > 0 && locStrings.options) {
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
      ); /*&&
        (existingCommand.name !== "economy" ||
          this.hasEconomyCommand(newCommands));*/

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

  hasEconomyCommand(commands) {
    return commands.some((cmd) => cmd.name === "economy");
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
