import { SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import i18n from "../../utils/i18n.js";
import prettyMs from "pretty-ms";
import cooldownsManager from "../../utils/cooldownsManager.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("crime")
    .setDescription("Attempt to steal cash from another user")
    .setDescriptionLocalizations({
      ru: "Попытаться украсть деньги у другого пользователя",
      uk: "Спробувати вкрасти гроші у іншого користувача",
    })
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user you want to steal from")
        .setDescriptionLocalizations({
          ru: "Пользователь, у которого вы хотите украсть",
          uk: "Користувач, у якого ви хочете вкрасти",
        })
        .setRequired(true)
    ),
  async execute(interaction) {
    const target = interaction.options.getUser("target");
    const user = interaction.user;
    const guildId = interaction.guild.id;

    if (target.id === user.id) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectSelf"),
        ephemeral: true,
      });
    }

    if (target.bot) {
      return interaction.editReply({
        content: i18n.__("economy.cannotSelectBot"),
        ephemeral: true,
      });
    }

    const userData = await EconomyEZ.get(`economy.${guildId}.${user.id}`);
    const targetData = await EconomyEZ.get(`economy.${guildId}.${target.id}`);

    if (!targetData) {
      return interaction.editReply({
        content: i18n.__("economy.userNotFound"),
        ephemeral: true,
      });
    }

    const timeLeft = await cooldownsManager.getCooldownTime(
      guildId,
      user.id,
      "crime"
    );

    if (timeLeft > 0) {
      return interaction.editReply({
        content: i18n.__("economy.crimeCooldown", {
          time: prettyMs(timeLeft, { verbose: true }),
        }),
        ephemeral: true,
      });
    }

    const userCash = userData.balance;
    const targetCash = targetData.balance;

    if (userCash < targetCash / 5) {
      return interaction.editReply({
        content: i18n.__("economy.insufficientFundsForCrime"),
        ephemeral: true,
      });
    }

    const success = Math.random() < 0.5; // 50% chance of success
    let amount;
    let description;

    if (success) {
      amount = Math.floor(Math.random() * (targetCash / 2));
      await EconomyEZ.math(
        `economy.${guildId}.${user.id}.balance`,
        "+",
        amount
      );
      await EconomyEZ.math(
        `economy.${guildId}.${target.id}.balance`,
        "-",
        amount
      );
      description = i18n.__("economy.crimeSuccess", { amount });
    } else {
      amount = Math.floor(Math.random() * (userCash / 2));
      await EconomyEZ.math(
        `economy.${guildId}.${user.id}.balance`,
        "-",
        amount
      );
      await EconomyEZ.math(
        `economy.${guildId}.${target.id}.balance`,
        "+",
        amount
      );
      description = i18n.__("economy.crimeFailure", { amount });
    }

    await EconomyEZ.set(`timestamps.${guildId}.${user.id}.crime`, Date.now());

    let updatedUserBalance = await EconomyEZ.get(
      `economy.${guildId}.${user.id}.balance`
    );

    const embed = new EmbedBuilder()
      .setColor(process.env.EMBED_COLOR)
      .setTimestamp()
      .setThumbnail(user.avatarURL())
      .setAuthor({
        name: i18n.__("economy.title"),
        iconURL: user.avatarURL(),
      })
      .setDescription(description)
      .addFields({
        name: i18n.__("economy.balance"),
        value: `\`\`\`diff\n${success ? "+" : "-"} ${updatedUserBalance} 💵 (${
          success ? "+" : "-"
        }${amount} 💵)\`\`\``,
        inline: true,
      });

    await interaction.editReply({ embeds: [embed] });
  },
};
