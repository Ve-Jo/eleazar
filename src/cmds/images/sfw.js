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

const sfwImages = [
  "neko",
  "waifu",
  "foxgirl",
  "kanna",
  "holo",
  "kemonomimi",
  "kitsune",
  "wallpaper",
  "mobileWallpaper",
  "coffee_arts",
  "neko_arts",
  "jahy_arts",
  "wolf_arts",
];

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("sfw")
      .setDescription("Choose a SFW image")
      .addStringOption((option) =>
        option
          .setName("image")
          .setDescription("Choose an image")
          .setRequired(true)
          .addChoices(
            ...sfwImages.map((key) => ({
              name: key,
              value: key,
            }))
          )
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        ru: "sfw",
        uk: "sfw",
      },
      description: {
        ru: "Выберите безопасное изображение",
        uk: "Виберіть безпечне зображення",
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
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const category = interaction.options.getString("image");
    const { guild, user } = interaction;

    // Restore original image fetching logic
    async function getImageData() {
      try {
        const sources = [
          HMFull.HMtai.sfw,
          HMFull.Nekos.sfw,
          HMFull.NekoBot.sfw,
          HMFull.NekoLove.sfw,
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
        console.error(`Error fetching ${category} image:`, error);
        return null;
      }
    }

    let imageData = await getImageData();

    const generateImageMessage = async (options = {}) => {
      const { disableInteractions = false } = options;

      // Validate fetched data
      if (!imageData || !imageData.url) {
        console.warn("Invalid or missing image URL for sfw image:", category);
        imageData = await getImageData(); // Retry fetch
        if (!imageData || !imageData.url) {
          return {
            content: i18n.__("commands.images.sfw.notFound"),
            components: [],
            ephemeral: true,
          };
        }
      }

      // Use ComponentBuilder directly with the fetched image URL
      const imageComponent = new ComponentBuilder()
        .setColor(process.env.EMBED_COLOR ?? 0x0099ff)
        .addText(
          imageData.category || i18n.__("commands.images.sfw.title"), // Use category as title
          "header3"
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

      return {
        components: [imageComponent.build()],
        flags: MessageFlags.IsComponentsV2,
      };
    };

    let initialMessageData = await generateImageMessage();
    if (initialMessageData.content) {
      return interaction.editReply(initialMessageData);
    }
    const message = await interaction.editReply(initialMessageData);

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "next_image") {
        await i.deferUpdate();
        imageData = await getImageData();
        const newMessageData = await generateImageMessage();
        if (newMessageData.content) {
          await i.followUp({ ...newMessageData, ephemeral: true });
        } else {
          await i.editReply(newMessageData);
        }
      }
    });

    collector.on("end", async () => {
      if (message.editable) {
        try {
          const finalMessageData = await generateImageMessage({
            disableInteractions: true,
          });
          if (!finalMessageData.content) {
            await message.edit(finalMessageData);
          }
        } catch (error) {
          console.error("Error updating components on end:", error);
          await message.edit({ components: [] }).catch(() => {});
        }
      }
    });
  },
};
