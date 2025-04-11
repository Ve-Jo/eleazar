import { SlashCommandSubcommandBuilder } from "discord.js";

const memer_list = ["humanity", "excuseme", "cry", "stonks"];

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("text_memer")
      .setDescription("Generate a meme from text")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("The meme filter to apply")
          .setRequired(true)
          .setChoices(
            memer_list.map((filter) => ({
              name: filter,
              value: filter,
            }))
          )
      )
      .addStringOption((option) =>
        option
          .setName("text")
          .setDescription("The text to use")
          .setRequired(true)
          .setMaxLength(75)
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "текстовый_мемер",
        uk: "текстовий_мемер",
      },
      description: {
        ru: "Создать мем с текстом",
        uk: "Створити мем з текстом",
      },
    },
    options: {
      filter: {
        name: {
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          ru: "Фильтр для использования",
          uk: "Фільтр для використання",
        },
      },
      text: {
        name: {
          ru: "текст",
          uk: "текст",
        },
        description: {
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

  async execute(interaction, i18n) {
    const text = interaction.options.getString("text");
    const filter = interaction.options.getString("filter");

    await interaction.deferReply();

    try {
      let result = await interaction.client.memer[filter](text);
      await interaction.editReply({ files: [result] });
    } catch (error) {
      console.error("Error applying text meme filter:", error);
      await interaction.editReply(
        i18n.__("commands.filters.text_memer.errorApplyingFilter")
      );
    }
  },
};
