import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import axios from "axios";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

const BANNER_LOGS = {
  guildId: "1282078106202669148",
  channelId: "1306739210715140116",
};

type TranslatorLike = {
  __: (
    key: string,
    vars?: Record<string, unknown>,
    locale?: string
  ) => Promise<string | unknown>;
  getLocale?: () => string;
};

type AttachmentLike = {
  url: string;
  contentType?: string | null;
  size: number;
  name?: string | null;
};

type UserLike = {
  id: string;
  tag?: string;
  username?: string;
  displayName?: string;
  send: (payload: unknown) => Promise<unknown>;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
};

type StorageMessageLike = {
  attachments: {
    first: () => { url?: string } | null;
  };
  edit: (payload: unknown) => Promise<unknown>;
};

type ChannelLike = {
  send: (payload: unknown) => Promise<StorageMessageLike>;
};

type ButtonInteractionLike = {
  customId: string;
  client: {
    users: {
      fetch: (userId: string) => Promise<UserLike | null>;
    };
  };
  message: {
    delete: () => Promise<unknown>;
  };
  reply: (payload: unknown) => Promise<unknown>;
};

type InteractionLike = {
  _isAiProxy?: boolean;
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  guild: GuildLike;
  user: UserLike;
  client: {
    guilds: {
      cache: {
        get: (guildId: string) => {
          channels: {
            cache: {
              get: (channelId: string) => ChannelLike | undefined;
            };
          };
        } | undefined;
      };
    };
    users: {
      fetch: (userId: string) => Promise<UserLike | null>;
    };
  };
  options: {
    getAttachment: (name: string) => AttachmentLike | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
};

async function makePermanentAttachment(
  interaction: InteractionLike,
  attachment: AttachmentLike
): Promise<string> {
  try {
    const response = await axios.get<ArrayBuffer>(attachment.url, {
      responseType: "arraybuffer",
    });

    const extension = attachment.contentType?.split("/")[1] || "png";
    const tempAttachment = new AttachmentBuilder(Buffer.from(response.data), {
      name: `banner.${extension}`,
      description: "User banner image",
    });

    const modGuild = interaction.client.guilds.cache.get(BANNER_LOGS.guildId);
    if (!modGuild) {
      throw new Error("Mod guild not found");
    }

    const modChannel = modGuild.channels.cache.get(BANNER_LOGS.channelId);
    if (!modChannel) {
      throw new Error("Mod channel not found");
    }

    const modEmbed = new EmbedBuilder()
      .setTitle("New Banner Set")
      .setColor(0x0099ff)
      .addFields(
        {
          name: "User",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        },
        {
          name: "Guild",
          value: `${interaction.guild.name} (${interaction.guild.id})`,
        },
        {
          name: "Original Filename",
          value: attachment.name || "unknown",
        }
      )
      .setTimestamp();

    const storageMessage = await modChannel.send({
      embeds: [modEmbed],
      files: [tempAttachment],
    });

    const permanentUrl = storageMessage.attachments.first()?.url;
    if (!permanentUrl) {
      throw new Error("Failed to get permanent URL from storage message attachment.");
    }

    modEmbed.setImage(permanentUrl);
    await storageMessage.edit({ embeds: [modEmbed] });

    return permanentUrl;
  } catch (error) {
    console.error("Error making permanent attachment:", error);
    throw error;
  }
}

async function handleRemoveBanner(interaction: ButtonInteractionLike): Promise<void> {
  if (!interaction.customId.startsWith("remove_banner:")) {
    return;
  }

  const [, userId, guildId] = interaction.customId.split(":");
  if (!userId || !guildId) {
    return;
  }

  try {
    await (hubClient as any).ensureGuildUser(guildId, userId);
    await (hubClient as any).updateUser(guildId, userId, { bannerUrl: null });

    const user = await interaction.client.users.fetch(userId);
    if (user) {
      try {
        await user.send({
          content:
            "Your banner has been removed by a moderator for violating our guidelines.",
        });
      } catch (error) {
        console.error("Could not DM user about banner removal:", error);
      }
    }

    await interaction.reply({
      content: `Banner removed for user ${user?.tag || userId}`,
      ephemeral: true,
    });

    await interaction.message.delete();
  } catch (error) {
    console.error("Error removing banner:", error);
    await interaction.reply({
      content: "Failed to remove banner. Please try again.",
      ephemeral: true,
    });
  }
}

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("setbanner")
      .setDescription("Set a banner for your profile")
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("The image to use as your banner")
          .setRequired(true)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "установитьбаннер",
        uk: "встановитибанер",
      },
      description: {
        ru: "Установить баннер для вашего профиля",
        uk: "Встановити банер для вашого профілю",
      },
    },
    options: {
      image: {
        name: {
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          ru: "Изображение для использования в качестве баннера",
          uk: "Зображення для використання в якості банера",
        },
      },
    },
    title: {
      en: "Banner Set",
      ru: "Баннер установлен",
      uk: "Банер встановлено",
    },
    success: {
      en: "Your banner has been set successfully!",
      ru: "Ваш баннер успешно установлен!",
      uk: "Ваш банер успішно встановлено!",
    },
    error: {
      en: "An error occurred while setting the banner",
      ru: "Произошла ошибка при установке баннера",
      uk: "Виникла помилка під час встановлення банера",
    },
    invalidImage: {
      en: "Please provide a valid image file",
      ru: "Пожалуйста, предоставьте действительный файл изображения",
      uk: "Будь ласка, надайте дійсний файл зображення",
    },
    imageTooLarge: {
      en: "The image file is too large (max 8MB)",
      ru: "Файл изображения слишком большой (максимум 8МБ)",
      uk: "Файл зображення занадто великий (максимум 8МБ)",
    },
    bannerPreview: {
      en: "Banner Preview",
      ru: "Предпросмотр баннера",
      uk: "Попередній перегляд банера",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    if (!isAiContext) {
      await interaction.deferReply();
    }

    const attachment = interaction.options.getAttachment("image");

    try {
      if (!attachment || !attachment.contentType?.startsWith("image/")) {
        await interaction.editReply({
          content: await i18n.__("commands.images.setbanner.invalidImage"),
          ephemeral: true,
        });
        return;
      }

      const maxSize = 8 * 1024 * 1024;
      if (attachment.size > maxSize) {
        await interaction.editReply({
          content: await i18n.__("commands.images.setbanner.imageTooLarge"),
          ephemeral: true,
        });
        return;
      }

      const permanentUrl = await makePermanentAttachment(interaction, attachment);

      await (hubClient as any).ensureGuildUser(interaction.guild.id, interaction.user.id);
      await (hubClient as any).updateUser(interaction.guild.id, interaction.user.id, {
        bannerUrl: permanentUrl,
      });

      try {
        const userData = await (hubClient as any).getUser(
          interaction.guild.id,
          interaction.user.id
        );

        const generated = (await generateImage(
          "Balance",
          {
            interaction: {
              user: {
                id: interaction.user.id,
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                avatarURL: interaction.user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              guild: {
                id: interaction.guild.id,
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
            locale: interaction.locale,
            database: { ...(userData as Record<string, unknown>), bannerUrl: permanentUrl },
            returnDominant: true,
          },
          { image: 2, emoji: 1 },
          i18n as any
        )) as [unknown, unknown];

        const previewBuffer = generated?.[0];
        const _dominantColor = generated?.[1];
        void previewBuffer;
        void _dominantColor;

        const successComponent = new ComponentBuilder({
          mode: builderMode,
          color: 0x00ff00,
        })
          .addText(String(await i18n.__("commands.images.setbanner.title")), "header3")
          .addText(String(await i18n.__("commands.images.setbanner.success")))
          .addImage(permanentUrl)
          .addTimestamp(interaction.locale);

        const replyOptions = successComponent.toReplyOptions({
          content: isAiContext
            ? `${String(await i18n.__("commands.images.setbanner.success"))} Banner URL: ${permanentUrl}`
            : undefined,
        });

        if (isAiContext) {
          await interaction.reply(replyOptions);
        } else {
          await interaction.editReply(replyOptions);
        }
      } catch (previewError) {
        console.error("Error generating banner preview:", previewError);

        const successComponent = new ComponentBuilder({
          mode: builderMode,
          color: 0x00ff00,
        })
          .addText(String(await i18n.__("commands.images.setbanner.title")), "header3")
          .addText(String(await i18n.__("commands.images.setbanner.success")))
          .addTimestamp(interaction.locale);

        const replyOptions = successComponent.toReplyOptions({
          content: isAiContext
            ? `${String(await i18n.__("commands.images.setbanner.success"))} Banner URL: ${permanentUrl}`
            : undefined,
        });

        if (isAiContext) {
          await interaction.reply(replyOptions);
        } else {
          await interaction.editReply(replyOptions);
        }
      }
    } catch (error) {
      console.error("Error setting banner:", error);
      const errorMessage = String(await i18n.__("commands.images.setbanner.error"));
      const errorOptions = {
        content: errorMessage,
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };

      if (isAiContext) {
        throw new Error(errorMessage);
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export { handleRemoveBanner, makePermanentAttachment };
export default command;
