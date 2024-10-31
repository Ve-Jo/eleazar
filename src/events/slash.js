import { Events, Collection } from "discord.js";
import i18n from "../utils/i18n";

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

    if (!command.data.description) {
      console.error(`Command "${command.data.name}" is missing a description.`);
      return;
    }

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
      let locale = interaction.locale || "en";
      if (locale.includes("-")) {
        locale = locale.split("-")[0];
      }
      i18n.setLocale(locale);

      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      try {
        await interaction.reply({ content: error.message, ephemeral: true });
      } catch (error) {
        await interaction.editReply({
          content: error.message,
          ephemeral: true,
        });
      }
    }
  },
};
