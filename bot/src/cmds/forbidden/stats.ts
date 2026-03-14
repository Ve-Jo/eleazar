import {
  AttachmentBuilder,
  EmbedBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { generateImage } from "../../utils/imageGenerator.ts";
import hubClient from "../../api/hubClient.ts";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
  getLocale?: () => string;
};

type AnalyticsRecordLike = {
  data?: {
    shards?: Record<string, { guildsOnShard?: number }>;
    serversCount?: number;
  };
};

type ClientUserLike = {
  displayAvatarURL: (options?: { extension?: string; size?: number }) => string;
};

type ForbiddenStatsInteractionLike = {
  locale: string;
  client: {
    user: ClientUserLike;
  };
  deferReply: () => Promise<unknown>;
  editReply: (payload: {
    embeds: EmbedBuilder[];
    files: AttachmentBuilder[];
  }) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("stats")
      .setDescription("Get the bot statistics");
  },

  localization_strings: {
    command: {
      name: {
        ru: "статистика",
        uk: "статистика",
      },
      description: {
        ru: "Получить статистику бота",
        uk: "Отримати статистику бота",
      },
    },
    title: {
      en: "Bot Statistics",
      ru: "Статистика бота",
      uk: "Статистика бота",
    },
    description: {
      en: "View bot statistics and performance metrics",
      ru: "Посмотреть статистику и производительность бота",
      uk: "Переглянути статистику та продуктивність бота",
    },
  },

  async execute(
    interaction: ForbiddenStatsInteractionLike,
    i18n: TranslatorLike
  ): Promise<void> {
    await interaction.deferReply();

    const pingStats = (await (hubClient as typeof hubClient & {
      getAnalytics: (metric: string, limit: number) => Promise<AnalyticsRecordLike[]>;
    }).getAnalytics("ping", 10)) as AnalyticsRecordLike[];

    const latestData = pingStats[0]?.data || {};
    const shards = latestData.shards || {};
    const serversCount = latestData.serversCount || 0;

    const shardStats = Object.entries(shards).map(([id, data]) => ({
      id: Number(id),
      guilds: data.guildsOnShard || 0,
      ping: Array<number>(6).fill(0),
    }));

    if (shardStats.length === 0 && serversCount > 0) {
      shardStats.push({
        id: 0,
        guilds: serversCount,
        ping: Array<number>(6).fill(0),
      });
    }

    const serverCountHistory = pingStats
      .map((record) => record.data?.serversCount || 0)
      .reverse();

    const imageResponse = (await generateImage(
      "Statistics",
      {
        interaction: {
          bot: {
            shards: shardStats,
          },
          locale: interaction.locale,
        },
        database: {
          bot_stats: {
            guilds_stats: serverCountHistory,
            database_pings: Array<number>(10).fill(0),
            render_pings: Array<number>(10).fill(0),
            music_pings: Array<number>(10).fill(0),
          },
          avatar_url: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
        },
        locale: interaction.locale,
      },
      { image: 2, emoji: 1 },
      i18n,
    )) as Buffer;

    const extension =
      imageResponse[0] === 0x47 &&
      imageResponse[1] === 0x49 &&
      imageResponse[2] === 0x46
        ? "gif"
        : "png";

    const attachment = new AttachmentBuilder(imageResponse, {
      name: `stats.${extension}`,
    });

    const statsEmbed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR ? Number(process.env.EMBED_COLOR) : 0x0099ff)
      .setImage(`attachment://stats.${extension}`)
      .setAuthor({
        name: await i18n.__("help.stats.title"),
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    await interaction.editReply({
      embeds: [statsEmbed],
      files: [attachment],
    });
  },
};

export default command;
