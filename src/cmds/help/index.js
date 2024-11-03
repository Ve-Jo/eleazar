import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("help");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
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
