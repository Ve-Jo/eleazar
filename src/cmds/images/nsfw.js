import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
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
    const i18nBuilder = new I18nCommandBuilder("images", "nsfw");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add image option
    const imageOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "image",
      description: i18nBuilder.translateOption("image", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("image", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "image",
        "description"
      ),
      choices: [
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
      ],
    });

    subcommand.addOption(imageOption);

    return subcommand;
  },
  async execute(interaction) {
    if (!interaction.channel.nsfw) {
      return interaction.reply({
        content: i18n.__("nsfwChannelOnly"),
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

      const title = i18n.__(`images.nsfw.name`);

      return new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(typeof title === "string" ? title : `NSFW - ${image}`)
        .setImage(imageUrl)
        .setFooter({
          text: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        });
    }

    const initialEmbed = await createEmbed();

    if (!initialEmbed) {
      return interaction.reply({
        content: i18n.__("images.nsfw.notFound"),
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
            content: i18n.__("images.nsfw.notFound"),
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
  localization_strings: {
    name: {
      en: "nsfw",
      ru: "nsfw",
      uk: "nsfw",
    },
    description: {
      en: "Choose a NSFW image",
      ru: "Выберите NSFW изображение",
      uk: "Виберіть NSFW зображення",
    },
    options: {
      image: {
        name: {
          en: "image",
          ru: "изображение",
          uk: "зображення",
        },
        description: {
          en: "Choose an image",
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
};
