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
    .setName("deposit")
    .setDescription("Deposit money")
    .setDescriptionLocalizations({
      ru: "Положить деньги на счет",
      uk: "Покласти гроші на рахунок",
    })
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription('Amount to deposit (or "all", "half")')
        .setDescriptionLocalizations({
          ru: "Сумма для внесения (или 'all', 'half')",
          uk: "Сума для внесення (або 'all', 'half')",
        })
        .setRequired(true)
    ),
  async execute(interaction) {
    const amount = interaction.options.getString("amount");

    const initialUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let amountInt = 0;
    if (amount === "all") {
      amountInt = initialUser.balance;
    } else if (amount === "half") {
      amountInt = Math.floor(initialUser.balance / 2);
    } else {
      amountInt = parseInt(amount);
    }
    if (amountInt <= 0) {
      return interaction.editReply({
        content: i18n.__("economy.amountGreaterThanZero"),
        ephemeral: true,
      });
    }

    if (initialUser.balance < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFunds"),
        ephemeral: true,
      });
    }

    const updatedUser = {
      balance: initialUser.balance - amountInt,
      bank: initialUser.bank + amountInt,
    };

    await EconomyEZ.set(
      `economy.${interaction.guild.id}.${interaction.user.id}`,
      updatedUser
    );

    // Generate the transfer image
    const pngBuffer = await generateRemoteImage(
      "Transfer",
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
        database: updatedUser,
        amount: amountInt,
        isDeposit: true,
      },
      { width: 400, height: 200 }
    );

    const attachment = new AttachmentBuilder(pngBuffer, {
      name: "deposit.png",
    });

    let deposit_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setImage("attachment://deposit.png")
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: interaction.user.avatarURL(),
      });

    await interaction.editReply({
      embeds: [deposit_embed],
      files: [attachment],
    });
  },
};
