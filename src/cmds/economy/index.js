import { I18nCommandBuilder } from "../../utils/builders/index.js";
import EconomyEZ from "../../utils/economy.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy");
    const command = i18nBuilder.createCommand();
    return command;
  },
  server: true,
  async preExecute(interaction) {
    await interaction.deferReply();
    await EconomyEZ.ensure(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );
  },
  localization_strings: {
    name: {
      en: "economy",
      ru: "экономика",
      uk: "економіка",
    },
    description: {
      en: "Commands for economy",
      ru: "Команды для экономики",
      uk: "Команди для економіки",
    },
  },
};
