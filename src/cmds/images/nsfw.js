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

const nsfwImages = {
  anal: "Анал",
  ass: "Попа",
  bdsm: "БДСМ",
  cum: "Сперма",
  creampie: "Сперма в киске",
  manga: "Манга",
  femdom: "Фемдом",
  hentai: "Хентай",
  masturbation: "Мастурбация",
  public: "В общественном месте",
  orgy: "Оргия",
  yuri: "Юри",
  pantsu: "Панталны",
  glasses: "Очки",
  blowjob: "Девушка сосет",
  boobjob: "Сосок",
  footjob: "Стопа",
  handjob: "Рука",
  boobs: "Грудь",
  thighs: "Бедра",
  pussy: "Киска",
  ahegao: "Ахегао",
  uniform: "Униформа",
  gif: "Гифка",
};

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("nsfw")
    .setDescription("Choose a NSFW image")
    .setDescriptionLocalizations({
      ru: "Выберите NSFW изображение",
      uk: "Виберіть NSFW зображення",
    })
    .addStringOption((option) =>
      option
        .setName("image")
        .setDescription("Choose an image")
        .setRequired(true)
        .addChoices(
          ...Object.entries(nsfwImages).map(([name, description]) => ({
            name: description,
            value: name,
          }))
        )
    ),

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

      const title = i18n.__(`images:nsfw.${image}`);

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
