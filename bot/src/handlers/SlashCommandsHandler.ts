import { REST, Routes } from "discord.js";
import { createHash } from "crypto";
import { hubClient } from "../api/hubClient.ts";

type LocalizationMap = Record<string, string>;

type OptionLocalizationShape = {
  name?: LocalizationMap;
  description?: LocalizationMap;
};

type SubcommandLocalizationShape = {
  command?: OptionLocalizationShape;
  name?: LocalizationMap;
  description?: LocalizationMap;
  options?: Record<string, OptionLocalizationShape>;
  [key: string]: unknown;
};

type CommandLocalizationShape = {
  command?: OptionLocalizationShape;
  name?: LocalizationMap;
  description?: LocalizationMap;
  subcommands?: Record<string, SubcommandLocalizationShape>;
  [key: string]: unknown;
};

type CommandBuilderJson = {
  name: string;
  options?: Array<CommandOptionJson>;
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
};

type CommandOptionJson = {
  type?: number;
  name: string;
  options?: Array<CommandOptionJson>;
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
};

type CommandDataBuilder = {
  name: string;
  description_localizations?: Record<string, string>;
  name_localizations?: Record<string, string>;
  toJSON: () => CommandBuilderJson;
};

type CommandShape = {
  data: CommandDataBuilder;
  server?: boolean;
  localization_strings?: CommandLocalizationShape;
  subcommands?: Record<string, CommandShape>;
};

type BotUser = {
  id: string;
};

type BotClientShape = {
  user: BotUser;
};

class CommandManager {
  private client: BotClientShape;
  private rest: REST;

