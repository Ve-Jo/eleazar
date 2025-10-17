import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import HMFull from "hmfull";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("nsfw")
      .setDescription("Choose a NSFW image")
      .addStringOption((option) =>
        option
          .setName("image")
          .setDescription("Choose an image")
          .setRequired(true)
          .addChoices(
            { name: "Anal", value: "anal" },
            { name: "Ass", value: "ass" },
            { name: "BDSM", value: "bdsm" },
            { name: "Cum", value: "cum" },
            { name: "Creampie", value: "creampie" },
            { name: "Manga", value: "manga" },
            { name: "Femdom", value: "femdom" },
            { name: "Hentai", value: "hentai" },
            { name: "Masturbation", value: "masturbation" },
            { name: "Public", value: "public" },
            { name: "Orgy", value: "orgy" },
            { name: "Yuri", value: "yuri" },
            { name: "Pantsu", value: "pantsu" },
            { name: "Glasses", value: "glasses" },
            { name: "Blowjob", value: "blowjob" },
            { name: "Boobjob", value: "boobjob" },
            { name: "Footjob", value: "footjob" },
            { name: "Handjob", value: "handjob" },
            { name: "Boobs", value: "boobs" },
            { name: "Thighs", value: "thighs" },
            { name: "Pussy", value: "pussy" },
            { name: "Ahegao", value: "ahegao" },
            { name: "Uniform", value: "uniform" },
            { name: "GIF", value: "gif" },
          ),
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        ru: "nsfw",
        uk: "nsfw",
      },
      description: {
        ru: "Выберите NSFW изображение",
        uk: "Виберіть NSFW зображення",
      },
    },
    options: {
      image: {
        name: {
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          ru: "Выберите изображение",
          uk: "Виберіть зображення",
        },
      },
    },
    notFound: {
      en: "Image not found",
      ru: "Изображение не найдено",
      uk: "Зображення не знайдено",
    },
    nsfwChannelOnly: {
      en: "This command can only be used in NSFW channels",
      ru: "Эта команда может быть использована только в NSFW каналах",
      uk: "Ця команда може бути використана тільки в NSFW каналах",
    },
  },

  async execute(interaction, i18n) {
    // Determine builder mode based on execution context
    const isAiContext = !!interaction._isAiProxy;
    const builderMode = isAiContext ? "v1" : "v2";

    // Check NSFW channel
    if (!interaction.channel.nsfw) {
      return interaction.reply({
        content: await i18n.__("commands.images.nsfw.nsfwChannelOnly"),
        ephemeral: true,
      });
    }

    // Defer only for normal context
    if (!isAiContext) {
      await interaction.deferReply();
    }

    const category = interaction.options.getString("image");
    const { guild, user } = interaction;

    // Restore original image fetching logic
    async function getImageData() {
      try {
        const sources = [
          HMFull.HMtai.nsfw, // Using NSFW sources
          HMFull.Nekos.nsfw,
          HMFull.NekoBot.nsfw,
          HMFull.NekoLove.nsfw,
        ];

        for (let attempts = 0; attempts < 3; attempts++) {
          for (const source of sources) {
            if (Object.keys(source).includes(category)) {
              let imageUrl = await source[category]();
              if (typeof imageUrl === "object" && imageUrl.url) {
                imageUrl = imageUrl.url;
              }
              if (
                imageUrl &&
                typeof imageUrl === "string" &&
                imageUrl.startsWith("http")
              ) {
                return {
                  url: imageUrl,
                  category: category,
                };
              }
            }
          }
        }
        return null;
      } catch (error) {
        console.error(`Error fetching ${category} NSFW image:`, error);
        return null;
      }
    }

    let imageData = await getImageData();

    const generateImageMessage = async (options = {}) => {
      const { disableInteractions = false } = options;

      // Validate fetched data
      if (!imageData || !imageData.url) {
        console.warn("Invalid or missing image URL for nsfw image:", category);
        imageData = await getImageData(); // Retry fetch
        if (!imageData || !imageData.url) {
          return {
            content: await i18n.__("commands.images.nsfw.notFound"),
            components: [],
            embeds: [], // Ensure empty arrays for V1
            ephemeral: true,
          };
        }
      }

      // Use ComponentBuilder directly with the fetched image URL
      const imageComponent = new ComponentBuilder({
        mode: builderMode,
        // color: process.env.EMBED_COLOR ?? 0x0099ff
      })
        .addText(
          imageData.category || (await i18n.__("commands.images.nsfw.title")), // Use category as title
          "header3",
        )
        .addImage(imageData.url) // Use direct URL
        .addTimestamp(interaction.locale);

      // Define action row (button) but don't add it yet
      const nextButton = new ButtonBuilder()
        .setCustomId("next_image")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary);

      const buttonRow = new ActionRowBuilder().addComponents(nextButton);

      // Conditionally add the button row
      if (!disableInteractions) {
        imageComponent.addActionRow(buttonRow);
      }

      // Return reply options using the builder
      return imageComponent.toReplyOptions({
        // Use the category name as string content for V1
        content: isAiContext ? imageData.category : undefined,
        // Ensure ephemeral for NSFW replies in normal context
        ephemeral: !isAiContext ? true : undefined,
      });
    };

    let initialMessageData = await generateImageMessage();
    if (initialMessageData.content && !imageData?.url) {
      // Check if it's an error message
      // Handle error reply/edit based on context
      if (isAiContext) {
        throw new Error(initialMessageData.content);
      } else {
        return interaction.editReply(initialMessageData);
      }
    }

    // Reply/edit based on context
    let message;
    if (isAiContext) {
      message = await interaction.reply(initialMessageData);
      // No collector for AI
    } else {
      message = await interaction.editReply(initialMessageData);

      // Collector only for normal context
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "next_image") {
          await i.deferUpdate();
          imageData = await getImageData(); // Fetch new image data
          const newMessageData = await generateImageMessage();
          if (newMessageData.content && !imageData?.url) {
            // Check for error
            await i.followUp({ ...newMessageData, ephemeral: true });
          } else {
            await i.editReply(newMessageData);
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "messageDelete" && message.editable) {
          try {
            const finalMessageData = await generateImageMessage({
              disableInteractions: true,
            });
            if (!finalMessageData.content) {
              await message.edit(finalMessageData);
            }
          } catch (error) {
            console.error("Error removing components on end:", error);
            await message.edit({ components: [] }).catch(() => {}); // Fallback
          }
        }
      });
    }
  },
};
