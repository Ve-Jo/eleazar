import { SlashCommandBuilder } from "discord.js";
import setup from "./setup.js";
import remove from "./remove.js";

export default {
  data: new SlashCommandBuilder()
    .setName("counting")
    .setDescription("Set and manage counting channel")
    .setDescriptionLocalizations({
      ru: "Установка и управление каналом для счета",
      uk: "Налаштування і керування каналом для счета",
    })
    .addSubcommand(setup.data)
    .addSubcommand(remove.data),
  server: true,
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      await setup.execute(interaction);
    } else if (subcommand === "remove") {
      await remove.execute(interaction);
    }
  },
};
