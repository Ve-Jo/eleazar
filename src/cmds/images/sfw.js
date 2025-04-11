import { SlashCommandSubcommandBuilder } from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";

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
    const image = interaction.options.getString("image");

    async function getValidImageUrl() {
      const sources = [
        HMFull.HMtai.sfw,
        HMFull.Nekos.sfw,
        HMFull.NekoBot.sfw,
        HMFull.NekoLove.sfw,
      ];

      for (let attempts = 0; attempts < 3; attempts++) {
        for (const source of sources) {
          if (Object.keys(source).includes(image)) {
            let imageUrl = await source[image]();
            if (typeof imageUrl === "object" && imageUrl.url) {
              imageUrl = imageUrl.url;
            }
            if (
              imageUrl &&
              typeof imageUrl === "string" &&
              imageUrl.startsWith("http")
            ) {
              return imageUrl;
            }
          }
        }
      }
      return null;
    }

    async function createEmbed() {
      const imageUrl = await getValidImageUrl();

      if (!imageUrl) {
        return null;
      }

      return new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(`SFW - ${image}`)
        .setImage(imageUrl)
        .setFooter({
          text: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        });
    }

    const initialEmbed = await createEmbed();

    if (!initialEmbed) {
      return interaction.reply({
        content: i18n.__("commands.images.sfw.notFound"),
        ephemeral: true,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("retry")
        .setEmoji("🔄")
        .setStyle(ButtonStyle.Primary)
    );

    const response = await interaction.reply({
      embeds: [initialEmbed],
      components: [row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      idle: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "retry") {
        const newEmbed = await createEmbed();
        if (newEmbed) {
          await i.update({ embeds: [newEmbed], components: [row] });
        } else {
          await i.reply({
            content: i18n.__("commands.images.sfw.notFound"),
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      row.components[0].setDisabled(true);
      interaction.editReply({ components: [row] }).catch(console.error);
    });
  },
};
