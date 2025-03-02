import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import Database from "../../database/client.js";
import prettyMs from "pretty-ms";
import { generateImage } from "../../utils/imageGenerator.js";

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
  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      // Get user data with upgrades to calculate cooldown reduction
      let userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );

      // Apply cooldown reduction from daily_cooldown upgrade
      const dailyCooldownUpgrade = userData.upgrades.find(
        (u) => u.type === "daily_cooldown"
      );
      const dailyCooldownLevel = dailyCooldownUpgrade?.level || 1;

      // Calculate cooldown reduction (30 minutes per level starting from level 2)
      const cooldownReduction = (dailyCooldownLevel - 1) * (30 * 60 * 1000);

      // Check if cooldown is active (with reduction applied)
      const baseCooldownTime = await Database.getCooldown(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      // Apply cooldown reduction, but ensure it doesn't go below 0
      const cooldownTime = Math.max(0, baseCooldownTime - cooldownReduction);

      if (cooldownTime > 0) {
        let pngBuffer = await generateImage(
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
            database: userData, // Reuse existing userData instead of fetching again
            locale: interaction.locale,
            nextDaily: cooldownTime,
            emoji: "🎁",
          },
          { image: 2, emoji: 2 }
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `daily_cooldown.png`,
        });

        pngBuffer = null;

        return interaction.editReply({
          files: [attachment],
          content: i18n.__("economy.daily.cooldown", {
            time: prettyMs(cooldownTime, { verbose: true }),
          }),
        });
      }

      // We already have userData from the check above, no need to fetch again
      // Apply bonus from daily_bonus upgrade
      const dailyBonusUpgrade = userData.upgrades.find(
        (u) => u.type === "daily_bonus"
      );
      const dailyBonusLevel = dailyBonusUpgrade?.level || 1;
      const multiplier = 1 + (dailyBonusLevel - 1) * 0.15; // 15% increase per level

      const baseAmount = Math.floor(Math.random() * 90) + 10;
      const amount = Math.floor(baseAmount * multiplier);

      // Start transaction for updating cooldown and balance in a single transaction
      await Database.client.$transaction(async (tx) => {
        // Check if tx.cooldowns exists before attempting to use it
        if (!tx.cooldowns) {
          console.error("Cooldowns model is not available in transaction");
          // Use fallback method
          await Database.updateCooldown(
            interaction.guild.id,
            interaction.user.id,
            "daily",
            Date.now()
          );
        } else {
          // Update cooldown using transaction
          await tx.cooldowns.upsert({
            where: {
              userId_guildId: {
                userId: interaction.user.id,
                guildId: interaction.guild.id,
              },
            },
            create: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              data: JSON.stringify({
                daily: Date.now(),
              }),
            },
            update: {
              data: {
                updateMode: "merge",
                value: { daily: Date.now() },
              },
            },
          });
        }

        // Add balance if amount is greater than zero
        if (amount > 0) {
          await tx.economy.upsert({
            where: {
              userId_guildId: {
                userId: interaction.user.id,
                guildId: interaction.guild.id,
              },
            },
            create: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              balance: amount.toString(),
              bankBalance: "0.00000",
              bankRate: "0.00000",
              bankStartTime: 0,
            },
            update: {
              balance: {
                increment: amount,
              },
            },
          });

          // Update statistics
          await tx.statistics.upsert({
            where: {
              userId_guildId: {
                userId: interaction.user.id,
                guildId: interaction.guild.id,
              },
            },
            create: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              totalEarned: amount.toString(),
              messageCount: 0,
              commandCount: 0,
              lastUpdated: Date.now(),
            },
            update: {
              totalEarned: {
                increment: amount,
              },
              lastUpdated: Date.now(),
            },
          });
        }

        // Update user activity
        await tx.user.update({
          where: {
            guildId_id: {
              id: interaction.user.id,
              guildId: interaction.guild.id,
            },
          },
          data: {
            lastActivity: Date.now(),
          },
        });
      });

      // Get updated user data for the image generation
      userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id,
        true
      );

      let pngBuffer = await generateImage(
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
            ...userData,
          },
          returnDominant: false,
          locale: interaction.locale,
          amount: amount,
        },
        { image: 2, emoji: 2 }
      );

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: `daily_claimed.png`,
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
