import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import prettyMs from "pretty-ms";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "daily");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();

    try {
      // Check if cooldown is active
      const cooldownTime = await Database.getCooldown(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      if (cooldownTime > 0) {
        let pngBuffer = await generateRemoteImage(
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
            database: await Database.getUser(
              interaction.guild.id,
              interaction.user.id,
              true
            ),
            locale: interaction.locale,
            nextDaily: cooldownTime,
            emoji: "🎁",
          },
          { width: 450, height: 200 },
          { image: 2, emoji: 2 }
        );

        const attachment = new AttachmentBuilder(pngBuffer.buffer, {
          name: `daily_cooldown.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`,
        });

        pngBuffer = null;

        return interaction.editReply({
          files: [attachment],
          content: i18n.__("economy.daily.cooldown", {
            time: prettyMs(cooldownTime, { verbose: true }),
          }),
        });
      }

      // Get user data with upgrades
      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );
      const dailyUpgrade = userData.upgrades.find((u) => u.type === "daily");
      const dailyLevel = dailyUpgrade?.level || 1;
      const multiplier = 1 + (dailyLevel - 1) * 0.15; // 15% increase per level

      const baseAmount = Math.floor(Math.random() * 90) + 10;
      const amount = Math.floor(baseAmount * multiplier);

      // Start transaction for updating cooldown and balance
      await Database.client.$transaction(async (tx) => {
        // Update cooldown
        await Database.updateCooldown(
          interaction.guild.id,
          interaction.user.id,
          "daily"
        );

        // Add balance
        await Database.addBalance(
          interaction.guild.id,
          interaction.user.id,
          amount
        );
      });

      // Get updated user data for the image
      const updatedData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      let pngBuffer = await generateRemoteImage(
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
          database: {
            balance: Number(updatedData.economy?.balance || 0),
            bankBalance: Number(updatedData.economy?.bankBalance || 0),
            bankRate: updatedData.economy?.bankRate || 0,
            totalEarned: Number(updatedData.stats?.totalEarned || 0),
          },
          locale: interaction.locale,
          amount: amount,
        },
        { width: 450, height: 200 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `daily_claimed.${
          pngBuffer.contentType === "image/gif" ? "gif" : "png"
        }`,
      });

      pngBuffer = null;

      await interaction.editReply({
        files: [attachment],
        content: i18n.__("economy.daily.bonusClaimed", { amount }),
      });
    } catch (error) {
      console.error("Error in daily command:", error);
      await interaction.editReply({
        content: i18n.__("economy.daily.errorUpdatingBalance"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "daily",
      ru: "ежедневное",
      uk: "щоденне",
    },
    description: {
      en: "Claim daily reward",
      ru: "Получить ежедневную награду",
      uk: "Отримати щоденну нагороду",
    },
    cooldown: {
      en: "You have to wait {{time}} to claim your daily reward",
      ru: "Вам нужно подождать {{time}} чтобы получить свою ежедневную награду",
      uk: "Вам потрібно почекати {{time}} щоб отримати свою щоденну нагороду",
    },
    bonusClaimed: {
      en: "You have claimed your daily reward of {{amount}} coins",
      ru: "Вы получили свою ежедневную награду в размере {{amount}} монет",
      uk: "Ви отримали свою щоденну нагороду в розмірі {{amount}} монет",
    },
    errorUpdatingBalance: {
      en: "Error updating balance",
      ru: "Ошибка обновления баланса",
      uk: "Помилка оновлення балансу",
    },
  },
};
