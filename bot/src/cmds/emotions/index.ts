import { SlashCommandBuilder } from "discord.js";

const command = {
  data: (): SlashCommandBuilder => {
    return new SlashCommandBuilder()
      .setName("emotions")
      .setDescription("Commands for emotions");
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

export default command;
