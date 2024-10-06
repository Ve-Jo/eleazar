import { SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";

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

    if (initialUser.balance < amount) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFunds"),
        ephemeral: true,
      });
    }

    await EconomyEZ.set(
      `economy.${interaction.guild.id}.${interaction.user.id}.balance`,
      {
        balance: initialUser.balance - amountInt,
        bank: initialUser.bank + amountInt,
      }
    );

    const updatedUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let deposit_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setThumbnail(interaction.user.avatarURL())
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: interaction.user.avatarURL(),
      })
      .setFields({
        name: i18n.__("economy.deposit"),
        value: i18n.__("economy.depositValue", {
          amount: amountInt,
          balance: updatedUser.balance,
          bank: updatedUser.bank,
        }),
      });
    await interaction.editReply({ embeds: [deposit_embed] });
  },
};
