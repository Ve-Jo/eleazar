import { SlashCommandSubcommandBuilder, AttachmentBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import prettyMs from "pretty-ms";
import i18n from "../../utils/i18n.js";
import cooldownsManager from "../../utils/cooldownsManager.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";

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
      const pngBuffer = await generateRemoteImage(
        "Cooldown",
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
          nextDaily: timeLeft,
          emoji: "🎁",
        },
        { width: 450, height: 200 },
        { image: 2, emoji: 2 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "daily_cooldown.png",
      });

      return interaction.editReply({
        files: [attachment],
        content: i18n.__("economy.dailyCooldown", {
          time: prettyMs(timeLeft, { verbose: true }),
        }),
      });
    }

    // Fetch the user's upgrade level and multiplier
    const upgradeId = 1; // Assuming 1 is the ID for the daily bonus upgrade
    const upgradeLevel =
      (await EconomyEZ.get(
        `shop.${interaction.guild.id}.${interaction.user.id}.upgrade_level.${upgradeId}`
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

      const pngBuffer = await generateImage(
        "Daily",
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
          balance: newBalance,
          amount: amount,
        },
        { width: 450, height: 200 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "daily_claimed.png",
      });

      await interaction.editReply({
        files: [attachment],
        content: i18n.__("economy.dailyBonusClaimed", { amount }),
      });
    } catch (error) {
      console.error("Error updating balance:", error);
      await interaction.editReply({
        content: i18n.__("economy.errorUpdatingBalance"),
        ephemeral: true,
      });
    }
  },
};
