import { SlashCommandSubcommandBuilder } from "discord.js";

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
    const builder = new SlashCommandSubcommandBuilder()
      .setName("image_memer")
      .setDescription("Apply a meme filter to the image")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("The meme filter to apply")
          .setRequired(true)
          .setChoices(
            memer_list.map((filter) => ({
              name: filter,
              value: filter,
            })),
          ),
      )
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("The name of the image to apply")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("youtube_text")
          .setDescription("[YOUTUBE FILTER] The first word USERNAME and TEXT")
          .setMaxLength(75),
      );

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "мемер",
        uk: "мемер",
      },
      description: {
        ru: "Применить мем-фильтр к изображению",
        uk: "Застосувати мем-фільтр до зображення",
      },
    },
    options: {
      filter: {
        name: {
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          ru: "Мем-фильтр для применения",
          uk: "Мем-фільтр для застосування",
        },
      },
      image: {
        name: {
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          ru: "Изображение для применения мем-фильтра",
          uk: "Зображення для застосування мем-фільтра",
        },
      },
      youtube_text: {
        name: {
          ru: "текст_ютуба",
          uk: "текст_ютуба",
        },
        description: {
          ru: "[ФИЛЬТР YOUTUBE] Первое слово USERNAME и второе слово TEXT",
          uk: "[ФІЛЬТР YOUTUBE] Перше слово USERNAME і потім TEXT",
        },
      },
    },
    noText: {
      en: "No text provided",
      ru: "Не указано текст",
      uk: "Не вказано текст",
    },
    noUsername: {
      en: "No username provided",
      ru: "Не указано имя пользователя",
      uk: "Не вказано ім'я користувача",
    },
    errorApplyingFilter: {
      en: "Error applying meme filter",
      ru: "Ошибка применения мем-фильтра",
      uk: "Помилка застосування мем-фільтра",
    },
  },

  async execute(interaction, i18n) {
    const image = interaction.options.getAttachment("image");
    const filter = interaction.options.getString("filter");

    await interaction.deferReply();

    try {
      let result;
      if (filter === "youtube") {
        let youtube_text = interaction.options.getString("youtube_text");

        if (!youtube_text) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noText"),
          });
          return;
        }

        let username = youtube_text.split(" ")[0];
        let all_text_after_username = youtube_text
          .split(" ")
          .slice(1)
          .join(" ");

        if (!username) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noUsername"),
          });
          return;
        }

        if (!all_text_after_username) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noText"),
          });
          return;
        }

        result = await interaction.client.memer[filter](
          image.url,
          username,
          all_text_after_username,
        );
      } else {
        result = await interaction.client.memer[filter](image.url);
      }
      await interaction.editReply({ files: [result] });
    } catch (error) {
      console.error("Error applying meme filter:", error);
      await interaction.editReply(
        await i18n.__("commands.filters.image_memer.errorApplyingFilter"),
      );
    }
  },
};
