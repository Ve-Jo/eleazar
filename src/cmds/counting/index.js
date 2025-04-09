import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("counting")
      .setDescription("Commands for counting");

    return command;
  },

  localization_strings: {
    name: {
      ru: "считалочка",
      uk: "підрахунок",
    },
    description: {
      ru: "Установка и управление каналом для счета",
      uk: "Налаштування і керування каналом для підрахунку",
    },
  },

  server: true,
};
