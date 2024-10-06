import { Events } from "discord.js";
import i18n from "../utils/i18n";

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    /*if (interaction.user.id !== "287275956744355841") {
      return interaction.reply({
        content: "...",
      });
    }*/

    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.find(
      (command) => command.data.name === interaction.commandName
    );

    if (!command) return;

    // Add a check for command description
    if (!command.data.description) {
      console.error(`Command "${command.data.name}" is missing a description.`);
      return;
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
      await interaction.reply({ content: error.message, ephemeral: true });
    }
  },
};
