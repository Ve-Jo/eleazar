import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("balance")
    .setDescription("Check balance")
    .setDescriptionLocalizations({
      ru: "Посмотреть баланс",
      uk: "Переглянути баланс",
    })
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to check")
        .setDescriptionLocalizations({
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        })
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getMember("user") || interaction.user;
    const userData = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${user.id}`
    );

    if (!userData) {
      return interaction.editReply({
        content: i18n.__("economy.userNotFound"),
        ephemeral: true,
      });
    }

    console.log(userData);

    let pngBuffer = await generateRemoteImage(
      "Balance",
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
        targetUser: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarURL: user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
        },
        database: userData,
      },
      { width: 400, height: 200 },
      { image: 2, emoji: 1 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "balance.png",
    });

    // Clear the buffer
    pngBuffer = null;

    let balance_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage("attachment://balance.png")
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: user.avatarURL(),
      });

    await interaction.editReply({
      embeds: [balance_embed],
      files: [attachment],
    });
  },
};
