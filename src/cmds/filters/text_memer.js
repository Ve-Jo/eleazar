import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

let memer_list = ["humanity", "excuseme", "cry", "stonks"];

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("text_memer")
    .setDescription("Generate a meme with text")
    .setDescriptionLocalizations({
      ru: "Создать мем с текстом",
      uk: "Створити мем з текстом",
    })
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("The filter to use")
        .setDescriptionLocalizations({
          ru: "Фильтр для использования",
          uk: "Фільтр для використання",
        })
        .setRequired(true)
        .addChoices(
          ...memer_list.map((memer) => ({ name: memer, value: memer }))
        )
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to use")
        .setDescriptionLocalizations({
          ru: "Текст для использования",
          uk: "Текст для використання",
        })
        .setRequired(true)
        .setMaxLength(75)
    ),
  async execute(interaction) {
    const text = interaction.options.getString("text");
    const filter = interaction.options.getString("filter");

    await interaction.deferReply();

    try {
      let result = await interaction.client.memer[filter](text);
      await interaction.editReply({ files: [result] });
    } catch (error) {
      await interaction.editReply(i18n.__("memer.errorApplyingFilter"));
    }
  },
};
