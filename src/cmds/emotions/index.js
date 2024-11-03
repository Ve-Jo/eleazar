import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("emotions");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  localization_strings: {
    name: {
      en: "emotions",
      ru: "эмоции",
      uk: "емоції",
    },
    description: {
      en: "Select an emotion type and emotion",
      ru: "Выберите тип эмоции и саму эмоцию",
      uk: "Виберіть тип емоції та саму емоцію",
    },
  },
};
