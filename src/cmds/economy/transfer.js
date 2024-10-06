import { SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("transfer")
    .setDescription("Withdraw money from the bank")
    .setDescriptionLocalizations({
      ru: "Снять деньги с банковского счета",
      uk: "Зняти гроші з банківського рахунку",
    })
    .addStringOption((option) =>
      option
        .setName("amount")
        .setDescription('Amount to withdraw (or "all", "half")')
        .setDescriptionLocalizations({
          ru: 'Сумма для снятия (или "all", "half")',
          uk: 'Сума для зняття (або "all", "half")',
        })
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to transfer to")
        .setDescriptionLocalizations({
          ru: "Пользователь для перевода",
          uk: "Користувач для переказу",
        })
        .setRequired(true)
    ),
  async execute(interaction) {
    const targetUser = interaction.options.getMember("user");
    const amount = interaction.options.getString("amount");

    //if its bot
    if (targetUser.user.bot) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectBot"),
        ephemeral: true,
      });
    }

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

    const targetUserData = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${targetUser.id}`
    );

    if (!targetUserData) {
      return interaction.editReply({
        content: i18n.__("economy.userNotFound"),
        ephemeral: true,
      });
    }
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (initialUser.balance < amountInt) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFunds"),
        ephemeral: true,
      });
    }

    await EconomyEZ.math(
      `economy.${interaction.guild.id}.${interaction.user.id}.balance`,
      "-",
      amountInt
    );
    await EconomyEZ.math(
      `economy.${interaction.guild.id}.${targetUser.id}.balance`,
      "+",
      amountInt
    );

    const updatedUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${interaction.user.id}`
    );
    const updatedTargetUser = await EconomyEZ.get(
      `economy.${interaction.guild.id}.${targetUser.id}`
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
        name: i18n.__("economy.transfer"),
        value: i18n.__("economy.transferValue", {
          senderBalance: updatedUser.balance,
          targetBalance: updatedTargetUser.balance,
          amount: amountInt,
        }),
      });
    await interaction.editReply({ embeds: [withdraw_embed] });
  },
};
