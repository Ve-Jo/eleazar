import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";

const memer_list = [
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
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("filters", "image_memer");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add filter option
    const filterOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "filter",
      description: i18nBuilder.translateOption("filter", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("filter", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "filter",
        "description"
      ),
      choices: memer_list.map((filter) => ({
        name: filter,
        value: filter,
      })),
    });

    // Add image option
    const imageOption = new SlashCommandOption({
      type: OptionType.ATTACHMENT,
      name: "image",
      description: i18nBuilder.translateOption("image", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("image", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "image",
        "description"
      ),
    });

    // Add youtube_text option
    const youtubeTextOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "youtube_text",
      description: i18nBuilder.translateOption("youtube_text", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "youtube_text",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "youtube_text",
        "description"
      ),
      max_length: 75,
    });

    subcommand.addOption(filterOption);
    subcommand.addOption(imageOption);
    subcommand.addOption(youtubeTextOption);

    return subcommand;
  },
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
  localization_strings: {
    name: {
      en: "memer",
      ru: "мемер",
      uk: "мемер",
    },
    description: {
      en: "Apply a meme filter to the image",
      ru: "Применить мем-фильтр к изображению",
      uk: "Застосувати мем-фільтр до зображення",
    },
    options: {
      filter: {
        name: {
          en: "filter",
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          en: "The meme filter to apply",
          ru: "Мем-фильтр для применения",
          uk: "Мем-фільтр для застосування",
        },
      },
      image: {
        name: {
          en: "image",
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          en: "The image to apply the meme filter to",
          ru: "Изображение для применения мем-фильтра",
          uk: "Зображення для застосування мем-фільтра",
        },
      },
      youtube_text: {
        name: {
          en: "youtube_text",
          ru: "текст_ютуба",
          uk: "текст_ютуба",
        },
        description: {
          en: "[YOUTUBE FILTER] The first word USERNAME and TEXT",
          ru: "[ФИЛЬТР YOUTUBE] Первое слово USERNAME и второе слово TEXT",
          uk: "[ФІЛЬТР YOUTUBE] Перше слово USERNAME і потім TEXT",
        },
      },
    },
  },
};
