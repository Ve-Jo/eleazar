import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "i18n";
import EconomyEZ from "../../utils/economy.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("remove")
    .setDescription("Remove counting channel")
    .setDescriptionLocalizations({
      ru: "Удалить канал для счета",
      uk: "Видалити канал для счета",
    }),
  async execute(interaction) {
    const { guild } = interaction;

    const countingChannel = await EconomyEZ.get(`counting.${guild.id}`);

    if (countingChannel) {
      await EconomyEZ.remove(`counting.${guild.id}`);

      await interaction.reply({
        content: i18n.__("counting.remove.success"),
      });
    } else {
      await interaction.reply({
        content: i18n.__("counting.remove.notSet"),
      });
    }
  },
};