  constructor(client: BotClientShape) {
    this.client = client;
    this.rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN ?? "");
  }

  async registerCommands(commands: Map<string, CommandShape>): Promise<void> {
    try {
      console.log("Starting command registration process...");

      const { serverCommands, globalCommands } = await this.prepareCommands(commands);
      const forceServer = process.env.SERVER_SLASHES === "true";

      // Calculate schema hash for change detection
      const currentHash = this.calculateCommandsHash(serverCommands, globalCommands);
      const storedHash = await this.getStoredCommandHash();

      if (currentHash === storedHash && !forceServer) {
        console.log("Command schemas unchanged, skipping Discord API update");
        return;
      }

      console.log(`Command schema change detected (hash: ${currentHash.slice(0, 8)}...), updating Discord`);

      if (forceServer) {
        console.log("Forcing all commands to be registered to the testing server.");
        await this.registerNewCommands(serverCommands.concat(globalCommands), []);
      } else {
        await this.cleanupOldCommands(serverCommands, globalCommands);
        await this.registerNewCommands(serverCommands, globalCommands);
      }

      // Store the new hash after successful registration
      await this.storeCommandHash(currentHash);
      console.log("Command registration completed successfully.");
    } catch (error) {
      console.error("Error in command registration:", error);
    }
  }

  /**
   * Calculate SHA-256 hash of command schemas for change detection.
   * Normalizes the JSON to ensure consistent hashing.
   */
  private calculateCommandsHash(
    serverCommands: CommandBuilderJson[],
    globalCommands: CommandBuilderJson[]
  ): string {
    const normalized = JSON.stringify({
      server: serverCommands.sort((a, b) => a.name.localeCompare(b.name)),
      global: globalCommands.sort((a, b) => a.name.localeCompare(b.name)),
    });
    return createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Get stored command hash from Redis or file-based fallback.
   * Returns null if no hash stored or Redis unavailable.
   */
  private async getStoredCommandHash(): Promise<string | null> {
    try {
      // Try Redis first (via hub client or direct if available)
      const { getRuntimeRedisClient, buildPrefixedKey } = await import("../services/runtimeRedis.ts");
      const client = await getRuntimeRedisClient();
      if (client) {
        const key = buildPrefixedKey("command-schema-hash");
        const hash = await client.get(key);
        return hash;
      }
    } catch {
      // Redis not available, try file fallback
    }

    // File-based fallback for non-Redis deployments
    try {
      const { readFileSync, existsSync } = await import("fs");
      const path = ".command-hash";
      if (existsSync(path)) {
        return readFileSync(path, "utf-8").trim();
      }
    } catch {
      // File read failed
    }

    return null;
  }

  /**
   * Store command hash to Redis or file-based fallback.
   */
  private async storeCommandHash(hash: string): Promise<void> {
    try {
      const { getRuntimeRedisClient, buildPrefixedKey } = await import("../services/runtimeRedis.ts");
      const client = await getRuntimeRedisClient();
      if (client) {
        const key = buildPrefixedKey("command-schema-hash");
        await client.set(key, hash);
        return;
      }
    } catch {
      // Redis not available, use file fallback
    }

    // File-based fallback
    try {
      const { writeFileSync } = await import("fs");
      writeFileSync(".command-hash", hash);
    } catch (error) {
      console.warn("Failed to store command hash:", error);
    }
  }

  async prepareCommands(
    commands: Map<string, CommandShape>
  ): Promise<{ serverCommands: CommandBuilderJson[]; globalCommands: CommandBuilderJson[] }> {
    const serverCommands: CommandBuilderJson[] = [];
    const globalCommands: CommandBuilderJson[] = [];
    const processedNames = new Set<string>();

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

  async buildCommandData(cmd: CommandShape): Promise<CommandBuilderJson> {
    const json = cmd.data.toJSON();
    await this.applyLocalizations(json, cmd);

    if (json.options?.length) {
      await this.processSubcommands(json, cmd);
    }

    return json;
  }

  async applyLocalizations(json: CommandBuilderJson, cmd: CommandShape): Promise<void> {
    if (cmd.localization_strings) {
      await hubClient.registerLocalizations(
        "commands",
        cmd.data.name,
        cmd.localization_strings
      );
    }

    if (cmd.localization_strings?.command?.name) {
      json.name_localizations = this.filterLocalizations(cmd.localization_strings.command.name);
    } else if (cmd.localization_strings?.name) {
      json.name_localizations = this.filterLocalizations(cmd.localization_strings.name);
    } else if (cmd.data.name_localizations) {
      json.name_localizations = cmd.data.name_localizations;
    }

    if (cmd.localization_strings?.command?.description) {
      json.description_localizations = this.filterLocalizations(
        cmd.localization_strings.command.description
      );
    } else if (cmd.localization_strings?.description) {
      json.description_localizations = this.filterLocalizations(
        cmd.localization_strings.description
      );
    } else if (cmd.data.description_localizations) {
      json.description_localizations = cmd.data.description_localizations;
    }
  }

  filterLocalizations(localizations: LocalizationMap): Record<string, string> {
    const filtered: Record<string, string> = {};
    Object.entries(localizations).forEach(([locale, value]) => {
      if (locale !== "en") {
        filtered[locale] = value;
      }
    });
    return filtered;
  }

  async processSubcommands(json: CommandBuilderJson, cmd: CommandShape): Promise<void> {
    await Promise.all(
      (json.options ?? []).map(async (option) => {
        if (option.type === 1) {
          let locStrings = cmd.localization_strings?.subcommands?.[option.name];
          let subcommandObj: CommandShape | null = null;
          if (!locStrings && cmd.subcommands) {
            subcommandObj = cmd.subcommands[option.name] ?? null;
            locStrings = subcommandObj?.localization_strings as SubcommandLocalizationShape | undefined;
          }
          if (locStrings) {
            await hubClient.registerLocalizations(
              "commands",
              `${cmd.data.name}.${option.name}`,
              locStrings
            );
            this.applySubcommandLocalizations(option, locStrings);
          }
        }
      })
    );
  }

  applySubcommandLocalizations(
    option: CommandOptionJson,
    locStrings: SubcommandLocalizationShape
  ): void {
    if (locStrings.command?.name) {
      option.name_localizations = this.filterLocalizations(locStrings.command.name);
    } else if (locStrings.name) {
      option.name_localizations = this.filterLocalizations(locStrings.name);
    }

    if (locStrings.command?.description) {
      option.description_localizations = this.filterLocalizations(
        locStrings.command.description
      );
    } else if (locStrings.description) {
      option.description_localizations = this.filterLocalizations(locStrings.description);
    }

    if (option.options?.length && locStrings.options) {
      this.processSubcommandOptions(option.options, locStrings.options);
    }
  }

  processSubcommandOptions(
    options: CommandOptionJson[],
    locStrings: Record<string, OptionLocalizationShape>
  ): void {
    options.forEach((option) => {
      const optionStrings = locStrings[option.name];
      if (optionStrings) {
        if (optionStrings.name) {
          option.name_localizations = this.filterLocalizations(optionStrings.name);
        }
        if (optionStrings.description) {
          option.description_localizations = this.filterLocalizations(optionStrings.description);
        }
      }
    });
  }

  async cleanupOldCommands(
    serverCommands: CommandBuilderJson[],
    globalCommands: CommandBuilderJson[]
  ): Promise<void> {
    if (process.env.SERVER_TESTING) {
      const existingServerCommands = (await this.rest.get(
        Routes.applicationGuildCommands(this.client.user.id, process.env.SERVER_TESTING)
      )) as Array<{ id: string; name: string }>;
      await this.removeOldCommands(existingServerCommands, serverCommands, true);
    }

    const existingGlobalCommands = (await this.rest.get(
      Routes.applicationCommands(this.client.user.id)
    )) as Array<{ id: string; name: string }>;
    await this.removeOldCommands(existingGlobalCommands, globalCommands, false);
  }

  async removeOldCommands(
    existingCommands: Array<{ id: string; name: string }>,
    newCommands: CommandBuilderJson[],
    isServer: boolean
  ): Promise<void> {
    for (const existingCommand of existingCommands) {
      const shouldKeep = newCommands.some((cmd) => cmd.name === existingCommand.name);

      if (!shouldKeep) {
        const route = isServer
          ? Routes.applicationGuildCommand(
              this.client.user.id,
              process.env.SERVER_TESTING ?? "",
              existingCommand.id
            )
          : Routes.applicationCommand(this.client.user.id, existingCommand.id);

        await this.rest.delete(route);
        console.log(
          `Removed ${isServer ? "server" : "global"} command: ${existingCommand.name}`
        );
      }
    }
  }

  async registerNewCommands(
    serverCommands: CommandBuilderJson[],
    globalCommands: CommandBuilderJson[]
  ): Promise<void> {
    if (serverCommands.length > 0 && process.env.SERVER_TESTING) {
      await this.rest.put(
        Routes.applicationGuildCommands(this.client.user.id, process.env.SERVER_TESTING),
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

async function SlashCommandsHandler(
  client: BotClientShape,
  commands: Map<string, CommandShape>
): Promise<void> {
  const manager = new CommandManager(client);
  await manager.registerCommands(commands);
}

export { SlashCommandsHandler };
