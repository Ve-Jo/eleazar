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
import Database from "../../database/client.js";
import { CRATE_TYPES } from "../../database/client.js";
import prettyMs from "pretty-ms";
import { generateImage } from "../../utils/imageGenerator.js";
// Import the CratesDisplay component to access its localizations
import CratesDisplay from "../../render-server/components/CratesDisplay.jsx";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("cases")
      .setDescription("Open cases and get rewards")
      .addStringOption((option) =>
        option
          .setName("case")
          .setDescription("Choose a specific case to open directly")
          .setRequired(false)
          .addChoices(
            {
              name: "daily",
              value: "daily",
            },
            {
              name: "weekly",
              value: "weekly",
            }
          )
      );

    return builder;
  },
  localization_strings: {
    command: {
      name: {
        ru: "кейсы",
        uk: "кейси",
      },
      description: {
        ru: "Открыть кейсы и получить награды",
        uk: "Відкрити кейси та отримати нагороди",
      },
    },
    options: {
      case: {
        name: {
          ru: "кейс",
          uk: "кейс",
        },
        description: {
          ru: "Выберите конкретный кейс для прямого открытия",
          uk: "Виберіть конкретний кейс для прямого відкриття",
        },
      },
    },
    title: {
      en: "Cases",
      ru: "Кейсы",
      uk: "Кейси",
    },
    selectCrate: {
      en: "Select a case to open",
      ru: "Выберите кейс для открытия",
      uk: "Виберіть кейс для відкриття",
    },
    openButton: {
      en: "Open Case",
      ru: "Открыть кейс",
      uk: "Відкрити кейс",
    },
    cooldownActive: {
      en: "This case is on cooldown for {{time}}",
      ru: "Этот кейс на перезарядке {{time}}",
      uk: "Цей кейс на перезарядці {{time}}",
    },
    balance: {
      en: "Your balance: {{balance}} coins",
      ru: "Ваш баланс: {{balance}} монет",
      uk: "Ваш баланс: {{balance}} монет",
    },
    backButton: {
      en: "Back to Crates",
      ru: "Назад к ящикам",
      uk: "Назад до скринь",
    },
    noCratesAvailable: {
      en: "You don't have any of these crates",
      ru: "У вас нет таких ящиков",
      uk: "У вас немає таких скринь",
    },
    rewardIntro: {
      en: "You opened a {{crate}} crate and received:\n",
      ru: "Вы открыли ящик {{crate}} и получили:\n",
      uk: "Ви відкрили скриню {{crate}} і отримали:\n",
    },
    rewardCoins: {
      en: "• {{amount}} coins\n",
      ru: "• {{amount}} монет\n",
      uk: "• {{amount}} монет\n",
    },
    rewardXp: {
      en: "• {{amount}} XP\n",
      ru: "• {{amount}} опыта\n",
      uk: "• {{amount}} досвіду\n",
    },
    rewardDiscount: {
      en: "• {{amount}}% discount\n",
      ru: "• {{amount}}% скидки\n",
      uk: "• {{amount}}% знижки\n",
    },
    rewardCooldown: {
      en: "• {{time}} cooldown reduction for {{type}}\n",
      ru: "• Уменьшение перезарядки {{type}} на {{time}}\n",
      uk: "• Зменшення перезарядки {{type}} на {{time}}\n",
    },
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();

    try {
      // Get user data
      let userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );

      // Check if a specific case was requested
      const requestedCase = interaction.options.getString("case");
      if (requestedCase) {
        // Check if requested case is available (not on cooldown)
        if (["daily", "weekly"].includes(requestedCase)) {
          const cooldown = await Database.getCrateCooldown(
            interaction.guild.id,
            interaction.user.id,
            requestedCase
          );

          if (cooldown > 0) {
            await interaction.editReply({
              content: i18n.__("commands.economy.cases.cooldownActive", {
                time: prettyMs(cooldown, { verbose: true }),
              }),
            });
            return;
          }

          try {
            // Get crate type info for display
            const userLocale = i18n.getUserLocale
              ? i18n.getUserLocale()
              : interaction.locale.split("-")[0].toLowerCase();

            const getCrateTranslation = (path, defaultValue) => {
              const pathParts = path.split(".");
              let result = CratesDisplay.localization_strings;
              for (const part of pathParts) {
                if (!result[part]) return defaultValue;
                result = result[part];
              }
              return result[userLocale] || result.en || defaultValue;
            };

            const crateName = getCrateTranslation(
              `types.${requestedCase}.name`,
              requestedCase
            );
            const crateEmoji = CRATE_TYPES[requestedCase]?.emoji || "🎁";

            // Open the case directly
            const rewards = await Database.openCrate(
              interaction.guild.id,
              interaction.user.id,
              requestedCase
            );

            // Generate reward display
            const [rewardBuffer] = await generateImage(
              "CrateRewards",
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
                locale: interaction.locale,
                crateType: requestedCase,
                crateEmoji: crateEmoji,
                crateName: crateName,
                rewards: rewards,
                dominantColor: "user",
                returnDominant: true,
              },
              { image: 2, emoji: 2 },
              i18n
            );

            const rewardAttachment = new AttachmentBuilder(rewardBuffer, {
              name: `reward.avif`,
            });

            // Generate reward message text
            let rewardText = i18n.__("commands.economy.cases.rewardIntro", {
              crate: crateName,
            });

            if (rewards.coins > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardCoins", {
                amount: rewards.coins,
              });
            }

            if (rewards.xp > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardXp", {
                amount: rewards.xp,
              });
            }

            if (rewards.discount > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardDiscount", {
                amount: rewards.discount,
              });
            }

            if (Object.keys(rewards.cooldownReductions).length > 0) {
              for (const [cooldownType, reduction] of Object.entries(
                rewards.cooldownReductions
              )) {
                // Use CratesDisplay translations for cooldown types
                const cooldownTypeName = getCrateTranslation(
                  `cooldownTypes.${cooldownType}`,
                  cooldownType
                );
                rewardText += i18n.__("commands.economy.cases.rewardCooldown", {
                  type: cooldownTypeName,
                  time: prettyMs(reduction, { verbose: true }),
                });
              }
            }

            // Create component with the reward text
            const rewardComponent = new ComponentBuilder()
              .addText(rewardText)
              .addImage("attachment://reward.avif");

            await interaction.editReply({
              components: [rewardComponent.build()],
              files: [rewardAttachment],
              flags: MessageFlags.IsComponentsV2,
            });

            return;
          } catch (error) {
            if (error.message.startsWith("Cooldown active:")) {
              await interaction.editReply({
                content: i18n.__("commands.economy.cases.cooldownActive", {
                  time: prettyMs(parseInt(error.message.split(":")[1].trim()), {
                    verbose: true,
                  }),
                }),
              });
            } else {
              console.error("Error opening case directly:", error);
              await interaction.editReply({
                content: i18n.__("commands.economy.error"),
              });
            }
            return;
          }
        } else {
          // For non-standard cases (inventory cases), could implement here
          await interaction.editReply({
            content: i18n.__("commands.economy.cases.noCratesAvailable"),
          });
          return;
        }
      }

      // If we reach here, no specific case was requested or direct opening failed
      // Continue with original code to show the case menu

      // Get all crates the user has (including core ones like daily/weekly)
      const crates = await Database.getUserCrates(
        interaction.guild.id,
        interaction.user.id
      );

      // Get cooldowns for standard crates
      const dailyCooldown = await Database.getCrateCooldown(
        interaction.guild.id,
        interaction.user.id,
        "daily"
      );

      const weeklyCooldown = await Database.getCrateCooldown(
        interaction.guild.id,
        interaction.user.id,
        "weekly"
      );

      // Get user locale for translations
      const userLocale = i18n.getUserLocale
        ? i18n.getUserLocale()
        : interaction.locale.split("-")[0].toLowerCase();

      // Get CratesDisplay translations based on locale
      const getCrateTranslation = (path, defaultValue) => {
        const pathParts = path.split(".");
        let result = CratesDisplay.localization_strings;
        for (const part of pathParts) {
          if (!result[part]) return defaultValue;
          result = result[part];
        }
        return result[userLocale] || result.en || defaultValue;
      };

      // Prepare crates for display
      const cratesList = [
        {
          id: "daily",
          name: getCrateTranslation("types.daily.name", "Daily Crate"),
          description: getCrateTranslation(
            "types.daily.description",
            "A crate you can open once every 24 hours"
          ),
          emoji: CRATE_TYPES.daily.emoji,
          available: dailyCooldown <= 0,
          cooldown: dailyCooldown > 0 ? dailyCooldown : 0,
          count: -1, // -1 indicates standard crate (not inventory)
        },
        {
          id: "weekly",
          name: getCrateTranslation("types.weekly.name", "Weekly Crate"),
          description: getCrateTranslation(
            "types.weekly.description",
            "A crate you can open once every 7 days"
          ),
          emoji: CRATE_TYPES.weekly.emoji,
          available: weeklyCooldown <= 0,
          cooldown: weeklyCooldown > 0 ? weeklyCooldown : 0,
          count: -1, // -1 indicates standard crate (not inventory)
        },
      ];

      // Add any special crates the user has in their inventory
      for (const crate of crates) {
        if (crate.count > 0 && !["daily", "weekly"].includes(crate.type)) {
          const crateType = crate.type;
          // Use CratesDisplay translations if available, otherwise use special description
          cratesList.push({
            id: crateType,
            name: getCrateTranslation(`types.${crateType}.name`, crateType),
            description: getCrateTranslation(
              `types.${crateType}.description`,
              getCrateTranslation(
                "types.special.description",
                "A special crate with unique rewards"
              )
            ),
            emoji: "🎁", // Default emoji for special crates
            available: true,
            cooldown: 0,
            count: crate.count,
          });
        }
      }

      let selectedCrate = 0; // Index of currently selected crate

      const generateCratesMessage = async (options = {}) => {
        const { disableInteractions = false } = options;

        const [pngBuffer, dominantColor] = await generateImage(
          "CratesDisplay",
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
              balance: Math.round(Number(userData.economy?.balance || 0)),
              xp: userData.Level?.xp || 0,
              seasonXp: userData.Level?.seasonXp || 0,
            },
            locale: interaction.locale,
            crates: cratesList,
            selectedCrate: selectedCrate,
            dominantColor: "user",
            returnDominant: true,
          },
          { image: 2, emoji: 2 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `crates.avif`,
        });

        // Create main container with ComponentBuilder
        const cratesComponent = new ComponentBuilder()
          .setColor(dominantColor?.embedColor ?? 0x0099ff)
          .addText(i18n.__("commands.economy.cases.title"), "header3")
          .addText(
            i18n.__("commands.economy.cases.balance", {
              balance: Math.round(Number(userData.economy?.balance || 0)),
            })
          )
          .addImage("attachment://crates.avif");

        // Create selection menu for crates
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_crate")
          .setPlaceholder(i18n.__("selectCrate"))
          .addOptions(
            cratesList.map((crate, index) => {
              const labelPrefix = crate.count > 0 ? `(${crate.count}) ` : "";
              const labelSuffix =
                !crate.available && crate.cooldown > 0
                  ? ` (${prettyMs(crate.cooldown, { compact: true })})`
                  : "";

              return {
                label: `${labelPrefix}${crate.name}${labelSuffix}`,
                description: crate.description,
                value: index.toString(),
                emoji: crate.emoji,
                default: selectedCrate === index,
              };
            })
          );

        // Create open button
        const openButton = new ButtonBuilder()
          .setCustomId("open_crate")
          .setLabel(i18n.__("commands.economy.cases.openButton"))
          .setStyle(ButtonStyle.Success)
          .setDisabled(!cratesList[selectedCrate].available);

        // Define action rows but don't add them yet
        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(openButton);

        // Conditionally add interactive components
        if (!disableInteractions) {
          cratesComponent.addActionRow(selectRow);
          cratesComponent.addActionRow(buttonRow);
        }

        return {
          components: [cratesComponent.build()],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
        };
      };

      const message = await interaction.editReply(
        await generateCratesMessage()
      );

      // Create collector for both select menu and button
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "select_crate") {
          selectedCrate = parseInt(i.values[0]);
          await i.update(await generateCratesMessage());
        } else if (i.customId === "open_crate") {
          const selectedCrateInfo = cratesList[selectedCrate];

          if (!selectedCrateInfo.available) {
            await i.reply({
              content: i18n.__("commands.economy.cases.cooldownActive", {
                time: prettyMs(selectedCrateInfo.cooldown, { verbose: true }),
              }),
              ephemeral: true,
            });
            return;
          }

          try {
            // Open the crate
            const rewards = await Database.openCrate(
              interaction.guild.id,
              interaction.user.id,
              selectedCrateInfo.id
            );

            // Update crate status after opening
            if (["daily", "weekly"].includes(selectedCrateInfo.id)) {
              const cooldown = await Database.getCrateCooldown(
                interaction.guild.id,
                interaction.user.id,
                selectedCrateInfo.id
              );
              cratesList[selectedCrate].available = cooldown <= 0;
              cratesList[selectedCrate].cooldown = cooldown;
            } else if (selectedCrateInfo.count > 0) {
              cratesList[selectedCrate].count--;
              if (cratesList[selectedCrate].count <= 0) {
                cratesList[selectedCrate].available = false;
              }
            }

            // Generate reward display
            const [rewardBuffer] = await generateImage(
              "CrateRewards",
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
                locale: interaction.locale,
                crateType: selectedCrateInfo.id,
                crateEmoji: selectedCrateInfo.emoji,
                crateName: selectedCrateInfo.name,
                rewards: rewards,
                dominantColor: "user",
                returnDominant: true,
              },
              { image: 2, emoji: 2 },
              i18n
            );

            const rewardAttachment = new AttachmentBuilder(rewardBuffer, {
              name: `reward.avif`,
            });

            // Create a button to go back to crates
            const backButton = new ButtonBuilder()
              .setCustomId("back_to_crates")
              .setLabel(i18n.__("commands.economy.cases.backButton"))
              .setStyle(ButtonStyle.Secondary);

            // Generate reward message text
            let rewardText = i18n.__("commands.economy.cases.rewardIntro", {
              crate: selectedCrateInfo.name,
            });

            if (rewards.coins > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardCoins", {
                amount: rewards.coins,
              });
            }

            if (rewards.xp > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardXp", {
                amount: rewards.xp,
              });
            }

            if (rewards.discount > 0) {
              rewardText += i18n.__("commands.economy.cases.rewardDiscount", {
                amount: rewards.discount,
              });
            }

            if (Object.keys(rewards.cooldownReductions).length > 0) {
              for (const [cooldownType, reduction] of Object.entries(
                rewards.cooldownReductions
              )) {
                // Use CratesDisplay translations for cooldown types
                const cooldownTypeName = getCrateTranslation(
                  `cooldownTypes.${cooldownType}`,
                  cooldownType
                );
                rewardText += i18n.__("commands.economy.cases.rewardCooldown", {
                  type: cooldownTypeName,
                  time: prettyMs(reduction, { verbose: true }),
                });
              }
            }

            // Create reward component
            const rewardComponent = new ComponentBuilder()
              .addText(rewardText)
              .addImage("attachment://reward.avif");

            // Add back button
            const backRow = new ActionRowBuilder().addComponents(backButton);
            rewardComponent.addActionRow(backRow);

            await i.update({
              components: [rewardComponent.build()],
              files: [rewardAttachment],
              flags: MessageFlags.IsComponentsV2,
            });

            // Create a collector just for the back button
            const backCollector = message.createMessageComponentCollector({
              filter: (i) =>
                i.user.id === interaction.user.id &&
                i.customId === "back_to_crates",
              time: 60000,
              max: 1,
            });

            backCollector.on("collect", async (i) => {
              // --- Explicitly invalidate cache BEFORE fetching fresh data ---
              const userCacheKeyFull = Database._cacheKeyUser(
                interaction.guild.id,
                interaction.user.id,
                true
              );
              const userCacheKeyBasic = Database._cacheKeyUser(
                interaction.guild.id,
                interaction.user.id,
                false
              );
              const statsCacheKey = Database._cacheKeyStats(
                interaction.guild.id,
                interaction.user.id
              );
              const cratesCacheKey = Database._cacheKeyCrates(
                interaction.guild.id,
                interaction.user.id
              ); // Crate list might have changed
              const cooldownCacheKey = Database._cacheKeyCooldown(
                interaction.guild.id,
                interaction.user.id
              ); // Cooldowns definitely changed
              if (Database.redisClient) {
                try {
                  const keysToDel = [
                    userCacheKeyFull,
                    userCacheKeyBasic,
                    statsCacheKey,
                    cratesCacheKey,
                    cooldownCacheKey,
                  ];
                  await Database.redisClient.del(keysToDel);
                  Database._logRedis("del", keysToDel.join(", "), true);
                } catch (err) {
                  Database._logRedis("del", keysToDel.join(", "), err);
                }
              }

              // Fetch fresh user data AFTER invalidation
              userData = await Database.getUser(
                interaction.guild.id,
                interaction.user.id
              );

              // Refresh the crate data from the database
              const dailyCooldown = await Database.getCrateCooldown(
                interaction.guild.id,
                interaction.user.id,
                "daily"
              );

              const weeklyCooldown = await Database.getCrateCooldown(
                interaction.guild.id,
                interaction.user.id,
                "weekly"
              );

              // Get updated crate inventory
              const updatedCrates = await Database.getUserCrates(
                interaction.guild.id,
                interaction.user.id
              );

              // Update the standard crates in the list
              cratesList[0].available = dailyCooldown <= 0;
              cratesList[0].cooldown = dailyCooldown > 0 ? dailyCooldown : 0;

              cratesList[1].available = weeklyCooldown <= 0;
              cratesList[1].cooldown = weeklyCooldown > 0 ? weeklyCooldown : 0;

              // Update inventory crates
              for (let j = 2; j < cratesList.length; j++) {
                const matchingCrate = updatedCrates.find(
                  (c) => c.type === cratesList[j].id
                );
                if (matchingCrate) {
                  cratesList[j].count = matchingCrate.count;
                  cratesList[j].available = matchingCrate.count > 0;
                } else {
                  cratesList[j].count = 0;
                  cratesList[j].available = false;
                }
              }

              await i.update(await generateCratesMessage());
            });
          } catch (error) {
            if (error.message.startsWith("Cooldown active:")) {
              await i.reply({
                content: i18n.__("commands.economy.cases.cooldownActive", {
                  time: prettyMs(parseInt(error.message.split(":")[1].trim()), {
                    verbose: true,
                  }),
                }),
                ephemeral: true,
              });
            } else if (error.message === "No crates available") {
              await i.reply({
                content: i18n.__("commands.economy.cases.noCratesAvailable"),
                ephemeral: true,
              });
            } else {
              console.error("Error opening crate:", error);
              await i.reply({
                content: i18n.__("commands.economy.error"),
                ephemeral: true,
              });
            }
          }
        }
      });

      collector.on("end", async () => {
        if (message.editable) {
          try {
            // Regenerate the message without interactive components
            const finalMessage = await generateCratesMessage({
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
      console.error("Error in crates command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.cases.error"),
        ephemeral: true,
      });
    }
  },
};
