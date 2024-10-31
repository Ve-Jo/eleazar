import { Events, Collection } from "discord.js";
import i18n from "../utils/i18n";
import { loadCommand, unloadCommand } from "../utils/loadCommands";

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

    process.emit(
      "memoryLabel",
      `Command Start: ${fullCommandName}`,
      interaction.client
    );

    let command = interaction.client.commands.get(commandName);

    if (!command) {
      process.emit(
        "memoryLabel",
        `Loading Command: ${commandName}`,
        interaction.client
      );
      const loaded = await loadCommand(commandName, interaction.client);
      if (!loaded) {
        process.emit("memoryLabel", "", interaction.client);
        return;
      }
      command = interaction.client.commands.get(commandName);
    }

    if (!command.data.description) {
      console.error(`Command "${command.data.name}" is missing a description.`);
      process.emit("memoryLabel", "", interaction.client);
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
          process.emit(
            "memoryLabel",
            `Cooldown: ${fullCommandName}`,
            interaction.client
          );
          return interaction.reply({
            content: `Please wait ${timeLeft.toFixed(
              1
            )} more second(s) before reusing the \`${fullCommandName}\` command.`,
            ephemeral: true,
          });
        }
      }

      timestamps.set(interaction.user.id, now);
      console.log(timestamps);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownMs);
    }

    try {
      let locale = interaction.locale || "en";
      if (locale.includes("-")) {
        locale = locale.split("-")[0];
      }
      i18n.setLocale(locale);

      process.emit(
        "memoryLabel",
        `Executing: ${fullCommandName}`,
        interaction.client
      );
      await command.execute(interaction);
      process.emit(
        "memoryLabel",
        `Completed: ${fullCommandName}`,
        interaction.client
      );
    } catch (error) {
      console.error(error);
      process.emit(
        "memoryLabel",
        `Error in: ${fullCommandName}`,
        interaction.client
      );
      try {
        await interaction.reply({ content: error.message, ephemeral: true });
      } catch (error) {
        await interaction.editReply({
          content: error.message,
          ephemeral: true,
        });
      }
    } finally {
      if (!["help", "ping"].includes(commandName)) {
        await unloadCommand(commandName, interaction.client);
      }
      process.emit("memoryLabel", "", interaction.client);
    }
  },
};
