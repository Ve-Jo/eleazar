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

const positiveEmotions = {
  wave: "Помахать",
  wink: "Подмигнуть",
  pat: "Погладить",
  kiss: "Поцеловать",
  feed: "Покормить",
  hug: "Обнять",
  cuddle: "Прижаться",
  five: "Дать пять",
  glomp: "Броситься обнимать",
  hold: "Держать",
  boop: "Легонько ткнуть",
};

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("positive")
    .setDescription("Choose a positive emotion with a user")
    .setDescriptionLocalizations({
      ru: "Выберите позитивную эмоцию с пользователем",
    })
    .addStringOption((option) =>
      option
        .setName("emotion")
        .setDescription("Choose an emotion")
        .setDescriptionLocalizations({
          ru: "Выберите эмоцию",
        })
        .setRequired(true)
        .addChoices(
          ...Object.entries(positiveEmotions).map(([name, description]) => ({
            name: description,
            value: name,
          }))
        )
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setNameLocalizations({
          ru: "пользователь",
        })
        .setDescription("Choose a user")
        .setDescriptionLocalizations({
          ru: "Выберите пользователя",
        })
        .setRequired(true)
    ),

  async execute(interaction) {
    const emotion = interaction.options.getString("emotion");
    const targetUser = interaction.options.getUser("user");

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: i18n.__("cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: i18n.__("cannotSelectBot"),
        ephemeral: true,
      });
    }

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
        .setTitle(i18n.__(`emotions:positive.${emotion}`))
        .setDescription(
          i18n.__(`emotions:positive.description`, {
            user: interaction.user,
            targetUser: targetUser,
            emotion: i18n.__(`emotions:positive.${emotion}`).toLowerCase(),
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
