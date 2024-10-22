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

const myselfEmotions = {
  blush: "Покраснеть",
  smug: "Самодовольно ухмылятя",
  happy: "Радоваться",
  smile: "Улыбаться",
  dance: "Танцевать",
  like: "Нравиться",
  cry: "Плакать",
  nosebleed: "Кровь из носа",
  depression: "Грустить",
  tea: "Пить чай",
  nom: "Кусать/Есть",
  lick: "Лизнуть",
  sleep: "Спать",
  coffee: "Пить кофе",
  gah: "Удивиться",
};

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("myself")
    .setDescription("Choose your own emotion or action")
    .setDescriptionLocalizations({
      ru: "Выберите вашу эмоцию или действие",
    })
    .addStringOption((option) =>
      option
        .setName("emotion")
        .setDescription("Choose an emotion or action")
        .setDescriptionLocalizations({
          ru: "Выберите эмоцию или действие",
        })
        .setRequired(true)
        .addChoices(
          ...Object.entries(myselfEmotions).map(([name, description]) => ({
            name: description,
            value: name,
          }))
        )
    ),

  async execute(interaction) {
    const emotion = interaction.options.getString("emotion");

    async function getValidImageUrl() {
      const sources = [
        HMFull.HMtai.sfw,
        HMFull.Nekos.sfw,
        HMFull.NekoBot.sfw,
        HMFull.NekoLove.sfw,
      ];

      for (let attempts = 0; attempts < 3; attempts++) {
        for (const source of sources) {
          if (Object.keys(source).includes(emotion)) {
            let imageUrl = await source[emotion]();
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
        .setTitle(i18n.__(`emotions:myself.${emotion}`))
        .setDescription(
          i18n.__(`emotions:myself.description`, {
            user: interaction.user,
            emotion: i18n.__(`emotions:myself.${emotion}`).toLowerCase(),
          })
        )
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
      idle: 60000,
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
