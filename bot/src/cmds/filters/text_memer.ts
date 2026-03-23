import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

const memerList = ["humanity", "excuseme", "cry", "stonks"] as const;

type MemerClientLike = {
  [key: string]: (...args: string[]) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("text_memer")
      .setDescription("Generate a meme from text")
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
      .addStringOption((option) =>
        option
          .setName("text")
          .setDescription("The text to use")
          .setRequired(true)
          .setMaxLength(75)
      );
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

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const text = interaction.options.getString!("text");
    const filter = interaction.options.getString!("filter");

    await interaction.deferReply();

    try {
      if (!text || !filter) {
        throw new Error("Missing filter input");
      }

      const filterHandler = (interaction.client as any).memer[filter];
      if (!filterHandler) {
        throw new Error(`Missing memer handler for ${filter}`);
      }

      const result = await filterHandler(text);
      await interaction.editReply({ files: [result] });
    } catch (error) {
      console.error("Error applying text meme filter:", error);
      await interaction.editReply(
        await i18n.__("commands.filters.text_memer.errorApplyingFilter")
      );
    }
  },
};

export default command;
