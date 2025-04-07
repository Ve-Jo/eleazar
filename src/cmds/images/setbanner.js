import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import axios from "axios";

const BANNER_LOGS = {
  guildId: "1282078106202669148",
  channelId: "1306739210715140116",
};

async function makePermanentAttachment(interaction, attachment) {
  try {
    // Download the attachment
    const response = await axios.get(attachment.url, {
      responseType: "arraybuffer",
    });

    const tempAttachment = new AttachmentBuilder(response.data, {
      name: `banner.${attachment.contentType.split("/")[1]}`,
      description: "User banner image",
    });

    // Get the mod channel
    const modGuild = interaction.client.guilds.cache.get(BANNER_LOGS.guildId);
    if (!modGuild) throw new Error("Mod guild not found");

    const modChannel = modGuild.channels.cache.get(BANNER_LOGS.channelId);
    if (!modChannel) throw new Error("Mod channel not found");

    // Create the embed
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
          value: attachment.name,
        }
      )
      .setTimestamp();

    // Send both the attachment and embed in one message
    const storageMsg = await modChannel.send({
      embeds: [modEmbed],
      files: [tempAttachment],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              label: "Remove Banner",
              custom_id: `remove_banner:${interaction.user.id}:${interaction.guild.id}`,
            },
          ],
        },
      ],
    });

    // Get the permanent URL from the sent message
    const permanentUrl = storageMsg.attachments.first().url;

    // Update the embed to include the image now that we have the permanent URL
    modEmbed.setImage(permanentUrl);
    await storageMsg.edit({ embeds: [modEmbed] });

    return permanentUrl;
  } catch (error) {
    console.error("Error making permanent attachment:", error);
    throw error;
  }
}

// Add this function to handle the remove banner button
export async function handleRemoveBanner(interaction) {
  if (!interaction.customId.startsWith("remove_banner:")) return;

  const [, userId, guildId] = interaction.customId.split(":");

  try {
    // Remove the banner
    await Database.client.user.update({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      data: {
        bannerUrl: null,
      },
    });

    // Try to notify the user
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

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("setbanner")
      .setDescription("Set a banner for your profile")
      .addAttachmentOption((option) =>
        option
          .setName("image")
          .setDescription("The image to use as your banner")
          .setRequired(true)
      );

    return builder;
  },

  // Define localization strings directly in the command
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const attachment = interaction.options.getAttachment("image");

    try {
      // Validate attachment
      if (!attachment.contentType?.startsWith("image/")) {
        return interaction.editReply({
          content: i18n.__("invalidImage"),
          ephemeral: true,
        });
      }

      const MAX_SIZE = 8 * 1024 * 1024;
      if (attachment.size > MAX_SIZE) {
        return interaction.editReply({
          content: i18n.__("imageTooLarge"),
          ephemeral: true,
        });
      }

      // Validate the URL and ensure it's accessible
      try {
        const response = await axios.head(attachment.url);
        if (!response.headers["content-type"]?.startsWith("image/")) {
          return interaction.editReply({
            content: i18n.__("invalidImage"),
            ephemeral: true,
          });
        }
      } catch (error) {
        console.error("Error validating image URL:", error);
        return interaction.editReply({
          content: i18n.__("invalidImage"),
          ephemeral: true,
        });
      }

      // Upload the image to our storage
      const permanentUrl = await makePermanentAttachment(
        interaction,
        attachment
      );

      // Store the banner URL in the database
      await Database.client.user.upsert({
        where: {
          guildId_id: {
            guildId: interaction.guild.id,
            id: interaction.user.id,
          },
        },
        update: {
          bannerUrl: permanentUrl,
        },
        create: {
          guildId: interaction.guild.id,
          id: interaction.user.id,
          bannerUrl: permanentUrl,
        },
      });

      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      // Create a preview of the banner using the image generator
      const [previewBuffer, dominantColor] = await generateImage(
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
          bannerUrl: permanentUrl,
          locale: interaction.locale,
          returnDominant: true,
          database: {
            ...userData,
          },
        },
        { image: 2, emoji: 1 }
      );

      if (!previewBuffer) {
        throw new Error("Failed to generate banner preview");
      }

      const previewAttachment = new AttachmentBuilder(previewBuffer, {
        name: "banner_preview.png",
      });

      const embed = new EmbedBuilder()
        .setColor(dominantColor?.embedColor ?? 0x0099ff)
        .setTimestamp()
        .setImage("attachment://banner_preview.png")
        .setAuthor({
          name: i18n.__("title"),
          iconURL: interaction.user.displayAvatarURL(),
        });

      await interaction.editReply({
        content: i18n.__("success"),
        embeds: [embed],
        files: [previewAttachment],
      });
    } catch (error) {
      console.error("Error setting banner:", error);
      await interaction.editReply({
        content: i18n.__("error"),
        ephemeral: true,
      });
    }
  },
};
