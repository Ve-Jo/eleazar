import { SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import prettyMs from "pretty-ms";
import i18n from "../../utils/i18n.js";
import cooldownsManager from "../../utils/cooldownsManager.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("daily")
    .setDescription("Claim daily reward")
    .setDescriptionLocalizations({
      ru: "Получить ежедневную награду",
      uk: "Отримати щоденну нагороду",
    }),
  async execute(interaction) {
    await EconomyEZ.ensure(
      `timestamps.${interaction.guild.id}.${interaction.user.id}`
    );

    let timeLeft = await cooldownsManager.getCooldownTime(
      interaction.guild.id,
      interaction.user.id,
      "daily"
    );

    if (timeLeft > 0) {
      return interaction.editReply({
        content: i18n.__("economy.dailyCooldown", {
          time: prettyMs(timeLeft, { verbose: true }),
        }),
        ephemeral: true,
      });
    }

    // Fetch the user's upgrade level and multiplier
    const upgradeLevel =
      (await EconomyEZ.get(
        `shop.${interaction.guild.id}.${interaction.user.id}.upgrade_level`
      )) || 1;
    const multiplier = 1 + (upgradeLevel - 1) * 0.15; // Assuming each level increases the multiplier by 15%

    const baseAmount = Math.floor(Math.random() * 90) + 10;
    const amount = Math.floor(baseAmount * multiplier);

    try {
      let newBalance = await EconomyEZ.math(
        `economy.${interaction.guild.id}.${interaction.user.id}.balance`,
        "+",
        amount
      );

      await EconomyEZ.set(
        `timestamps.${interaction.guild.id}.${interaction.user.id}.daily`,
        Date.now()
      );

      timeLeft = await cooldownsManager.getCooldownTime(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      let daily_embed = new EmbedBuilder()
        .setColor(process.env.EMBED_COLOR)
        .setTimestamp()
        .setThumbnail(interaction.user.avatarURL())
        .setAuthor({
          name: i18n.__("economy.title"),
          iconURL: interaction.user.avatarURL(),
        })
        .setFields(
          {
            name: i18n.__("economy.dailyBonus"),
            value: i18n.__("economy.dailyBonusValue", {
              balance: newBalance,
              amount: amount,
            }),
          },
          {
            name: i18n.__("economy.nextDaily"),
            value: i18n.__("economy.nextDailyValue", {
              time: prettyMs(timeLeft, { verbose: true }), // 24 hours in milliseconds
            }),
          }
        );
      await interaction.editReply({ embeds: [daily_embed] });
    } catch (error) {
      console.error("Error updating balance:", error);
      await interaction.editReply({
        content: i18n.__("economy.errorUpdatingBalance"),
        ephemeral: true,
      });
    }
  },
};
