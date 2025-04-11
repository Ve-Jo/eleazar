import { SlashCommandSubcommandBuilder } from "discord.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";

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
            { name: "GIF", value: "gif" }
          )
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
    if (!interaction.channel.nsfw) {
      return interaction.reply({
        content: i18n.__("commands.images.nsfw.nsfwChannelOnly"),
        ephemeral: true,
      });
    }

    const image = interaction.options.getString("image");

    async function getValidImageUrl() {
      const sources = [
        HMFull.HMtai.nsfw,
        HMFull.Nekos.nsfw,
        HMFull.NekoBot.nsfw,
        HMFull.NekoLove.nsfw,
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
        .setTitle(`NSFW - ${image}`)
        .setImage(imageUrl)
        .setFooter({
          text: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        });
    }

    const initialEmbed = await createEmbed();

    if (!initialEmbed) {
      return interaction.reply({
        content: i18n.__("commands.images.nsfw.notFound"),
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
            content: i18n.__("commands.images.nsfw.notFound"),
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
