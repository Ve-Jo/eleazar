import { Events, Collection } from "discord.js";
import Database from "../database/client.js";
import i18n from "../utils/i18n.js";

const cooldowns = new Collection();

export default {
  name: Events.InteractionCreate,
  essential: true,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const subcommandName = interaction.options.getSubcommand(false);
    const fullCommandName = subcommandName
      ? `${commandName}_${subcommandName}`
      : commandName;

    const command = interaction.client.commands.get(commandName);
    if (!command) return;

    let cooldownAmount;
    if (subcommandName && command[subcommandName]) {
      cooldownAmount = command[subcommandName].cooldown;
    }

    if (cooldownAmount) {
      if (!cooldowns.has(fullCommandName)) {
        cooldowns.set(fullCommandName, new Collection());
      }

      const now = Date.now();
      const timestamps = cooldowns.get(fullCommandName);
      const cooldownMs = cooldownAmount * 1000;

      if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownMs;

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

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
    }

    try {
      console.log(interaction.locale);
      let locale = interaction.locale || "en";
      if (locale.includes("-")) {
        locale = locale.split("-")[0];
      }
      await i18n.setLocale(locale);

      if (command.preExecute) {
        await command.preExecute(interaction, i18n);
      }

      // Handle subcommand execution
      if (subcommandName) {
        const subcommand = command.subcommands?.[subcommandName];
        if (!subcommand) {
          return interaction.reply({
            content: i18n.__("subcommandNotFound"),
            ephemeral: true,
          });
        }
        await subcommand.execute(interaction, i18n);
      } else if (command.execute) {
        await command.execute(interaction, i18n);
      }

      // Update user's last activity
      await Database.client.user.upsert({
        where: {
          guildId_id: {
            guildId: interaction.guild.id,
            id: interaction.user.id,
          },
        },
        create: {
          id: interaction.user.id,
          guildId: interaction.guild.id,
          lastActivity: Date.now(),
        },
        update: {
          lastActivity: Date.now(),
        },
      });
    } catch (error) {
      console.error(error);
    }
  },
};
