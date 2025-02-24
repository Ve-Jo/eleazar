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
import Database, { UPGRADES } from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";

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
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;

    try {
      let currentUpgrade = 0;

      const generateShopMessage = async () => {
        // Get user data with all relations
        const userData = await Database.getUser(guild.id, user.id);

        // Get upgrade info for each type
        const upgradeInfo = {
          daily: await Database.getUpgradeInfo(
            "daily",
            userData.upgrades.find((u) => u.type === "daily")?.level || 1
          ),
          crime: await Database.getUpgradeInfo(
            "crime",
            userData.upgrades.find((u) => u.type === "crime")?.level || 1
          ),
        };

        const [pngBuffer, dominantColor] = await generateImage(
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
            database: {
              balance: Number(userData.economy?.balance || 0),
              bankBalance: Number(userData.bank?.balance || 0),
              bankRate: userData.bank?.rate || 0,
              totalEarned: Number(userData.stats?.totalEarned || 0),
            },
            locale: interaction.locale,
            upgrades: Object.entries(upgradeInfo).map(
              ([key, upgrade], index) => ({
                emoji: UPGRADES[key].emoji,
                title: i18n.__(`economy.shop.upgrades.${key}.name`),
                description: i18n.__(
                  `economy.shop.upgrades.${key}.description`,
                  {
                    effect:
                      key === "daily" ? upgrade.effect * 100 : upgrade.effect,
                    price: upgrade.price,
                  }
                ),
                currentLevel:
                  userData.upgrades.find((u) => u.type === key)?.level || 1,
                nextLevel:
                  (userData.upgrades.find((u) => u.type === key)?.level || 1) +
                  1,
                price: upgrade.price,
                progress: 50,
                id: index,
              })
            ),
            currentUpgrade,
            balance: Number(userData.economy?.balance || 0),
            dominantColor: "user",
            returnDominant: true,
          },
          { image: 2, emoji: 2 }
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `shop.png`,
        });

        console.log(upgradeInfo);

        // Create selection menu for switching upgrades
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(i18n.__("economy.shop.selectUpgrade"))
          .addOptions([
            {
              label: i18n.__("economy.shop.upgrades.daily.name"),
              description: i18n.__("economy.shop.upgrades.daily.description", {
                effect: upgradeInfo.daily.effect * 100,
                price: upgradeInfo.daily.price,
              }),
              value: "0",
              emoji: UPGRADES["daily"].emoji,
              default: currentUpgrade === 0,
            },
            {
              label: i18n.__("economy.shop.upgrades.crime.name"),
              description: i18n.__("economy.shop.upgrades.crime.description", {
                effect: upgradeInfo.crime.effect,
                price: upgradeInfo.crime.price,
              }),
              value: "1",
              emoji: UPGRADES["crime"].emoji,
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
          .setColor(dominantColor?.embedColor || process.env.EMBED_COLOR)
          .setAuthor({
            name: i18n.__("economy.shop.title"),
            iconURL: user.displayAvatarURL(),
          })
          .setDescription(
            i18n.__("economy.shop.description", {
              balance: Number(userData.economy?.balance || 0),
            })
          )
          .setImage(`attachment://shop.png`)
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

          try {
            await Database.purchaseUpgrade(guild.id, user.id, type);
            // Show updated shop with new upgrade level
            await i.update(await generateShopMessage());
          } catch (error) {
            if (error.message === "Insufficient balance") {
              await i.reply({
                content: i18n.__("economy.shop.insufficientFunds"),
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }

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
          en: "{{effect}}% reward ({{price}} coins)",
          ru: "{{effect}}% к награде ({{price}} монет)",
          uk: "{{effect}}% до нагороди ({{price}} монет)",
        },
      },
      crime: {
        name: {
          en: "Crime Cooldown Reduction",
          ru: "Уменьшение Перезарядки Преступления",
          uk: "Зменшення Перезарядки Злочину",
        },
        description: {
          en: "-{{effect}} minutes cooldown ({{price}} coins)",
          ru: "-{{effect}} минут кулдауна ({{price}} монет)",
          uk: "-{{effect}} хвилин кулдауна ({{price}} монет)",
        },
      },
    },
  },
};
