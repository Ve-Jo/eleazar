import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import i18n from "./newI18n.js";
import Database from "../database/client.js";
import { generateImage } from "./imageGenerator.js";

export async function handleLevelUp(
  client,
  guildId,
  userId,
  levelUpInfo,
  type,
  channelObj = null
) {
  if (!levelUpInfo || !levelUpInfo.levelUp) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) return;

    const member = await guild.members.fetch(userId);
    if (!member) return;

    console.log(
      "Level up info:",
      JSON.stringify(
        {
          userId: member.id,
          displayName: member.displayName,
          preferredLocale: member.preferredLocale,
          levelUpType: type,
          level: levelUpInfo.newLevel,
        },
        null,
        2
      )
    );

    // Handle level role assignment if applicable
    if (levelUpInfo.assignedRole) {
      try {
        // Add the new role
        await member.roles.add(levelUpInfo.assignedRole);
        console.log(
          `Added role ${levelUpInfo.assignedRole} to ${member.displayName} for ${type} level ${levelUpInfo.newLevel}`
        );

        // Remove any lower level roles if specified
        if (levelUpInfo.removedRoles && levelUpInfo.removedRoles.length > 0) {
          await member.roles.remove(levelUpInfo.removedRoles);
          console.log(
            `Removed roles ${levelUpInfo.removedRoles.join(", ")} from ${
              member.displayName
            }`
          );
        }
      } catch (roleError) {
        console.error(
          `Error assigning level roles to ${member.displayName}:`,
          roleError
        );
      }
    }

    let userLocale = "en";

    try {
      const userDbLocale = await Database.getUserLocale(guildId, userId);
      if (userDbLocale && ["en", "ru", "uk"].includes(userDbLocale)) {
        userLocale = userDbLocale;
        console.log(
          `Using saved locale from DB for user ${member.displayName}: ${userLocale}`
        );
      } else {
        if (member.preferredLocale) {
          const normalizedMemberLocale = member.preferredLocale
            .split("-")[0]
            .toLowerCase();
          if (["en", "ru", "uk"].includes(normalizedMemberLocale)) {
            userLocale = normalizedMemberLocale;
            console.log(
              `Using member's preferred locale for ${member.displayName}: ${userLocale}`
            );
          }
        } else if (guild.preferredLocale) {
          const normalizedGuildLocale = guild.preferredLocale
            .split("-")[0]
            .toLowerCase();
          if (["en", "ru", "uk"].includes(normalizedGuildLocale)) {
            userLocale = normalizedGuildLocale;
            console.log(
              `Using guild's preferred locale for ${member.displayName}: ${userLocale}`
            );
          }
        }
      }
    } catch (dbError) {
      console.error(
        `Error fetching user locale for ${userId}, using fallback:`,
        dbError
      );
      userLocale = member.preferredLocale || guild.preferredLocale || "en";
    }

    console.log(
      `Level-up notification locale: ${userLocale} for user ${member.displayName}`
    );

    if (!i18n.initialized) {
      i18n.initialize();
    }

    i18n.setLocale(userLocale);

    const isGameLevel = type !== "chat" && type !== "voice";

    const currentLevel = Number(levelUpInfo.newLevel) || 1;

    const buffer = await generateImage(
      "LevelUp",
      {
        interaction: {
          user: {
            id: userId,
            username: member.user.username,
            displayName: member.displayName,
            avatarURL: member.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          guild: {
            id: guildId,
            name: guild.name,
            iconURL: guild.iconURL({
              extension: "png",
              size: 1024,
            }),
          },
        },
        type: isGameLevel ? "game" : "chat",
        level: currentLevel,
        locale: userLocale,
      },
      { image: 2, emoji: 1 },
      i18n
    );

    if (!buffer || !Buffer.isBuffer(buffer)) {
      console.error("Invalid buffer generated for level-up image");
      return;
    }

    const attachment = new AttachmentBuilder(buffer, {
      name: `level-up-${userId}.avif`,
    });

    const embed = new EmbedBuilder()
      .setColor(isGameLevel ? 0x1db935 : 0x2196f3)
      .setImage(`attachment://level-up-${userId}.avif`)
      .setTimestamp();

    if (channelObj && channelObj.send) {
      await channelObj.send({
        content: `<@${userId}>`,
        embeds: [embed],
        files: [attachment],
      });
    } else {
      try {
        await member.send({
          embeds: [embed],
          files: [attachment],
        });
      } catch (dmError) {
        const channel =
          guild.systemChannel ||
          guild.channels.cache.find(
            (c) =>
              c.name.includes("general") &&
              c.type === 0 &&
              c.permissionsFor(guild.members.me).has("SendMessages")
          );

        if (channel) {
          await channel.send({
            content: `<@${userId}>`,
            embeds: [embed],
            files: [attachment],
          });
        }
      }
    }
  } catch (error) {
    console.error("Error handling level-up notification:", error);
  }
}

export const levelUpStrings = {
  chat: {
    title: {
      en: "Level Up!",
      ru: "Повышение уровня!",
      uk: "Підвищення рівня!",
    },
    description: {
      en: "You've leveled up from {oldLevel} to {newLevel}!",
      ru: "Вы повысили уровень с {oldLevel} до {newLevel}!",
      uk: "Ви підвищили рівень з {oldLevel} до {newLevel}!",
    },
    footer: {
      en: "Keep chatting to gain more XP!",
      ru: "Продолжайте общаться, чтобы получить больше XP!",
      uk: "Продовжуйте спілкуватися, щоб отримати більше XP!",
    },
  },
  game: {
    title: {
      en: "Game Level Up!",
      ru: "Повышение игрового уровня!",
      uk: "Підвищення ігрового рівня!",
    },
    description: {
      en: "You've leveled up your gaming skill from {oldLevel} to {newLevel} playing {game}!",
      ru: "Вы повысили свой игровой уровень с {oldLevel} до {newLevel}, играя в {game}!",
      uk: "Ви підвищили свій ігровий рівень з {oldLevel} до {newLevel}, граючи в {game}!",
    },
    footer: {
      en: "Keep playing games to gain more Game XP!",
      ru: "Продолжайте играть, чтобы получить больше игрового XP!",
      uk: "Продовжуйте грати, щоб отримати більше ігрового XP!",
    },
  },
};
