import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

const memerList = [
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
] as const;

type MemerClientLike = {
  [key: string]: (...args: string[]) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("image_memer")
      .setDescription("Apply a meme filter to the image")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("The meme filter to apply")
          .setRequired(true)
          .setChoices(
            memerList.map((filter) => ({
              name: filter,
              value: filter,
            }))
          )
      )
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("The name of the image to apply")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("youtube_text")
          .setDescription("[YOUTUBE FILTER] The first word USERNAME and TEXT")
          .setMaxLength(75)
      );
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

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const image = interaction.options.getAttachment!("image");
    const filter = interaction.options.getString!("filter");

    await interaction.deferReply();

    try {
      let result: unknown;
      if (filter === "youtube") {
        const youtubeFilterHandler = (interaction.client as any).memer[filter];
        const youtubeText = interaction.options.getString!("youtube_text");

        if (!youtubeText) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noText"),
          });
          return;
        }

        const username = youtubeText.split(" ")[0];
        const allTextAfterUsername = youtubeText.split(" ").slice(1).join(" ");

        if (!username) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noUsername"),
          });
          return;
        }

        if (!allTextAfterUsername) {
          await interaction.editReply({
            content: await i18n.__("commands.filters.image_memer.noText"),
          });
          return;
        }

        if (!youtubeFilterHandler) {
          throw new Error("Missing youtube memer handler");
        }

        result = await youtubeFilterHandler(
          (image as any).url,
          username,
          allTextAfterUsername
        );
      } else if (filter) {
        const filterHandler = (interaction.client as any).memer[filter];
        if (!filterHandler) {
          throw new Error(`Missing memer handler for ${filter}`);
        }
        result = await (interaction.client as any).memer[filter]((image as any).url);
      } else {
        throw new Error("No filter provided");
      }

      await interaction.editReply({ files: [result] });
    } catch (error) {
      console.error("Error applying meme filter:", error);
      await interaction.editReply(
        await i18n.__("commands.filters.image_memer.errorApplyingFilter")
      );
    }
  },
};

export default command;
