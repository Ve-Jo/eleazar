import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { AttachmentBuilder } from "discord.js";
import EconomyEZ from "../../utils/economy.js";
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
      const isOnCooldown = await EconomyEZ.isCooldownActive(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      if (isOnCooldown) {
        const timeLeft = await EconomyEZ.getCooldownTime(
          interaction.guild.id,
          interaction.user.id,
          "daily"
        );

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
            database: await EconomyEZ.get(
              `${interaction.guild.id}.${interaction.user.id}`
            ),
            locale: interaction.locale,
            nextDaily: timeLeft,
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
            time: prettyMs(timeLeft, { verbose: true }),
          }),
        });
      }

      // Get user's daily bonus upgrade info
      const userData = await EconomyEZ.get(
        `${interaction.guild.id}.${interaction.user.id}`
      );
      console.log(userData);
      const dailyLevel = userData.upgrades.daily.level;
      const multiplier = 1 + (dailyLevel - 1) * 0.15; // 15% increase per level

      const baseAmount = Math.floor(Math.random() * 90) + 10;
      const amount = Math.floor(baseAmount * multiplier);

      // Update cooldown first
      await EconomyEZ.updateCooldown(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      // Then update balance and get the result
      const updatedData = await EconomyEZ.math(
        `${interaction.guild.id}.${interaction.user.id}.balance`,
        "+",
        amount
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
          database: updatedData,
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
