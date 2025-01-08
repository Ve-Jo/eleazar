import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "shop");

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
    const { guild, user } = interaction;

    try {
      let currentUpgrade = 0;

      const generateShopMessage = async () => {
        // Get user data and available upgrades
        const userData = await EconomyEZ.get(`${guild.id}.${user.id}`);
        const upgrades = await EconomyEZ.getUpgrades(guild.id, user.id);

        const pngBuffer = await generateRemoteImage(
          "UpgradesDisplay",
          {
            interaction: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              guild: {
                id: guild.id,
                name: guild.name,
                iconURL: guild.iconURL({
                  extension: "png",
                  size: 1024,
                }),
              },
            },
            database: userData,
            locale: interaction.locale,
            upgrades: Object.entries(upgrades).map(([key, upgrade], index) => ({
              emoji: upgrade.emoji,
              title: i18n.__(`economy.shop.upgrades.${key}.name`),
              description: i18n.__(`economy.shop.upgrades.${key}.description`, {
                effect: upgrade.effect,
                price: upgrade.price,
              }),
              currentLevel: upgrade.level,
              nextLevel: upgrade.level + 1,
              price: upgrade.price,
              progress: 50,
              id: index,
            })),
            currentUpgrade,
            balance: userData.balance,
          },
          { width: 600, height: 350 },
          { image: 2, emoji: 2 }
        );

        const attachment = new AttachmentBuilder(pngBuffer.buffer, {
          name: `shop.${pngBuffer.contentType === "image/gif" ? "gif" : "png"}`,
        });

        // Create selection menu for switching upgrades
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(i18n.__("economy.shop.selectUpgrade"))
          .addOptions([
            {
              label: i18n.__("economy.shop.upgrades.daily.name"),
              description: i18n.__("economy.shop.upgrades.daily.description", {
                effect: upgrades.daily.effect,
                price: upgrades.daily.price,
              }),
              value: "0",
              emoji: upgrades.daily.emoji,
              default: currentUpgrade === 0,
            },
            {
              label: i18n.__("economy.shop.upgrades.crime.name"),
              description: i18n.__("economy.shop.upgrades.crime.description", {
                effect: upgrades.crime.effect,
                price: upgrades.crime.price,
              }),
              value: "1",
              emoji: upgrades.crime.emoji,
              default: currentUpgrade === 1,
            },
          ]);

        const purchaseButton = new ButtonBuilder()
          .setCustomId("purchase")
          .setLabel(i18n.__("economy.shop.purchaseButton"))
          .setStyle(ButtonStyle.Success);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(purchaseButton);

        const embed = new EmbedBuilder()
          .setColor(process.env.EMBED_COLOR)
          .setAuthor({
            name: i18n.__("economy.shop.title"),
            iconURL: user.displayAvatarURL(),
          })
          .setDescription(
            i18n.__("economy.shop.description", { balance: userData.balance })
          )
          .setImage(
            `attachment://shop.${
              pngBuffer.contentType === "image/gif" ? "gif" : "png"
            }`
          )
          .setTimestamp();

        return {
          embeds: [embed],
          files: [attachment],
          components: [selectRow, buttonRow],
        };
      };

      const message = await interaction.editReply(await generateShopMessage());

      // Create collector for both select menu and button
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "switch_upgrade") {
          currentUpgrade = parseInt(i.values[0]);
          await i.update(await generateShopMessage());
        } else if (i.customId === "purchase") {
          const type = currentUpgrade === 0 ? "daily" : "crime";
          const result = await EconomyEZ.purchaseUpgrade(
            guild.id,
            user.id,
            type
          );

          if (!result.success) {
            await i.reply({
              content: i18n.__("economy.shop.insufficientFunds"),
              ephemeral: true,
            });
            return;
          }

          // Show updated shop with new upgrade level
          await i.update(await generateShopMessage());
          collector.stop();
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          message.edit({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error in shop command:", error);
      await interaction.editReply({
        content: i18n.__("economy.shop.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "shop",
      ru: "магазин",
      uk: "магазин",
    },
    description: {
      en: "View and purchase upgrades",
      ru: "Просмотреть и купить улучшения",
      uk: "Переглянути та купити покращення",
    },
    title: {
      en: "Shop",
      ru: "Магазин",
      uk: "Магазин",
    },
    selectUpgrade: {
      en: "Select an upgrade to view",
      ru: "Выберите улучшение для просмотра",
      uk: "Виберіть покращення для перегляду",
    },
    purchaseButton: {
      en: "Purchase",
      ru: "Купить",
      uk: "Купити",
    },
    insufficientFunds: {
      en: "You don't have enough coins for this upgrade",
      ru: "У вас недостаточно монет для этого улучшения",
      uk: "У вас недостатньо монет для цього покращення",
    },
    noSelection: {
      en: "No upgrade selected",
      ru: "Улучшение не выбрано",
      uk: "Покращення не вибрано",
    },
    purchaseTitle: {
      en: "Purchase Successful",
      ru: "Покупка Успешна",
      uk: "Покупка Успішна",
    },
    purchaseSuccess: {
      en: "Successfully upgraded {{type}} to level {{level}} for {{cost}} coins",
      ru: "Успешно улучшено {{type}} до уровня {{level}} за {{cost}} монет",
      uk: "Успішно покращено {{type}} до рівня {{level}} за {{cost}} монет",
    },
    error: {
      en: "An error occurred while processing your shop request",
      ru: "Произошла ошибка при обработке запроса магазина",
      uk: "Сталася помилка під час обробки запиту магазину",
    },
    upgrades: {
      daily: {
        name: {
          en: "Daily Reward Boost",
          ru: "Усиление Ежедневной Награды",
          uk: "Посилення Щоденної Нагороди",
        },
        description: {
          en: "+{{effect}} reward ({{price}} coins)",
          ru: "+{{effect}} к награде ({{price}} монет)",
          uk: "+{{effect}} до нагороди ({{price}} монет)",
        },
      },
      crime: {
        name: {
          en: "Crime Cooldown Reduction",
          ru: "Уменьшение Перезарядки Преступления",
          uk: "Зменшення Перезарядки Злочину",
        },
        description: {
          en: "-{{effect}} cooldown ({{price}} coins)",
          ru: "-{{effect}} к перезарядке ({{price}} монет)",
          uk: "-{{effect}} до перезарядки ({{price}} монет)",
        },
      },
    },
  },
};
