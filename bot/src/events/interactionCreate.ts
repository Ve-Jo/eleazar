import { Events, Collection } from "discord.js";
import hubClient from "../api/hubClient.ts";
import { I18n } from "../utils/i18n.ts";
import { handleLevelUp } from "../utils/levelUpHandler.ts";
import { checkAndSetCommandCooldown } from "../services/runtimeRedis.ts";
import { recordEventCall } from "../services/metrics.ts";

const cooldowns = new Collection<string, Collection<string, number>>();

type CommandModuleLike = {
  cooldown?: number;
  execute?: (interaction: InteractionLike, i18n: I18n) => Promise<unknown>;
  subcommands?: Record<
    string,
    {
      cooldown?: number;
      execute: (interaction: InteractionLike, i18n: I18n) => Promise<unknown>;
    }
  >;
};

type GuildLike = {
  id: string;
  preferredLocale?: string;
};

type InteractionLike = {
  isChatInputCommand: () => boolean;
  commandName: string;
  options: {
    getSubcommand: (required?: boolean) => string | null;
  };
  client: {
    commands: Collection<string, CommandModuleLike>;
  };
  user: {
    id: string;
    tag: string;
  };
  guild: GuildLike | null;
  locale?: string;
  channel?: unknown;
  replied?: boolean;
  deferred?: boolean;
  reply: (payload: unknown) => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
};

type GuildSettingsLike = {
  settings?: {
    xp_per_command?: number;
  };
};

type XpResultLike = {
  levelUp?: unknown;
  type?: string;
};

const event = {
  name: Events.InteractionCreate,
  async execute(interaction: InteractionLike): Promise<unknown> {
    const startTime = Date.now();
    let isError = false;

    if (!interaction.isChatInputCommand()) return;

    console.log(`Received command interaction: ${interaction.commandName}`);

    const commandName = interaction.commandName;
    const subcommandName = interaction.options.getSubcommand(false);
    const fullCommandName = subcommandName ? `${commandName}_${subcommandName}` : commandName;

    console.log("FULL COMMAND NAME");
    console.log(fullCommandName);

    try {
      const command = interaction.client.commands.get(commandName);

      if (!command) {
        console.error(`No command matching ${commandName} was found.`);
        return interaction.reply({
          content: "This command is not currently available.",
          ephemeral: true,
        });
      }

      let cooldownAmount: number | undefined;
      if (subcommandName && command.subcommands?.[subcommandName]?.cooldown) {
        cooldownAmount = command.subcommands[subcommandName].cooldown;
      } else if (command.cooldown) {
        cooldownAmount = command.cooldown;
      }

      if (cooldownAmount) {
        const cooldownMs = cooldownAmount * 1000;

        if (interaction.guild?.id) {
          const cooldownResult = await checkAndSetCommandCooldown(
            interaction.guild.id,
            interaction.user.id,
            fullCommandName,
            cooldownMs
          );

          if (!cooldownResult.allowed) {
            const timeLeft = cooldownResult.retryAfterMs / 1000;
            return interaction.reply({
              content: `Please wait ${timeLeft.toFixed(
                1
              )} more second(s) before reusing the \`${fullCommandName}\` command.`,
              ephemeral: true,
            });
          }
        } else {
          if (!cooldowns.has(fullCommandName)) {
            cooldowns.set(fullCommandName, new Collection<string, number>());
          }

          const now = Date.now();
          const timestamps = cooldowns.get(fullCommandName);

          if (timestamps?.has(interaction.user.id)) {
            const previousTimestamp = timestamps.get(interaction.user.id);
            const expirationTime = (previousTimestamp || 0) + cooldownMs;

            if (now < expirationTime) {
              const timeLeft = (expirationTime - now) / 1000;
              return interaction.reply({
                content: `Please wait ${timeLeft.toFixed(
                  1
                )} more second(s) before reusing the \`${fullCommandName}\` command.`,
                ephemeral: true,
              });
            }
          }

          timestamps?.set(interaction.user.id, now);
          setTimeout(() => timestamps?.delete(interaction.user.id), cooldownMs);
        }
      }

      let locale = interaction.locale || interaction.guild?.preferredLocale || "en";

      if (locale.includes("-")) {
        locale = (locale.split("-")[0] || "en").toLowerCase();
      }

      if (!["en", "ru", "uk"].includes(locale)) {
        console.log(`Locale ${locale} not supported, falling back to en`);
        locale = "en";
      }

      console.log(`Setting locale to ${locale} for user ${interaction.user.tag}`);

      const commandI18n = new I18n();
      commandI18n.setLocale(locale);

      if (interaction.guild?.id) {
        hubClient.setUserLocale(interaction.guild.id, interaction.user.id, locale).catch((err) => {
          console.error(`Failed to save locale for user ${interaction.user.id}:`, err);
        });
      }

      if (subcommandName && command.subcommands?.[subcommandName]) {
        await command.subcommands[subcommandName].execute(interaction, commandI18n);
      } else if (command.execute) {
        await command.execute(interaction, commandI18n);
      } else {
        console.error(`Command ${commandName} has no execute method`);
        return interaction.reply({
          content: "This command is not properly configured.",
          ephemeral: true,
        });
      }

      if (!interaction.guild?.id) {
        return;
      }

      await hubClient.ensureGuildUser(interaction.guild.id, interaction.user.id);

      await hubClient.updateStats(interaction.guild.id, interaction.user.id, "commandCount", 1);

      const guildSettings = (await hubClient.getGuild(interaction.guild.id)) as GuildSettingsLike;
      const xpPerCommand = guildSettings?.settings?.xp_per_command || 5;

      if (xpPerCommand > 0) {
        const xpResult = (await hubClient.addXP(
          interaction.guild.id,
          interaction.user.id,
          xpPerCommand
        )) as XpResultLike;

        if (xpResult.levelUp) {
          await handleLevelUp(
            interaction.client as any,
            interaction.guild.id,
            interaction.user.id,
            xpResult.levelUp,
            xpResult.type || "command",
            interaction.channel as any
          );
        }
      }
    } catch (error) {
      console.error(`Error executing ${commandName}:`, error);
      isError = true;

      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        } catch (replyError) {
          console.error("Failed to send error response:", replyError);
        }
      } else if (interaction.deferred) {
        try {
          await interaction.editReply({
            content: "There was an error while executing this command!",
          });
        } catch (replyError) {
          console.error("Failed to edit reply with error message:", replyError);
        }
      }
    } finally {
      const duration = Date.now() - startTime;
      recordEventCall("interactionCreate", duration, isError);
    }
  },
};

export default event;
