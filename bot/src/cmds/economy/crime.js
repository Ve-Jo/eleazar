import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
  MessageFlags,
} from "discord.js";
import hubClient from "../../api/hubClient.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { ComponentBuilder } from "../../utils/componentConverter.js";
import ms from "ms";

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
    // Always use v2 builder mode
    const builderMode = "v2";

    // Always defer reply
    await interaction.deferReply();

    const { guild, user } = interaction;

    try {
      // Ensure user exists in database before fetching data
      await hubClient.ensureGuildUser(guild.id, user.id);

      // Get user data with upgrades to calculate cooldown reduction
      let userData = await hubClient.getUser(guild.id, user.id, true);

      // Check if cooldown is active (getCooldown already handles crime upgrade reduction)
      const cooldownResponse = await hubClient.getCooldown(
        guild.id,
        user.id,
        "crime"
      );

      // Extract cooldown value from response object
      const cooldownTime = cooldownResponse?.cooldown || 0;

      console.log("cooldownResponse:", cooldownResponse);
      console.log("cooldownTime:", cooldownTime);
      console.log(
        "crimeLevel:",
        userData.upgrades.find((u) => u.type === "crime")?.level || 1
      );

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
          mode: builderMode,
        })
          .addText(await i18n.__("commands.economy.crime.title"), "header3")
          .addText(await i18n.__("commands.economy.crime.cooldown"))
          .addImage("attachment://crime_cooldown.png");

        return interaction.editReply({
          ...cooldownComponent.toReplyOptions({ files: [attachment] }),
          ephemeral: true,
        });
      }

      // Get all users in the guild with their data
      // Only fetch users with a positive balance to avoid unnecessary processing
      let validTargets = await hubClient.getGuildUsers(guild.id);

      //filter targets to not be the same user id and have balance > 1
      validTargets = validTargets.filter(
        (target) =>
          target.id !== user.id && Number(target.economy?.balance || 0) > 1
      );

      if (validTargets.length === 0) {
        return interaction.editReply({
          content: await i18n.__("commands.economy.crime.noValidTargets"),
          ephemeral: true,
        });
      }

      // Create selection menu with potential targets
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("select_crime_target")
        .setPlaceholder(await i18n.__("commands.economy.crime.selectTarget"))
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
      const selectTargetComponent = new ComponentBuilder({
        mode: builderMode,
      })
        .addText(await i18n.__("commands.economy.crime.selectTarget"))
        .addActionRow(row);

      // Reply logic based on context
      const selectTargetOptions = selectTargetComponent.toReplyOptions();
      let response;
      // Normal context: Edit the deferred reply to show the selector
      response = await interaction.editReply(selectTargetOptions);

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
          hubClient.getUser(guild.id, user.id, true),
          hubClient.getUser(guild.id, targetId, true),
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
          if (success) {
            // Deduct amount from target and add to user
            await hubClient.addBalance(guild.id, targetId, -amount);
            await hubClient.addBalance(guild.id, user.id, amount);
          } else {
            // Deduct fine from user and give it to the victim as compensation
            await hubClient.addBalance(guild.id, user.id, -amount);
            await hubClient.addBalance(guild.id, targetId, amount);
          }
        }

        // Update crime cooldown
        await hubClient.setCooldown(guild.id, user.id, "crime", ms("2h"));

        // Get updated data (reuse the data if amount is zero to avoid unnecessary database queries)
        const [updatedUserData, updatedTargetData] =
          amount > 0
            ? await Promise.all([
                hubClient.getUser(guild.id, user.id, true),
                hubClient.getUser(guild.id, targetId, true),
              ])
            : [userData, targetData];

        // Generate crime result image
        const [pngBuffer, dominantColor] = await generateImage(
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
            returnDominant: true,
            amount: amount,
            success: success,
          },
          { image: 2, emoji: 1 },
          i18n
        );

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: `crime_result.png`,
        });

        // Create result component
        const resultComponent = new ComponentBuilder({
          dominantColor,
          mode: builderMode,
        })
          .addText(await i18n.__("commands.economy.crime.title"), "header3")
          .addText(
            success
              ? await i18n.__("commands.economy.crime.successTarget", {
                  amount,
                  target: target.displayName,
                })
              : await i18n.__("commands.economy.crime.failTarget", { amount })
          )
          .addImage(`attachment://crime_result.png`);

        // Final reply logic for normal context (updates the message with results)
        const resultOptions = resultComponent.toReplyOptions({
          files: [attachment],
        });
        await collection.update(resultOptions);
      } catch (error) {
        // Handle timeout or other errors during target selection
        console.error("Error during crime target selection:", error);
        const errorOptions = {
          content: await i18n.__("commands.economy.crime.noSelection"),
          components: [],
          files: [],
        };
        // No AI context check needed here as this part is skipped for AI
        await interaction.editReply(errorOptions).catch(() => {}); // Ignore if edit fails
      }
    } catch (error) {
      console.error("Error in crime command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.crime.error"),
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};
