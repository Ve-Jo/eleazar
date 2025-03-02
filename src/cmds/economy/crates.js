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
import Database from "../../database/client.js";
import { CRATE_TYPES } from "../../database/client.js";
import prettyMs from "pretty-ms";
import { generateImage } from "../../utils/imageGenerator.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "crates");

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
      // Get user data
      const userData = await Database.getUser(
        interaction.guild.id,
        interaction.user.id
      );

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

      // Prepare crates for display
      const cratesList = [
        {
          id: "daily",
          name: i18n.__("economy.crates.types.daily.name"),
          description: i18n.__("economy.crates.types.daily.description"),
          emoji: CRATE_TYPES.daily.emoji,
          available: dailyCooldown <= 0,
          cooldown: dailyCooldown > 0 ? dailyCooldown : 0,
          count: -1, // -1 indicates standard crate (not inventory)
        },
        {
          id: "weekly",
          name: i18n.__("economy.crates.types.weekly.name"),
          description: i18n.__("economy.crates.types.weekly.description"),
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
          // For custom crate types, we'd need to have translations and configurations
          cratesList.push({
            id: crateType,
            name:
              i18n.__(`economy.crates.types.${crateType}.name`) || crateType,
            description:
              i18n.__(`economy.crates.types.${crateType}.description`) ||
              i18n.__("economy.crates.types.special.description"),
            emoji: "🎁", // Default emoji for special crates
            available: true,
            cooldown: 0,
            count: crate.count,
          });
        }
      }

      let selectedCrate = 0; // Index of currently selected crate

      const generateCratesMessage = async () => {
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
          { image: 2, emoji: 2 }
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `crates.png`,
        });

        // Create selection menu for crates
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_crate")
          .setPlaceholder(i18n.__("economy.crates.selectCrate"))
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
          .setLabel(i18n.__("economy.crates.openButton"))
          .setStyle(ButtonStyle.Success)
          .setDisabled(!cratesList[selectedCrate].available);

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const buttonRow = new ActionRowBuilder().addComponents(openButton);

        const embed = new EmbedBuilder()
          .setColor(dominantColor?.embedColor ?? 0x0099ff)
          .setAuthor({
            name: i18n.__("economy.crates.title"),
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(
            i18n.__("economy.crates.description", {
              balance: Math.round(Number(userData.economy?.balance || 0)),
            })
          )
          .setImage(`attachment://crates.png`)
          .setTimestamp();

        return {
          embeds: [embed],
          files: [attachment],
          components: [selectRow, buttonRow],
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
              content: i18n.__("economy.crates.cooldownActive", {
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
              { image: 2, emoji: 2 }
            );

            const rewardAttachment = new AttachmentBuilder(rewardBuffer, {
              name: `reward.png`,
            });

            // Create a button to go back to crates
            const backButton = new ButtonBuilder()
              .setCustomId("back_to_crates")
              .setLabel(i18n.__("economy.crates.backButton"))
              .setStyle(ButtonStyle.Secondary);

            const backRow = new ActionRowBuilder().addComponents(backButton);

            // Generate reward message text
            let rewardText = i18n.__("economy.crates.rewardIntro", {
              crate: selectedCrateInfo.name,
            });

            if (rewards.coins > 0) {
              rewardText += i18n.__("economy.crates.rewardCoins", {
                amount: rewards.coins,
              });
            }

            if (rewards.xp > 0) {
              rewardText += i18n.__("economy.crates.rewardXp", {
                amount: rewards.xp,
              });
            }

            if (rewards.discount > 0) {
              rewardText += i18n.__("economy.crates.rewardDiscount", {
                amount: rewards.discount,
              });
            }

            if (Object.keys(rewards.cooldownReductions).length > 0) {
              for (const [cooldownType, reduction] of Object.entries(
                rewards.cooldownReductions
              )) {
                rewardText += i18n.__("economy.crates.rewardCooldown", {
                  type: i18n.__(`economy.crates.cooldownTypes.${cooldownType}`),
                  time: prettyMs(reduction, { verbose: true }),
                });
              }
            }

            await i.update({
              content: rewardText,
              embeds: [],
              files: [rewardAttachment],
              components: [backRow],
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
                content: i18n.__("economy.crates.cooldownActive", {
                  time: prettyMs(parseInt(error.message.split(":")[1].trim()), {
                    verbose: true,
                  }),
                }),
                ephemeral: true,
              });
            } else if (error.message === "No crates available") {
              await i.reply({
                content: i18n.__("economy.crates.noCratesAvailable"),
                ephemeral: true,
              });
            } else {
              console.error("Error opening crate:", error);
              await i.reply({
                content: i18n.__("economy.crates.error"),
                ephemeral: true,
              });
            }
          }
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          message.edit({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("Error in crates command:", error);
      await interaction.editReply({
        content: i18n.__("economy.crates.error"),
        ephemeral: true,
      });
    }
  },
  localization_strings: {
    name: {
      en: "crates",
      ru: "ящики",
      uk: "скрині",
    },
    description: {
      en: "Open crates to get rewards",
      ru: "Открывайте ящики, чтобы получить награды",
      uk: "Відкривайте скрині, щоб отримати нагороди",
    },
    title: {
      en: "Crates",
      ru: "Ящики",
      uk: "Скрині",
    },
    description: {
      en: "Open crates to get coins, XP, and other rewards!",
      ru: "Открывайте ящики, чтобы получить монеты, опыт и другие награды!",
      uk: "Відкривайте скрині, щоб отримати монети, досвід та інші нагороди!",
    },
    selectCrate: {
      en: "Select a crate to open",
      ru: "Выберите ящик для открытия",
      uk: "Виберіть скриню для відкриття",
    },
    openButton: {
      en: "Open Crate",
      ru: "Открыть ящик",
      uk: "Відкрити скриню",
    },
    backButton: {
      en: "Back to Crates",
      ru: "Назад к ящикам",
      uk: "Назад до скринь",
    },
    cooldownActive: {
      en: "You have to wait {{time}} to open this crate",
      ru: "Вам нужно подождать {{time}} чтобы открыть этот ящик",
      uk: "Вам потрібно почекати {{time}} щоб відкрити цю скриню",
    },
    noCratesAvailable: {
      en: "You don't have any of these crates",
      ru: "У вас нет таких ящиков",
      uk: "У вас немає таких скринь",
    },
    error: {
      en: "An error occurred while processing your request",
      ru: "Произошла ошибка при обработке вашего запроса",
      uk: "Сталася помилка під час обробки вашого запиту",
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
      en: "• {{amount}}% discount on {{type}} upgrade\n",
      ru: "• {{amount}}% скидки на улучшение {{type}}\n",
      uk: "• {{amount}}% знижки на покращення {{type}}\n",
    },
    rewardCooldown: {
      en: "• {{time}} cooldown reduction for {{type}}\n",
      ru: "• Уменьшение перезарядки {{type}} на {{time}}\n",
      uk: "• Зменшення перезарядки {{type}} на {{time}}\n",
    },
    types: {
      daily: {
        name: {
          en: "Daily Crate",
          ru: "Ежедневный ящик",
          uk: "Щоденна скриня",
        },
        description: {
          en: "A crate you can open once every 24 hours",
          ru: "Ящик, который можно открыть раз в 24 часа",
          uk: "Скриня, яку можна відкрити раз на 24 години",
        },
      },
      weekly: {
        name: {
          en: "Weekly Crate",
          ru: "Еженедельный ящик",
          uk: "Щотижнева скриня",
        },
        description: {
          en: "A crate you can open once every 7 days",
          ru: "Ящик, который можно открыть раз в 7 дней",
          uk: "Скриня, яку можна відкрити раз на 7 днів",
        },
      },
      special: {
        description: {
          en: "A special crate with unique rewards",
          ru: "Особый ящик с уникальными наградами",
          uk: "Особлива скриня з унікальними нагородами",
        },
      },
    },
    cooldownTypes: {
      daily: {
        en: "Daily Crate",
        ru: "Ежедневный ящик",
        uk: "Щоденна скриня",
      },
      work: {
        en: "Work Command",
        ru: "Команда работы",
        uk: "Команда роботи",
      },
      crime: {
        en: "Crime Command",
        ru: "Команда преступления",
        uk: "Команда злочину",
      },
      message: {
        en: "Message Rewards",
        ru: "Награды за сообщения",
        uk: "Нагороди за повідомлення",
      },
    },
  },
};
