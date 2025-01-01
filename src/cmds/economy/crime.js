import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  AttachmentBuilder,
} from "discord.js";
import EconomyEZ from "../../utils/economy.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("economy", "crime");

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

    // Check cooldown
    const cooldownTime = await EconomyEZ.getCooldownTime(
      guild.id,
      user.id,
      "crime"
    );
    if (cooldownTime > 0) {
      const timeLeft = Math.ceil(cooldownTime / 1000);

      // Generate cooldown image
      const pngBuffer = await generateRemoteImage(
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
          database: await EconomyEZ.get(`${guild.id}.${user.id}`),
          locale: interaction.locale,
          nextDaily: timeLeft * 1000,
          emoji: "🦹",
        },
        { width: 450, height: 200 },
        { image: 2, emoji: 2 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `crime_cooldown.${
          pngBuffer.contentType === "image/gif" ? "gif" : "png"
        }`,
      });

      return interaction.editReply({
        content: i18n.__("economy.crime.cooldown", { time: timeLeft }),
        files: [attachment],
        ephemeral: true,
      });
    }

    // Get all users in the guild with their data
    const guildData = await EconomyEZ.get(guild.id);
    const users = Object.entries(guildData).filter(
      ([userId, userData]) =>
        userId !== user.id &&
        userId !== "counting" &&
        userId !== "levels" &&
        typeof userData === "object" &&
        userData.balance > 0
    );

    if (users.length === 0) {
      return interaction.editReply({
        content: i18n.__("economy.crime.noValidTargets"),
        ephemeral: true,
      });
    }

    // Create selection menu with potential targets
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("select_crime_target")
      .setPlaceholder(i18n.__("economy.crime.selectTarget"))
      .addOptions(
        await Promise.all(
          users.map(async ([userId, userData]) => {
            let member;
            try {
              member = await guild.members.fetch(userId);
            } catch (error) {
              console.error(`Failed to fetch member ${userId}:`, error);
              return null;
            }
            if (!member || member.user.bot) return null;

            return {
              label: member.displayName,
              description: `${userData.balance.toFixed(0)} coins`,
              value: userId,
            };
          })
        ).then((options) => options.filter((opt) => opt !== null))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const response = await interaction.editReply({
      content: i18n.__("economy.crime.selectTarget"),
      components: [row],
    });

    try {
      const collection = await response.awaitMessageComponent({
        filter: (i) => i.user.id === user.id,
        time: 30000,
        componentType: ComponentType.StringSelect,
      });

      const targetId = collection.values[0];
      const target = await guild.members.fetch(targetId);
      const userData = await EconomyEZ.get(`${guild.id}.${user.id}`);
      const targetData = await EconomyEZ.get(`${guild.id}.${targetId}`);

      // Calculate success chance and potential rewards based on crime level
      const crimeLevel = userData.upgrades.crime.level;
      const successChance = 0.3 + (crimeLevel - 1) * 0.05; // 5% increase per level
      const success = Math.random() < successChance;

      // Calculate amount based on target's balance
      const maxStealPercent = 0.2 + (crimeLevel - 1) * 0.02; // 2% increase per level
      const amount = success
        ? Math.floor(Math.random() * (targetData.balance * maxStealPercent))
        : Math.max(
            10, // Minimum loss of 10 coins
            Math.floor(Math.random() * (userData.balance * 0.1)) // Lose up to 10% of own balance
          );

      // Update balances
      if (success) {
        await EconomyEZ.math(`${guild.id}.${targetId}.balance`, "-", amount);
        await EconomyEZ.math(`${guild.id}.${user.id}.balance`, "+", amount);
        await EconomyEZ.math(
          `${guild.id}.${user.id}.total_earned`,
          "+",
          amount
        );
      } else {
        await EconomyEZ.math(`${guild.id}.${user.id}.balance`, "-", amount);
      }

      // Update crime timestamp
      await EconomyEZ.set(`${guild.id}.${user.id}.crime`, Date.now());

      // Get updated balances
      const updatedUserData = await EconomyEZ.get(`${guild.id}.${user.id}`);
      const updatedTargetData = await EconomyEZ.get(`${guild.id}.${targetId}`);

      // Generate crime result image
      const pngBuffer = await generateRemoteImage(
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
            balance: updatedTargetData.balance,
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
            balance: updatedUserData.balance,
          },
          amount: amount,
          success: success,
        },
        { width: 450, height: 200 }
      );

      const attachment = new AttachmentBuilder(pngBuffer.buffer, {
        name: `crime.${pngBuffer.contentType === "image/gif" ? "gif" : "png"}`,
      });

      const embed = new EmbedBuilder()
        .setColor(success ? process.env.EMBED_COLOR : "#ff0000")
        .setAuthor({
          name: i18n.__("economy.crime.title"),
          iconURL: user.displayAvatarURL(),
        })
        .setDescription(
          success
            ? i18n.__("economy.crime.successTarget", {
                amount,
                target: target.displayName,
              })
            : i18n.__("economy.crime.failTarget", { amount })
        )
        .setImage(
          `attachment://crime.${
            pngBuffer.contentType === "image/gif" ? "gif" : "png"
          }`
        )
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        files: [attachment],
        components: [],
      });
    } catch (error) {
      if (error.code === "INTERACTION_COLLECTOR_ERROR") {
        return interaction.editReply({
          content: i18n.__("economy.crime.noSelection"),
          components: [],
        });
      }
      throw error;
    }
  },
  localization_strings: {
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
    cooldown: {
      en: "You need to wait {{time}} seconds before committing another crime",
      ru: "Вам нужно подождать {{time}} секунд, прежде чем совершить новое преступление",
      uk: "Вам потрібно зачекати {{time}} секунд, перш ніж вчинити новий злочин",
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
  },
};
