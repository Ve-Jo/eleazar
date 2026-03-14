import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import i18n from "./i18n.ts";
import hubClient from "../api/hubClient.ts";
import { generateImage } from "./imageGenerator.ts";

type LocaleCode = "en" | "ru" | "uk";

type LevelUpInfo = {
  levelUp?: boolean;
  newLevel?: number | string;
  assignedRole?: string;
  removedRoles?: string[];
};

type RoleManagerLike = {
  add: (roleId: string) => Promise<unknown>;
  remove: (roleIds: string[]) => Promise<unknown>;
};

type UserLike = {
  username: string;
};

type MemberLike = {
  id: string;
  displayName: string;
  preferredLocale?: string | null;
  user: UserLike;
  roles: RoleManagerLike;
  send: (payload: { embeds: EmbedBuilder[]; files: AttachmentBuilder[] }) => Promise<unknown>;
  displayAvatarURL: (options: { extension: string; size: number }) => string;
};

type ChannelLike = {
  name: string;
  type: number;
  messages?: { cache: { size: number } };
  send?: (payload: {
    content?: string;
    embeds?: EmbedBuilder[];
    files?: AttachmentBuilder[];
  }) => Promise<unknown>;
  permissionsFor?: (member: unknown) => { has: (permission: string) => boolean };
};

type GuildLike = {
  name: string;
  preferredLocale?: string | null;
  systemChannel?: ChannelLike | null;
  members: {
    fetch: (userId: string) => Promise<MemberLike | null>;
    me?: unknown;
  };
  channels: {
    cache: {
      find: (predicate: (channel: ChannelLike) => boolean) => ChannelLike | undefined;
    };
  };
  iconURL: (options: { extension: string; size: number }) => string | null;
};

type ClientLike = {
  guilds: {
    fetch: (guildId: string) => Promise<GuildLike | null>;
  };
};

type MessageChannelLike = {
  send: (payload: {
    content?: string;
    embeds?: EmbedBuilder[];
    files?: AttachmentBuilder[];
  }) => Promise<unknown>;
};

type I18nLike = {
  initialized?: boolean;
  initialize: () => Promise<unknown> | void;
  setLocale: (locale: string) => string;
  getLocale?: () => string;
};

type LocalizationGroup = {
  title: Record<LocaleCode, string>;
  description: Record<LocaleCode, string>;
  footer: Record<LocaleCode, string>;
};

const supportedLocales: LocaleCode[] = ["en", "ru", "uk"];

function normalizeLocale(locale: string | null | undefined): LocaleCode | null {
  if (!locale) {
    return null;
  }

  const normalized = locale.split("-")[0]?.toLowerCase();
  if (normalized && supportedLocales.includes(normalized as LocaleCode)) {
    return normalized as LocaleCode;
  }

  return null;
}

async function handleLevelUp(
  client: ClientLike,
  guildId: string,
  userId: string,
  levelUpInfo: LevelUpInfo | null | undefined,
  type: string,
  channelObj: MessageChannelLike | null = null
): Promise<void> {
  if (!levelUpInfo || !levelUpInfo.levelUp) {
    return;
  }

  try {
    const guild = await client.guilds.fetch(guildId);
    if (!guild) {
      return;
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      return;
    }

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

    if (levelUpInfo.assignedRole) {
      try {
        await member.roles.add(levelUpInfo.assignedRole);
        console.log(
          `Added role ${levelUpInfo.assignedRole} to ${member.displayName} for ${type} level ${levelUpInfo.newLevel}`
        );

        if (levelUpInfo.removedRoles && levelUpInfo.removedRoles.length > 0) {
          await member.roles.remove(levelUpInfo.removedRoles);
          console.log(
            `Removed roles ${levelUpInfo.removedRoles.join(", ")} from ${member.displayName}`
          );
        }
      } catch (roleError) {
        console.error(`Error assigning level roles to ${member.displayName}:`, roleError);
      }
    }

    let userLocale: LocaleCode = "en";

    try {
      const userDbLocale = (await hubClient.getUserLocale(guildId, userId)) as string | null;
      const normalizedDbLocale = normalizeLocale(userDbLocale);
      if (normalizedDbLocale) {
        userLocale = normalizedDbLocale;
        console.log(
          `Using saved locale from DB for user ${member.displayName}: ${userLocale}`
        );
      } else {
        const normalizedMemberLocale = normalizeLocale(member.preferredLocale);
        const normalizedGuildLocale = normalizeLocale(guild.preferredLocale);

        if (normalizedMemberLocale) {
          userLocale = normalizedMemberLocale;
          console.log(
            `Using member's preferred locale for ${member.displayName}: ${userLocale}`
          );
        } else if (normalizedGuildLocale) {
          userLocale = normalizedGuildLocale;
          console.log(
            `Using guild's preferred locale for ${member.displayName}: ${userLocale}`
          );
        }
      }
    } catch (dbError) {
      console.error(`Error fetching user locale for ${userId}, using fallback:`, dbError);
      userLocale =
        normalizeLocale(member.preferredLocale) || normalizeLocale(guild.preferredLocale) || "en";
    }

    console.log(
      `Level-up notification locale: ${userLocale} for user ${member.displayName}`
    );

    const typedI18n = i18n as I18nLike;
    if (!typedI18n.initialized) {
      await typedI18n.initialize();
    }

    typedI18n.setLocale(userLocale);

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
      typedI18n
    );

    if (!buffer || !Buffer.isBuffer(buffer)) {
      console.error("Invalid buffer generated for level-up image");
      return;
    }

    const attachment = new AttachmentBuilder(buffer, {
      name: `level-up-${userId}.png`,
    });

    const embed = new EmbedBuilder()
      .setColor(isGameLevel ? 0x1db935 : 0x2196f3)
      .setImage(`attachment://level-up-${userId}.png`)
      .setTimestamp();

    if (channelObj?.send) {
      await channelObj.send({
        content: `<@${userId}>`,
        embeds: [embed],
        files: [attachment],
      });
      return;
    }

    try {
      await member.send({
        embeds: [embed],
        files: [attachment],
      });
    } catch {
      const channel =
        guild.systemChannel ||
        guild.channels.cache.find(
          (candidate) =>
            candidate.name.includes("general") &&
            candidate.type === 0 &&
            !!candidate.permissionsFor?.(guild.members.me).has("SendMessages")
        );

      if (channel?.send) {
        await channel.send({
          content: `<@${userId}>`,
          embeds: [embed],
          files: [attachment],
        });
      }
    }
  } catch (error) {
    console.error("Error handling level-up notification:", error);
  }
}

const levelUpStrings: Record<"chat" | "game", LocalizationGroup> = {
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

export { handleLevelUp, levelUpStrings };
