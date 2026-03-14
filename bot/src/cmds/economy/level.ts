import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";

type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
};

type UserLike = {
  id: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
};

type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
  roles: {
    fetch: (roleId: string) => Promise<{ name: string; hexColor: string } | null>;
  };
};

type LevelInfo = {
  level: number;
  currentXP: number;
  requiredXP: number;
};

type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale: string;
  member: UserLike;
  guild: GuildLike;
  options: {
    getMember: (name: string) => UserLike | null;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("level")
      .setDescription("View your XP level or someone else's")
      .addUserOption((option) =>
        option.setName("user").setDescription("User to check").setRequired(false)
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "уровень",
        uk: "рівень",
      },
      description: {
        ru: "Просмотреть свой уровень XP или уровень другого пользователя",
        uk: "Переглянути свій рівень XP або рівень іншого користувача",
      },
    },
    options: {
      user: {
        name: {
          ru: "пользователь",
          uk: "користувач",
        },
        description: {
          ru: "Пользователь для проверки",
          uk: "Користувач для перевірки",
        },
      },
    },
    title: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    level: {
      en: "Level",
      ru: "Уровень",
      uk: "Рівень",
    },
    nextLevel: {
      en: "Next level",
      ru: "Следующий уровень",
      uk: "Наступний рівень",
    },
    xp: {
      en: "XP",
      ru: "XP",
      uk: "XP",
    },
    userNotFound: {
      en: "User not found",
      ru: "Пользователь не найден",
      uk: "Користувача не знайдено",
    },
    imageError: {
      en: "Failed to generate the image. Please try again.",
      ru: "Не удалось сгенерировать изображение. Пожалуйста, попробуйте еще раз.",
      uk: "Не вдалося згенерувати зображення. Будь ласка, спробуйте ще раз.",
    },
    error: {
      en: "An error occurred while processing your request",
      ru: "Произошла ошибка при обработке запроса",
      uk: "Сталася помилка під час обробки запиту",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    try {
      const user = interaction.options.getMember("user") || interaction.member;

      await (hubClient as any).ensureGuildUser(interaction.guild.id, user.id);

      const userData = await (hubClient as any).getUser(interaction.guild.id, user.id, true);

      if (!userData) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.level.userNotFound"),
          ephemeral: true,
        });
        return;
      }

      const seasons = await (hubClient as any).getCurrentSeason();

      const chatXp = Number(userData.Level?.xp || 0);
      const chatLevelInfo = (hubClient as any).calculateLevel(chatXp) as LevelInfo;

      const gameXp = Number(userData.Level?.gameXp || 0);
      const gameLevelInfo = (hubClient as any).calculateLevel(gameXp) as LevelInfo;

      const seasonXp = Number(userData.Level?.seasonXp || 0);
      const seasonEnds = seasons?.seasonEnds || Date.now() + 7 * 24 * 60 * 60 * 1000;
      const seasonNumber = seasons?.seasonNumber || 1;

      let nextLevelRoleInfo: { name: string; color: string; requiredLevel: number } | null = null;
      try {
        const nextRoleData = await hubClient.getNextLevelRole(
          interaction.guild.id,
          chatLevelInfo.level
        );
        const nextRole = nextRoleData.nextRole;
        if (nextRole) {
          const role = await interaction.guild.roles.fetch(nextRole.roleId).catch(() => null);
          if (role) {
            nextLevelRoleInfo = {
              name: role.name,
              color: role.hexColor,
              requiredLevel: Number(nextRole.requiredLevel ?? 0),
            };
          }
        }
      } catch (error) {
        console.error(`Error fetching next level role for guild ${interaction.guild.id}:`, error);
      }

      const generated = (await generateImage(
        "Level2",
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
              id: interaction.guild.id,
              name: interaction.guild.name,
              iconURL: interaction.guild.iconURL({
                extension: "png",
                size: 1024,
              }),
            },
          },
          locale: interaction.locale,
          returnDominant: true,
          currentXP: chatLevelInfo.currentXP,
          requiredXP: chatLevelInfo.requiredXP,
          level: chatLevelInfo.level,
          gameCurrentXP: gameLevelInfo.currentXP,
          gameRequiredXP: gameLevelInfo.requiredXP,
          gameLevel: gameLevelInfo.level,
          seasonXP: seasonXp,
          seasonEnds: Number(seasonEnds),
          seasonNumber: Number(seasonNumber),
          nextLevelRole: nextLevelRoleInfo,
        },
        { image: 2, emoji: 1 },
        i18n as any
      )) as [Buffer | undefined, unknown];

      const buffer = generated?.[0];
      const dominantColor = generated?.[1];

      if (!buffer) {
        console.error("Buffer is undefined or null");
        await interaction.editReply({
          content: await i18n.__("commands.economy.level.imageError"),
          ephemeral: true,
        });
        return;
      }

      const attachment = new AttachmentBuilder(buffer, {
        name: "level.avif",
      });

      const levelComponent = new ComponentBuilder({
        dominantColor: dominantColor as any,
        mode: builderMode,
      })
        .addText(String(await i18n.__("commands.economy.level.title")), "header3")
        .addImage("attachment://level.avif")
        .addTimestamp(interaction.locale);

      const replyOptions = levelComponent.toReplyOptions({
        files: [attachment],
      });

      await interaction.editReply(replyOptions);
    } catch (error) {
      console.error("Error in level command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.level.error"),
        ephemeral: true,
        components: [],
        embeds: [],
        files: [],
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export default command;
