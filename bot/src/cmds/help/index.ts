import { SlashCommandBuilder } from "discord.js";

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("help")
      .setDescription("Get help with the bot");
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

export default command;
