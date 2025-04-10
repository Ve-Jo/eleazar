import { SlashCommandBuilder } from "discord.js";

export default {
  data: () => {
    const command = new SlashCommandBuilder()
      .setName("economy")
      .setDescription("Commands for economy");

    return command;
  },

  localization_strings: {
    name: {
      ru: "экономика",
      uk: "економіка",
    },
    description: {
      ru: "Команды для экономики",
      uk: "Команди для економіки",
    },
  },

};
