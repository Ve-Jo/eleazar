import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("help", "premium");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const premiumFeatures = [
      {
        title: "24/7 Music Player",
        description: "Keep your music playing `non-stop`",
      },
      {
        title: "Database Management",
        description: "Full control over all data in the database",
      },
      {
        title: "Support Role",
        description: "Get a special support role on our server",
      },
      {
        title: "AI Image Generation",
        description: "Generate `beatiful images` with AI",
      },
      {
        title: "Voice-to-Text",
        description: "Voice messages on this server get `transcription by AI`",
      },
      {
        title: "Banners",
        description:
          "Set a banner for any command that will add new customization for `cool-looking commands`",
      },
    ];

    const plans = [
      { name: "1 month", price: "$4.50", discount: "" },
      { name: "3 months", price: "$12.00", discount: "-11%" },
    ];

    const generatePremiumImage = async () => {
      return await generateRemoteImage(
        "PremiumFeaturesDisplay",
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
          features: premiumFeatures,
          plans: plans,
          height: 650,
          width: 950,
        },
        { width: 950, height: 650 }
      );
    };

    const pngBuffer = await generatePremiumImage();
    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "premium_features.png",
    });

    const embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage("attachment://premium_features.png")
      .setAuthor({
        name: i18n.__("help.premiumTitle"),
        iconURL: interaction.user.avatarURL(),
      });

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  },
  localization_strings: {
    name: {
      en: "premium",
      ru: "премиум",
      uk: "преміум",
    },
    description: {
      en: "Information about premium features",
      ru: "Информация о премиум-функциях",
      uk: "Інформація про преміум-функції",
    },
  },
};
