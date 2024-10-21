import {
  SlashCommandSubcommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import PremiumFeaturesDisplay from "../../components/PremiumFeaturesDisplay.jsx";
import { generateImage } from "../../utils/imageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("premium")
    .setDescription("Information about premium features"),
  async execute(interaction) {
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
      return await generateImage(
        PremiumFeaturesDisplay,
        {
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
};
