import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const builder = new SlashCommandBuilder()
      .setName("help")
      .setDescription("Get help with the bot");

    return builder;
  },

  localization_strings: {
    name: {
      en: "help",
      ru: "помощь",
      uk: "допомога",
    },
    description: {
      en: "Get help with the bot",
      ru: "Получить помощь с ботом",
      uk: "Отримати допомогу з ботом",
    },
  },

};
