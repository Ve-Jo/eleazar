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
import hubClient, { UPGRADES } from "../../api/hubClient.js";
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
    description: {
      en: "View and purchase upgrades",
      ru: "Просмотреть и купить улучшения",
      uk: "Переглянути та купити покращення",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;

    try {
      let currentUpgrade = 0;
      // Define upgradeInfo outside the generateShopMessage function
      let upgradeInfo = {};

      // Always use v2 builder mode
      const builderMode = "v2";

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

        // Ensure user exists in database before fetching data
        await hubClient.ensureGuildUser(guild.id, user.id);

        // Get user data with all relations
        const userData = await hubClient.getUser(guild.id, user.id);

        // Get the user's upgrade discount
        // Upgrade discount will need to be implemented in hub services
        const upgradeDiscount = 0; // TODO: Implement upgrade discount API in hub

        // Get upgrade info for each type
        upgradeInfo = {
          // Upgrade info calculation will need to be implemented in hub services
          // For now, using basic calculations based on UPGRADES constants
          daily_bonus: {
            price: Math.floor(
              UPGRADES.daily_bonus.basePrice *
                Math.pow(
                  UPGRADES.daily_bonus.priceMultiplier,
                  (userData.upgrades?.daily_bonus?.level || 1) - 1
                )
            ),
            effect:
              UPGRADES.daily_bonus.effectMultiplier *
              (userData.upgrades?.daily_bonus?.level || 1),
          },
          daily_cooldown: {
            price: Math.floor(
              UPGRADES.daily_cooldown.basePrice *
                Math.pow(
                  UPGRADES.daily_cooldown.priceMultiplier,
                  (userData.upgrades?.daily_cooldown?.level || 1) - 1
                )
            ),
            effect:
              UPGRADES.daily_cooldown.effectValue *
              (userData.upgrades?.daily_cooldown?.level || 1),
          },
          crime: {
            price: Math.floor(
              UPGRADES.crime.basePrice *
                Math.pow(
                  UPGRADES.crime.priceMultiplier,
                  (userData.upgrades?.crime?.level || 1) - 1
                )
            ),
            effect:
              UPGRADES.crime.effectValue *
              (userData.upgrades?.crime?.level || 1),
          },
          bank_rate: {
            price: Math.floor(
              UPGRADES.bank_rate.basePrice *
                Math.pow(
                  UPGRADES.bank_rate.priceMultiplier,
                  (userData.upgrades?.bank_rate?.level || 1) - 1
                )
            ),
            effect:
              UPGRADES.bank_rate.effectValue *
              (userData.upgrades?.bank_rate?.level || 1),
          },
          games_earning: {
            price: Math.floor(
              UPGRADES.games_earning.basePrice *
                Math.pow(
                  UPGRADES.games_earning.priceMultiplier,
                  (userData.upgrades?.games_earning?.level || 1) - 1
                )
            ),
            effect:
              UPGRADES.games_earning.effectMultiplier *
              (userData.upgrades?.games_earning?.level || 1),
          },
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
                  effectValue = Math.floor(upgrade.effect / (60 * 1000));
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
          name: `shop_upgrades.avif`,
        });

        console.log(upgradeInfo);

        // Create main component with conditional mode
        const shopComponent = new ComponentBuilder({
          dominantColor,
          mode: builderMode,
        })
          .addText(await i18n.__(`commands.economy.shop.title`), "header3")
          .addText(
            await i18n.__("commands.economy.shop.description", {
              balance: Math.round(Number(userData.economy?.balance || 0)),
            })
          )
          .addImage(`attachment://shop_upgrades.avif`);

        // Create selection menu for switching upgrades
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("switch_upgrade")
          .setPlaceholder(await i18n.__("commands.economy.shop.selectUpgrade"))
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
                effectValue = Math.floor(upgrade.effect / (60 * 1000));
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
          .setLabel(await i18n.__("commands.economy.shop.purchaseButton"))
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
            .setLabel(await i18n.__("commands.economy.shop.revertButton"))
            .setDisabled(true);
        } else {
          // Calculate refund amount for display (85% of current level price)
          // Calculate upgrade info locally
          const currentUpgradeInfo = {
            price: Math.floor(
              UPGRADES[currentUpgradeType].basePrice *
                Math.pow(
                  UPGRADES[currentUpgradeType].priceMultiplier,
                  currentLevel - 1
                )
            ),
          };
          const refundAmount = currentUpgradeInfo
            ? Math.floor(currentUpgradeInfo.price * 0.85)
            : 0;

          // Set the button label with refund amount
          revertButton
            .setLabel(
              (await i18n.__("commands.economy.shop.revertButtonWithRefund", {
                refund: refundAmount || 0,
              })) || (await i18n.__("commands.economy.shop.revertButton")) // Fallback to simple "Revert" text
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

        // Return the reply options using the builder's method
        return shopComponent.toReplyOptions({
          files: [attachment],
        });
      };

      // Initial message send/edit
      const initialMessageOptions = await generateShopMessage();
      let message;
      // Edit deferred reply
      message = await interaction.editReply(initialMessageOptions);

      // Create collector for buttons and select menu (only for normal context)
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
            const purchaseResult = await hubClient.purchaseUpgrade(
              guild.id,
              user.id,
              type
            );

            // Cache invalidation is handled by the hub service

            // Show updated shop with new upgrade level
            await i.update(await generateShopMessage());
          } catch (error) {
            if (error.message === "Insufficient balance") {
              await i.reply({
                content: await i18n.__(
                  "commands.economy.shop.insufficientFunds"
                ),
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
            // Revert upgrade functionality will need to be implemented in hub services
            throw new Error(
              "Revert upgrade not yet implemented in hub services"
            );

            // Cache invalidation is handled by the hub service

            // Get the upgrade name from UpgradesDisplay for the success message
            const upgradeName = getUpgradeTranslation(
              `upgrades.${type}.name`,
              type
            );

            // First, acknowledge the interaction with an update
            await i.deferUpdate();

            // Now we can use followUp
            await i.followUp({
              content: await i18n.__("commands.economy.shop.revertSuccess", {
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
                content: await i18n.__("commands.economy.shop.revertCooldown", {
                  minutes: minutesLeft,
                }),
                ephemeral: true,
              });
            } else if (error.message === "Cannot revert a level 1 upgrade") {
              await i.reply({
                content: await i18n.__("commands.economy.shop.cannotRevert"),
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
      // Send error message
      const errorOptions = {
        content: await i18n.__("commands.economy.shop.error"),
        ephemeral: true,
      };
      // Edit reply
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};
