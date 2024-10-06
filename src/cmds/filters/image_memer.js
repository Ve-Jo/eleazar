import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

let memer_list = [
  "disability",
  "hitler",
  "egg",
  "dab",
  "door",
  "failure",
  "idelete",
  "jail",
  "roblox",
  "satan",
  "trash",
  "youtube",
];

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("memer")
    .setDescription("Apply a meme filter to the image")
    .setDescriptionLocalizations({
      ru: "Применить мем-фильтр к изображению",
      uk: "Застосувати мем-фільтр до зображення",
    })
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("The meme filter to apply")
        .setDescriptionLocalizations({
          ru: "Мем-фильтр для применения",
          uk: "Мем-фільтр для застосування",
        })
        .setRequired(true)
        .addChoices(
          memer_list.map((filter) => ({
            name: filter,
            value: filter,
          }))
        )
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image to apply the meme filter to")
        .setDescriptionLocalizations({
          ru: "Изображение для применения мем-фильтра",
          uk: "Зображення для застосування мем-фільтра",
        })
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("youtube_text")
        .setDescription("[YOUTUBE FILTER] The first word USERNAME and TEXT")
        .setDescriptionLocalizations({
          ru: "[ФИЛЬТР YOUTUBE] Первое слово USERNAME и второе слово TEXT",
          uk: "[ФІЛЬТР YOUTUBE] Перше слово USERNAME і потім TEXT",
        })
        .setMaxLength(75)
    ),
  async execute(interaction) {
    const image = interaction.options.getAttachment("image");
    const filter = interaction.options.getString("filter");

    await interaction.deferReply();

    try {
      let result;
      if (filter === "youtube") {
        let username = interaction.options
          .getString("youtube_text")
          .split(" ")[0];
        let all_text_after_username = interaction.options
          .getString("youtube_text")
          .split(" ")
          .slice(1)
          .join(" ");

        if (!username) {
          await interaction.editReply({
            content: i18n.__("memer.noUsername"),
          });
          return;
        }

        if (!all_text_after_username) {
          await interaction.editReply({
            content: i18n.__("memer.noText"),
          });
          return;
        }

        result = await interaction.client.memer[filter](
          image.url,
          username,
          all_text_after_username
        );
      } else {
        result = await interaction.client.memer[filter](image.url);
      }
      await interaction.editReply({ files: [result] });
    } catch (error) {
      console.error("Error applying meme filter:", error);
      await interaction.editReply(i18n.__("memer.errorApplyingFilter"));
    }
  },
};
