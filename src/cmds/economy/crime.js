import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import Database from "../../database/client.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("crime")
      .setDescription("Attempt to steal money from another user");

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        en: "crime",
        ru: "преступление",
        uk: "злочин",
      },
      description: {
        en: "Attempt to steal money from another user",
        ru: "Попытаться украсть деньги у другого пользователя",
        uk: "Спробувати вкрасти гроші у іншого користувача",
      },
    },
    cooldown: {
      en: "You need to wait before committing another crime",
      ru: "Вам нужно подождать прежде чем совершить новое преступление",
      uk: "Вам потрібно зачекати перш ніж вчинити новий злочин",
    },
    selectTarget: {
      en: "Select a user to steal from",
      ru: "Выберите пользователя, у которого хотите украсть",
      uk: "Виберіть користувача, у якого хочете вкрасти",
    },
    noValidTargets: {
      en: "No valid targets found (users must have coins to steal)",
      ru: "Не найдено подходящих целей (у пользователей должны быть монеты)",
      uk: "Не знайдено підходящих цілей (у користувачів повинні бути монети)",
    },
    noSelection: {
      en: "No target selected",
      ru: "Цель не выбрана",
      uk: "Ціль не вибрана",
    },
    title: {
      en: "Crime",
      ru: "Преступление",
      uk: "Злочин",
    },
    successTarget: {
      en: "You successfully stole {{amount}} coins from {{target}}!",
      ru: "Вы успешно украли {{amount}} монет у {{target}}!",
      uk: "Ви успішно вкрали {{amount}} монет у {{target}}!",
    },
    failTarget: {
      en: "You were caught and had to pay a fine of {{amount}} coins!",
      ru: "Вас поймали и вам пришлось заплатить штраф в размере {{amount}} монет!",
      uk: "Вас спіймали і вам довелося заплатити штраф у розмірі {{amount}} монет!",
    },
    error: {
      en: "An error occurred while processing your crime attempt",
      ru: "Произошла ошибка при обработке попытки преступления",
      uk: "Сталася помилка під час обробки спроби злочину",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild, user } = interaction;

    try {
      // Get user data with upgrades to calculate cooldown reduction
      let userData = await Database.getUser(guild.id, user.id);

      // Apply cooldown reduction from crime upgrade
      const crimeUpgrade = userData.upgrades.find((u) => u.type === "crime");
      const crimeLevel = crimeUpgrade?.level || 1;

      // Calculate cooldown reduction (20 minutes per level starting from level 2)
      const cooldownReduction = (crimeLevel - 1) * (20 * 60 * 1000);

      // Check if cooldown is active (with reduction applied)
      const baseCooldownTime = await Database.getCooldown(
        guild.id,
        user.id,
        "crime"
      );

      // Apply cooldown reduction, but ensure it doesn't go below 0
      const cooldownTime = Math.max(0, baseCooldownTime - cooldownReduction);

      if (cooldownTime > 0) {
        const timeLeft = Math.ceil(cooldownTime / 1000);

        // Generate cooldown image
        const [pngBuffer, dominantColor] = await generateImage(
          "Cooldown",
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
            nextDaily: timeLeft * 1000,
            emoji: "🦹",
            returnDominant: true,
          },
          { image: 2, emoji: 2 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `crime_cooldown.png`,
        });

        // Create cooldown component
        const cooldownComponent = new ComponentBuilder({
          dominantColor,
        })
          .addText(i18n.__("commands.economy.crime.title"), "header3")
          .addText(i18n.__("commands.economy.crime.cooldown"))
          .addImage("attachment://crime_cooldown.png");

        return interaction.editReply({
          components: [cooldownComponent.build()],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
          ephemeral: true,
        });
      }

      // Get all users in the guild with their data
      // Only fetch users with a positive balance to avoid unnecessary processing
      const validTargets = await Database.client.user.findMany({
        where: {
          guildId: guild.id,
          id: { not: user.id },
          economy: {
            balance: { gt: 0 }, // Only users with balance > 0
          },
        },
        include: {
          economy: true,
        },
      });

      if (validTargets.length === 0) {
        return interaction.editReply({
          content: i18n.__("commands.economy.crime.noValidTargets"),
          ephemeral: true,
        });
      }

      // Create selection menu with potential targets
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_crime_target")
        .setPlaceholder(i18n.__("commands.economy.crime.selectTarget"))
        .addOptions(
          await Promise.all(
            validTargets.map(async (userData) => {
              let member;
              try {
                member = await guild.members.fetch(userData.id);
              } catch (error) {
                console.error(`Failed to fetch member ${userData.id}:`, error);
                return null;
              }
              if (!member || member.user.bot) return null;

              return {
                label: member.displayName,
                description: `${Number(userData.economy?.balance || 0).toFixed(
                  0
                )} coins`,
                value: userData.id,
              };
            })
          ).then((options) => options.filter((opt) => opt !== null))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      // Create a component to hold the text and the select menu
      const selectTargetComponent = new ComponentBuilder()
        .setColor(process.env.EMBED_COLOR) // Use default color or adjust as needed
        .addText(i18n.__("commands.economy.crime.selectTarget"))
        .addActionRow(row);

      const response = await interaction.editReply({
        components: [selectTargetComponent.build()],
        flags: MessageFlags.IsComponentsV2, // Added flag
      });

      try {
        const collection = await response.awaitMessageComponent({
          filter: (i) => i.user.id === user.id,
          time: 30000,
          componentType: ComponentType.StringSelect,
        });

        const targetId = collection.values[0];
        const target = await guild.members.fetch(targetId);

        // Get user and target data in parallel to reduce wait time
        const [userData, targetData] = await Promise.all([
          Database.getUser(guild.id, user.id),
          Database.getUser(guild.id, targetId),
        ]);

        // Calculate success chance and potential rewards based on crime level
        const crimeUpgrade = userData.upgrades.find((u) => u.type === "crime");
        const crimeLevel = crimeUpgrade?.level || 1;
        const successChance = 0.3 + (crimeLevel - 1) * 0.05; // 5% increase per level
        const success = Math.random() < successChance;

        // Calculate amount based on target's balance
        const maxStealPercent = 0.2 + (crimeLevel - 1) * 0.02; // 2% increase per level
        let amount;
        if (success) {
          // Calculate steal amount (between 1% and maxStealPercent of target's balance)
          const minStealAmount = Math.floor(
            Number(targetData.economy?.balance || 0) * 0.01
          ); // Minimum 1%
          const maxStealAmount = Math.floor(
            Number(targetData.economy?.balance || 0) * maxStealPercent
          );
          amount = Math.floor(
            minStealAmount + Math.random() * (maxStealAmount - minStealAmount)
          );
          // Ensure minimum of 10 coins
          amount = Math.max(10, amount);
        } else {
          // Calculate fine amount (between 10 coins and 10% of user's balance)
          const maxFine = Math.floor(
            Number(userData.economy?.balance || 0) * 0.1
          );
          amount = Math.max(10, Math.floor(Math.random() * maxFine));
        }

        // Only perform database operations if the amount is non-zero
        if (amount > 0) {
          // Update balances in a transaction
          await Database.client.$transaction(async (tx) => {
            if (success) {
              // Deduct amount from target
              await tx.economy.update({
                where: {
                  userId_guildId: {
                    userId: targetId,
                    guildId: guild.id,
                  },
                },
                data: {
                  balance: { decrement: amount },
                },
              });

              // Add amount to user and update stats
              await tx.economy.update({
                where: {
                  userId_guildId: {
                    userId: user.id,
                    guildId: guild.id,
                  },
                },
                data: {
                  balance: { increment: amount },
                },
              });

              await tx.statistics.update({
                where: {
                  userId_guildId: {
                    userId: user.id,
                    guildId: guild.id,
                  },
                },
                data: {
                  totalEarned: { increment: amount },
                },
              });
            } else {
              // Deduct fine from user
              await tx.economy.update({
                where: {
                  userId_guildId: {
                    userId: user.id,
                    guildId: guild.id,
                  },
                },
                data: {
                  balance: { decrement: amount },
                },
              });
            }

            // Update crime cooldown
            await Database.updateCooldown(guild.id, user.id, "crime");
          });
        } else {
          // Just update the cooldown if no money is involved
          await Database.updateCooldown(guild.id, user.id, "crime");
        }

        // --- Explicitly invalidate cache AFTER transaction/cooldown update ---
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
        const targetCacheKeyFull = Database._cacheKeyUser(
          guild.id,
          targetId,
          true
        );
        const targetCacheKeyBasic = Database._cacheKeyUser(
          guild.id,
          targetId,
          false
        );
        const userStatsKey = Database._cacheKeyStats(guild.id, user.id);
        const targetStatsKey = Database._cacheKeyStats(guild.id, targetId);
        const userCooldownKey = Database._cacheKeyCooldown(guild.id, user.id);
        if (Database.redisClient) {
          try {
            const keysToDel = [
              userCacheKeyFull,
              userCacheKeyBasic,
              userStatsKey,
              userCooldownKey,
              targetCacheKeyFull,
              targetCacheKeyBasic,
              targetStatsKey,
            ];
            await Database.redisClient.del(keysToDel);
            Database._logRedis("del", keysToDel.join(", "), true);
          } catch (err) {
            Database._logRedis("del", keysToDel.join(", "), err);
          }
        }

        // Get updated data (reuse the data if amount is zero to avoid unnecessary database queries)
        const [updatedUserData, updatedTargetData] =
          amount > 0
            ? await Promise.all([
                Database.getUser(guild.id, user.id),
                Database.getUser(guild.id, targetId),
              ])
            : [userData, targetData];

        // Generate crime result image
        const pngBuffer = await generateImage(
          "Crime",
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
                iconURL: guild.iconURL({ extension: "png", size: 1024 }),
              },
            },
            locale: interaction.locale,
            victim: {
              user: {
                id: target.id,
                username: target.user.username,
                displayName: target.displayName,
                avatarURL: target.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              balance: Number(updatedTargetData.economy?.balance || 0),
            },
            robber: {
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarURL: user.displayAvatarURL({
                  extension: "png",
                  size: 1024,
                }),
              },
              balance: Number(updatedUserData.economy?.balance || 0),
            },
            amount: amount,
            success: success,
          },
          { image: 2, emoji: 1 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `crime.png`,
        });

        // Use ComponentBuilder instead of EmbedBuilder
        const crimePage = new ComponentBuilder({
          // Set appropriate color based on success
          color: success ? process.env.EMBED_COLOR : 0xff0000,
        })
          .addText(i18n.__("commands.economy.crime.title"), "header3")
          .addText(
            success
              ? i18n.__("commands.economy.crime.successTarget", {
                  amount,
                  target: target.displayName,
                })
              : i18n.__("commands.economy.crime.failTarget", { amount })
          )
          .addImage(`attachment://crime.png`)
          .addTimestamp(interaction.locale);

        return interaction.editReply({
          components: [crimePage.build()],
          files: [attachment],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        if (error.code === "INTERACTION_COLLECTOR_ERROR") {
          return interaction.editReply({
            content: i18n.__("commands.economy.crime.noSelection"),
            components: [],
          });
        }
        throw error;
      }
    } catch (error) {
      console.error("Error in crime command:", error);
      await interaction.editReply({
        content: i18n.__("commands.economy.crime.error"),
        ephemeral: true,
      });
    }
  },
};
