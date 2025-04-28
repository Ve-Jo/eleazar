import {
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import Database, { UPGRADES } from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
// Import the UpgradesDisplay component to access its localizations
import UpgradesDisplay from "../../render-server/components/UpgradesDisplay.jsx";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("shop")
      .setDescription("View and purchase upgrades");

    return builder;
  },

  localization_strings: {
    command: {
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
    category_economy: {
      en: "Economy Upgrades",
      ru: "Улучшения Экономики",
      uk: "Покращення Економіки",
    },
    category_cooldowns: {
      en: "Cooldown Upgrades",
      ru: "Улучшения Перезарядки",
      uk: "Покращення Перезарядки",
    },
    revertButton: {
      en: "Revert",
      ru: "Отменить",
      uk: "Відмінити",
    },
    revertButtonWithRefund: {
      en: "Revert (-1 lvl, +{{refund}} coins)",
      ru: "Отменить (-1 ур., +{{refund}} монет)",
      uk: "Відмінити (-1 рів., +{{refund}} монет)",
    },
    revertSuccess: {
      en: "Successfully reverted {{type}} to level {{level}} and received {{refund}} coins (85% refund)",
      ru: "Успешно отменено улучшение {{type}} до уровня {{level}} и получено {{refund}} монет (85% возврат)",
      uk: "Успішно відмінено покращення {{type}} до рівня {{level}} і отримано {{refund}} монет (85% повернення)",
    },
    revertCooldown: {
      en: "Cooldown active. You can revert another upgrade in {{minutes}} minutes",
      ru: "Перезарядка активна. Вы можете отменить другое улучшение через {{minutes}} минут",
      uk: "Перезарядка активна. Ви можете відмінити інше покращення через {{minutes}} хвилин",
    },
    cannotRevert: {
      en: "Cannot revert a level 1 upgrade",
      ru: "Невозможно отменить улучшение уровня 1",
      uk: "Неможливо відмінити покращення рівня 1",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;

    try {
      let currentUpgrade = 0;
      // Define upgradeInfo outside the generateShopMessage function
      let upgradeInfo = {};

      // Get user locale for translations
      const userLocale = i18n.getUserLocale
        ? i18n.getUserLocale()
        : interaction.locale.split("-")[0].toLowerCase();

      // Helper function to get translations from UpgradesDisplay
      const getUpgradeTranslation = (path, defaultValue) => {
        const pathParts = path.split(".");
        let result = UpgradesDisplay.localization_strings;
        for (const part of pathParts) {
          if (!result[part]) return defaultValue;
          result = result[part];
        }
        return result[userLocale] || result.en || defaultValue;
      };

      const generateShopMessage = async (options = {}) => {
        const { disableInteractions = false } = options;

        // Get user data with all relations
        const userData = await Database.getUser(guild.id, user.id);

        // Get the user's upgrade discount
        const upgradeDiscount = await Database.getUpgradeDiscount(
          guild.id,
          user.id
        );

        // Get upgrade info for each type
        upgradeInfo = {
          daily_bonus: await Database.getUpgradeInfo(
            "daily_bonus",
            userData.upgrades.find((u) => u.type === "daily_bonus")?.level || 1
          ),
          daily_cooldown: await Database.getUpgradeInfo(
            "daily_cooldown",
            userData.upgrades.find((u) => u.type === "daily_cooldown")?.level ||
              1
          ),
          crime: await Database.getUpgradeInfo(
            "crime",
            userData.upgrades.find((u) => u.type === "crime")?.level || 1
          ),
          bank_rate: await Database.getUpgradeInfo(
            "bank_rate",
            userData.upgrades.find((u) => u.type === "bank_rate")?.level || 1
          ),
          games_earning: await Database.getUpgradeInfo(
            "games_earning",
            userData.upgrades.find((u) => u.type === "games_earning")?.level ||
              1
          ),
        };

        // Apply discount to all upgrade prices if discount exists
        if (upgradeDiscount > 0) {
          Object.keys(upgradeInfo).forEach((key) => {
            const discountAmount =
              (upgradeInfo[key].price * upgradeDiscount) / 100;
            upgradeInfo[key].originalPrice = upgradeInfo[key].price;
            upgradeInfo[key].price = Math.max(
              1,
              Math.floor(upgradeInfo[key].price - discountAmount)
            );
            upgradeInfo[key].discountPercent = Math.round(upgradeDiscount);
          });
        }

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
              balance: Math.round(Number(userData.economy?.balance || 0)),
              bankBalance: Math.round(Number(userData.bank?.balance || 0)),
              bankRate: userData.bank?.rate || 0,
              totalEarned: Math.round(Number(userData.stats?.totalEarned || 0)),
              upgradeDiscount: upgradeDiscount,
            },
            locale: interaction.locale,
            upgrades: Object.entries(upgradeInfo).map(
              ([key, upgrade], index) => {
                const currentLevel =
                  userData.upgrades.find((u) => u.type === key)?.level || 1;

                // Define effect per level and unit based on upgrade type
                let effectPerLevel, effectUnit, effectValue;

                if (key === "daily_bonus") {
                  effectPerLevel = Math.round(
                    UPGRADES[key].effectMultiplier * 100
                  );
                  effectUnit = "%";
                  effectValue = upgrade.effect * 100;
                } else if (key === "daily_cooldown" || key === "crime") {
                  effectPerLevel = Math.floor(
                    UPGRADES[key].effectValue / (60 * 1000)
                  );
                  effectUnit = "m";
                  effectValue = upgrade.effect;
                } else if (key === "bank_rate") {
                  effectPerLevel = Math.round(UPGRADES[key].effectValue * 100);
                  effectUnit = "%";
                  effectValue = upgrade.effect * 100;
                } else if (key === "games_earning") {
                  effectPerLevel = Math.round(
                    UPGRADES[key].effectMultiplier * 100
                  );
                  effectUnit = "%";
                  effectValue = upgrade.effect * 100;
                }

                // Calculate progress percentage based on user's balance and upgrade price
                const userBalance = Math.round(
                  Number(userData.economy?.balance || 0)
                );
                const progressPercentage = Math.min(
                  Math.round((userBalance / upgrade.price) * 100),
                  100
                );

                // Get upgrade name and description from UpgradesDisplay
                const upgradeName = getUpgradeTranslation(
                  `upgrades.${key}.name`,
                  key
                );
                const upgradeDescription = getUpgradeTranslation(
                  `upgrades.${key}.description`,
                  ""
                );

                // Format description with variables if needed
                const formattedDescription = upgradeDescription
                  .replace(/\{\{effect\}\}/g, Math.round(effectValue))
                  .replace(
                    /\{\{increasePerLevel\}\}/g,
                    Math.round(effectPerLevel)
                  )
                  .replace(
                    /\{\{increasePerLevelMinutes\}\}/g,
                    Math.round(effectPerLevel)
                  )
                  .replace(/\{\{price\}\}/g, Math.round(upgrade.price));

                // Create upgrade object with discount information if applicable
                const upgradeObj = {
                  emoji: UPGRADES[key].emoji,
                  title: upgradeName,
                  description: formattedDescription,
                  currentLevel: currentLevel,
                  nextLevel: currentLevel + 1,
                  price: Math.round(upgrade.price),
                  progress: progressPercentage,
                  id: index,
                  category: UPGRADES[key].category,
                  effectPerLevel: effectPerLevel,
                  effectUnit: effectUnit,
                };

                // Add discount information if applicable
                if (upgrade.discountPercent) {
                  upgradeObj.originalPrice = upgrade.originalPrice;
                  upgradeObj.discountPercent = upgrade.discountPercent;
                }

                return upgradeObj;
              }
            ),
            currentUpgrade,
            balance: Math.round(Number(userData.economy?.balance || 0)),
            dominantColor: "user",
            returnDominant: true,
          },
          { image: 2, emoji: 2 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `shop.png`,
        });

        console.log(upgradeInfo);

        // Create shop component with ComponentBuilder
        const shopComponent = new ComponentBuilder()
          .setColor(dominantColor?.embedColor || process.env.EMBED_COLOR)
          .addText(i18n.__("commands.economy.shop.title"), "header3")
          .addText(
            i18n.__("commands.economy.shop.description", {
              balance: Math.round(Number(userData.economy?.balance || 0)),
            })
          )
          .addImage("attachment://shop.png");

        // Create selection menu for switching upgrades
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(i18n.__("commands.economy.shop.selectUpgrade"))
          .addOptions(
            Object.entries(upgradeInfo).map(([key, upgrade], index) => {
              let effectPerLevel, effectValue;

              if (key === "daily_bonus") {
                effectPerLevel = Math.round(
                  UPGRADES[key].effectMultiplier * 100
                );
                effectValue = upgrade.effect * 100;
              } else if (key === "daily_cooldown" || key === "crime") {
                effectPerLevel = Math.floor(
                  UPGRADES[key].effectValue / (60 * 1000)
                );
                effectValue = upgrade.effect;
              } else if (key === "bank_rate") {
                effectPerLevel = Math.round(UPGRADES[key].effectValue * 100);
                effectValue = upgrade.effect * 100;
              } else if (key === "games_earning") {
                effectPerLevel = Math.round(
                  UPGRADES[key].effectMultiplier * 100
                );
                effectValue = upgrade.effect * 100;
              }

              // Get upgrade name and description from UpgradesDisplay
              const upgradeName = getUpgradeTranslation(
                `upgrades.${key}.name`,
                key
              );
              const upgradeDescription = getUpgradeTranslation(
                `upgrades.${key}.description`,
                ""
              );

              // Format description with variables if needed
              const formattedDescription = upgradeDescription
                .replace(/\{\{effect\}\}/g, Math.round(effectValue))
                .replace(
                  /\{\{increasePerLevel\}\}/g,
                  Math.round(effectPerLevel)
                )
                .replace(
                  /\{\{increasePerLevelMinutes\}\}/g,
                  Math.round(effectPerLevel)
                )
                .replace(/\{\{price\}\}/g, Math.round(upgrade.price));

              // Create option object
              const option = {
                label: upgradeName,
                description: formattedDescription,
                value: index.toString(),
                emoji: UPGRADES[key].emoji,
                default: currentUpgrade === index,
              };

              // Add label suffix if the upgrade has a discount
              if (upgrade.discountPercent) {
                option.label = `${option.label} (${upgrade.discountPercent}% off)`;
              }

              return option;
            })
          );

        const openButton = new ButtonBuilder()
          .setCustomId("purchase")
          .setLabel(i18n.__("commands.economy.shop.purchaseButton"))
          .setStyle(ButtonStyle.Success);

        // Add revert button
        const revertButton = new ButtonBuilder()
          .setCustomId("revert")
          .setStyle(ButtonStyle.Danger);

        // Get the current upgrade type
        const currentUpgradeType = Object.keys(upgradeInfo)[currentUpgrade];
        // Get current upgrade level
        const currentLevel =
          userData.upgrades.find((u) => u.type === currentUpgradeType)?.level ||
          1;

        if (currentLevel <= 1) {
          // Disable the button for level 1 upgrades
          revertButton
            .setLabel(i18n.__("commands.economy.shop.revertButton"))
            .setDisabled(true);
        } else {
          // Calculate refund amount for display (85% of current level price)
          const currentUpgradeInfo = await Database.getUpgradeInfo(
            currentUpgradeType,
            currentLevel
          );
          const refundAmount = currentUpgradeInfo
            ? Math.floor(currentUpgradeInfo.price * 0.85)
            : 0;

          // Set the button label with refund amount
          revertButton
            .setLabel(
              i18n.__("commands.economy.shop.revertButtonWithRefund", {
                refund: refundAmount || 0,
              }) || i18n.__("commands.economy.shop.revertButton") // Fallback to simple "Revert" text
            )
            .setDisabled(false);
        }

        // Add components to the shop component
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(
          openButton,
          revertButton
        );

        // Conditionally add interactive components
        if (!disableInteractions) {
          shopComponent.addActionRow(selectRow);
          shopComponent.addActionRow(buttonRow);
        }

        return {
          components: [shopComponent.build()],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
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
          // Get the selected upgrade type based on currentUpgrade index
          const upgradeTypes = Object.keys(upgradeInfo);
          const type = upgradeTypes[currentUpgrade];

          try {
            // Call the database method
            const purchaseResult = await Database.purchaseUpgrade(
              guild.id,
              user.id,
              type
            );

            // --- Explicitly invalidate cache AFTER successful purchase ---
            const userCacheKeyFull = Database._cacheKeyUser(
              guild.id,
              user.id,
              true
            );
            const userCacheKeyBasic = Database._cacheKeyUser(
              guild.id,
              user.id,
              false
            );
            // purchaseUpgrade already invalidates cooldowns if necessary
            if (Database.redisClient) {
              try {
                const keysToDel = [userCacheKeyFull, userCacheKeyBasic];
                await Database.redisClient.del(keysToDel);
                Database._logRedis("del", keysToDel.join(", "), true);
              } catch (err) {
                Database._logRedis("del", keysToDel.join(", "), err);
              }
            }

            // Show updated shop with new upgrade level
            await i.update(await generateShopMessage());
          } catch (error) {
            if (error.message === "Insufficient balance") {
              await i.reply({
                content: i18n.__("commands.economy.shop.insufficientFunds"),
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }
        } else if (i.customId === "revert") {
          // Get the selected upgrade type based on currentUpgrade index
          const upgradeTypes = Object.keys(upgradeInfo);
          const type = upgradeTypes[currentUpgrade];

          try {
            // Revert the upgrade and get the result
            const revertResult = await Database.revertUpgrade(
              guild.id,
              user.id,
              type
            );

            // --- Explicitly invalidate cache AFTER successful revert ---
            const userCacheKeyFull = Database._cacheKeyUser(
              guild.id,
              user.id,
              true
            );
            const userCacheKeyBasic = Database._cacheKeyUser(
              guild.id,
              user.id,
              false
            );
            const cooldownCacheKey = Database._cacheKeyCooldown(
              guild.id,
              user.id
            ); // revert sets a cooldown
            if (Database.redisClient) {
              try {
                const keysToDel = [
                  userCacheKeyFull,
                  userCacheKeyBasic,
                  cooldownCacheKey,
                ];
                await Database.redisClient.del(keysToDel);
                Database._logRedis("del", keysToDel.join(", "), true);
              } catch (err) {
                Database._logRedis("del", keysToDel.join(", "), err);
              }
            }

            // Get the upgrade name from UpgradesDisplay for the success message
            const upgradeName = getUpgradeTranslation(
              `upgrades.${type}.name`,
              type
            );

            // First, acknowledge the interaction with an update
            await i.deferUpdate();

            // Now we can use followUp
            await i.followUp({
              content: i18n.__("commands.economy.shop.revertSuccess", {
                type: upgradeName,
                level: revertResult.newLevel,
                refund: revertResult.refundAmount,
              }),
              ephemeral: true,
            });

            // Show updated shop with new upgrade level
            await i.editReply(await generateShopMessage());
          } catch (error) {
            if (error.message.startsWith("Cooldown active:")) {
              const cooldownTime = parseInt(error.message.split(":")[1].trim());
              const minutesLeft = Math.ceil(cooldownTime / (1000 * 60));

              await i.reply({
                content: i18n.__("commands.economy.shop.revertCooldown", {
                  minutes: minutesLeft,
                }),
                ephemeral: true,
              });
            } else if (error.message === "Cannot revert a level 1 upgrade") {
              await i.reply({
                content: i18n.__("commands.economy.shop.cannotRevert"),
                ephemeral: true,
              });
            } else {
              throw error;
            }
          }
        }
      });

      collector.on("end", async () => {
        if (message.editable) {
          try {
            // Regenerate the message without interactive components
            const finalMessage = await generateShopMessage({
              disableInteractions: true,
            });
            await message.edit(finalMessage);
          } catch (error) {
            console.error("Error updating components on end:", error);
            // Fallback: Try removing components if regeneration fails
            await message.edit({ components: [] }).catch(() => {});
          }
        }
      });
    } catch (error) {
      console.error("Error in shop command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.shop.error"),
        ephemeral: true,
      });
    }
  },
};
