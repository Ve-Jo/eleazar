import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const builder = new SlashCommandBuilder()
      .setName("emotions")
      .setDescription("Commands for emotions");

    return builder;
  },

  localization_strings: {
    name: {
      en: "emotions",
      ru: "эмоции",
      uk: "емоції",
    },
    description: {
      en: "Commands for emotions",
      ru: "Команды для эмоций",
      uk: "Команди для емоцій",
    },
  },

};
