import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import HMFull from "hmfull";
import i18n from "../../utils/i18n.js";

const sfwImages = {
  neko: "Неко",
  waifu: "Вайфу",
  foxgirl: "Девушку-лису",
  kanna: "Канну",
  holo: "Холо",
  kemonomimi: "Кемономими",
  kitsune: "Кцунуэ",
  wallpaper: "Обои",
  mobileWallpaper: "Мобильные обои",
  coffee_arts: "Кофейные рисунки",
  neko_arts: "Неко",
  jahy_arts: "Лунное искусство",
  wolf_arts: "Волк",
};

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("sfw")
    .setDescription("Choose a SFW image")
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("Choose an image")
        .setRequired(true)
        .addChoices(
          ...Object.entries(sfwImages).map(([name, description]) => ({
            name: description,
            value: name,
          }))
        )
    ),

  async execute(interaction) {
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

      const title = i18n.__(`images:sfw.${image}`);

      return new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTitle(typeof title === "string" ? title : `SFW - ${image}`)
        .setImage(imageUrl)
        .setFooter({
          text: interaction.user.displayName,
          iconURL: interaction.user.displayAvatarURL(),
        });
    }

    const initialEmbed = await createEmbed();

    if (!initialEmbed) {
      return interaction.reply({
        content: i18n.__("imageNotFound"),
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
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "retry") {
        const newEmbed = await createEmbed();
        if (newEmbed) {
          await i.update({ embeds: [newEmbed], components: [row] });
        } else {
          await i.reply({
            content: i18n.__("imageNotFound"),
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
