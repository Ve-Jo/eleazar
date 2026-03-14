import { SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type InteractionLike = {
  _isAiProxy?: boolean;
  replied?: boolean;
  deferred?: boolean;
  guild: {
    id: string;
  };
  user: {
    id: string;
  };
  deferReply: (payload?: { ephemeral?: boolean }) => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("removebanner")
      .setDescription("Remove your profile banner image");
  },

  localization_strings: {
    command: {
      name: {
        ru: "убратьбаннер",
        uk: "видалитибанер",
      },
      description: {
        ru: "Удалить изображение баннера профиля",
        uk: "Видалити зображення банера профілю",
      },
    },
    title: {
      en: "Banner Removed",
      ru: "Баннер удален",
      uk: "Банер видалено",
    },
    success: {
      en: "Your banner has been removed successfully!",
      ru: "Ваш баннер успешно удален!",
      uk: "Ваш банер успішно видалено!",
    },
    error: {
      en: "An error occurred while removing the banner",
      ru: "Произошла ошибка при удалении баннера",
      uk: "Виникла помилка під час видалення банера",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    if (!isAiContext) {
      await interaction.deferReply({ ephemeral: true });
    }

    try {
      await (hubClient as any).ensureGuildUser(interaction.guild.id, interaction.user.id);
      await (hubClient as any).updateUser(interaction.guild.id, interaction.user.id, {
        bannerUrl: null,
      });

      const successComponent = new ComponentBuilder({
        mode: builderMode,
        color: 0x00ff00,
      }).addText(String(await i18n.__("commands.images.removebanner.success")));

      const replyOptions = successComponent.toReplyOptions({
        ephemeral: true,
        content: isAiContext
          ? String(await i18n.__("commands.images.removebanner.success"))
          : undefined,
      });

      if (isAiContext) {
        await interaction.reply(replyOptions);
      } else {
        await interaction.editReply(replyOptions);
      }
    } catch (error) {
      console.error("Error removing banner:", error);

      const errorComponent = new ComponentBuilder({
        mode: builderMode,
        color: 0xff0000,
      }).addText(String(await i18n.__("commands.images.removebanner.error")));

      const errorOptions = errorComponent.toReplyOptions({
        ephemeral: true,
        content: isAiContext
          ? String(await i18n.__("commands.images.removebanner.error"))
          : undefined,
      });

      if (isAiContext) {
        throw new Error(String(await i18n.__("commands.images.removebanner.error")));
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export default command;
