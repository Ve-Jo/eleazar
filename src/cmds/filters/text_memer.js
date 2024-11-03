import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

const memer_list = ["humanity", "excuseme", "cry", "stonks"];

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("filters", "text_memer");

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
      choices: memer_list.map((memer) => ({
        name: memer,
        value: memer,
      })),
    });

    // Add text option
    const textOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "text",
      description: i18nBuilder.translateOption("text", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("text", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "text",
        "description"
      ),
      max_length: 75,
    });

    subcommand.addOption(filterOption);
    subcommand.addOption(textOption);

    return subcommand;
  },
  async execute(interaction) {
    const text = interaction.options.getString("text");
    const filter = interaction.options.getString("filter");

    await interaction.deferReply();

    try {
      let result = await interaction.client.memer[filter](text);
      await interaction.editReply({ files: [result] });
    } catch (error) {
      await interaction.editReply(
        i18n.__("filters.text_memer.errorApplyingFilter")
      );
    }
  },
  localization_strings: {
    name: {
      en: "text_memer",
      ru: "текстовый_мемер",
      uk: "текстовий_мемер",
    },
    description: {
      en: "Generate a meme with text",
      ru: "Создать мем с текстом",
      uk: "Створити мем з текстом",
    },
    options: {
      filter: {
        name: {
          en: "filter",
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          en: "The filter to use",
          ru: "Фильтр для использования",
          uk: "Фільтр для використання",
        },
      },
      text: {
        name: {
          en: "text",
          ru: "текст",
          uk: "текст",
        },
        description: {
          en: "The text to use",
          ru: "Текст для использования",
          uk: "Текст для використання",
        },
      },
    },
    errorApplyingFilter: {
      en: "Error applying meme filter",
      ru: "Ошибка применения мем-фильтра",
      uk: "Помилка застосування мем-фільтра",
    },
  },
};
