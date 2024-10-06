import { SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("withdraw")
    .setDescription("Withdraw money")
    .setDescriptionLocalizations({
      ru: "Снять деньги со счета",
      uk: "Зняти гроші з рахунку",
    })
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount to withdraw (or 'all', 'half')")
        .setDescriptionLocalizations({
          ru: "Сумма для снятия (или 'all', 'half')",
          uk: "Сума для зняття (або 'all', 'half')",
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
      amountInt = initialUser.bank;
    } else if (amount === "half") {
      amountInt = Math.floor(initialUser.bank / 2);
    } else {
      amountInt = parseInt(amount);
    }

    if (initialUser.bank < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFunds"),
        ephemeral: true,
      });
    }
    if (amountInt <= 0) {
      return interaction.editReply({
        content: i18n.__("economy.amountGreaterThanZero"),
        ephemeral: true,
      });
    }

    await EconomyEZ.set(
      `economy.${interaction.guild.id}.${interaction.user.id}.bank`,
      {
        bank: initialUser.bank - amountInt,
        balance: initialUser.balance + amountInt,
      }
    );

    const updatedUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );

    let withdraw_embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setThumbnail(interaction.user.avatarURL())
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: interaction.user.avatarURL(),
      })
      .setFields({
        name: i18n.__("economy.withdraw"),
        value: i18n.__("economy.withdrawValue", {
          amount: amountInt,
          balance: updatedUser.balance,
          bank: updatedUser.bank,
        }),
        inline: true,
      });
    await interaction.editReply({ embeds: [withdraw_embed] });
  },
};
