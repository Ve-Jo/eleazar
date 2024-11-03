import { I18nCommandBuilder } from "../../utils/builders/index.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("filters");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  localization_strings: {
    name: {
      en: "filters",
      ru: "фильтры",
      uk: "фільтри",
    },
    description: {
      en: "Apply a filter to the image",
      ru: "Примените фильтр к изображению",
      uk: "Застосуйте фільтр до зображення",
    },
  },
};
