import {
  SlashCommandSubcommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import prettyMilliseconds from "pretty-ms";
import cooldownsManager from "../../utils/cooldownsManager.js";
import Balance from "../../components/Balance.jsx";
import { generateImage } from "../../utils/imageGenerator.js";

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
    /*await interaction.deferReply();*/

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
    // Generate the balance image
    const pngBuffer = await generateImage(
      Balance,
      {
        interaction: interaction,
        database: userData,
      },
      { width: 400, height: 200 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "balance.png",
    });

    let balance_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage("attachment://balance.png")
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: user.avatarURL(),
      });

    /*let timestamps_list = ["crime", "daily", "work"];
    let timestamps_text = "```diff\n";
    for (const timestamp of timestamps_list) {
      if (timestamp === "work") {
        timestamps_text += `+ ${timestamp}: ${i18n.__("economy.available")}\n`;
        continue;
      }

      const timeLeft = await cooldownsManager.getCooldownTime(
        interaction.guild.id,
        user.id,
        timestamp
      );

      if (timeLeft > 0) {
        timestamps_text += `- ${timestamp}: ${prettyMilliseconds(timeLeft)}\n`;
      } else {
        timestamps_text += `+ ${timestamp}: ${i18n.__("economy.available")}\n`;
      }
    }

    timestamps_text += "```";

    balance_embed.addFields({
      name: i18n.__("economy.currentTimestamps"),
      value: timestamps_text,
    });*/

    await interaction.editReply({
      embeds: [balance_embed],
      files: [attachment],
    });
  },
};
