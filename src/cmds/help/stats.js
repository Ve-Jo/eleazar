import {
  SlashCommandSubcommand,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { generateRemoteImage } from "../../utils/remoteImageGenerator.js";
import i18n from "../../utils/i18n.js";
import Database from "../../database/client.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("help", "stats");

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

    // Get historical analytics data
    const pingStats = await Database.getAnalytics("ping", 10);

    // Process metrics data from the latest record
    const latestMetrics = pingStats[0]?.data || {};
    const {
      music = { players: 0, ping: 0 },
      render = { ping: 0, recentRequests: 0 },
      database = { ping: 0, cachingPing: 0, averageSpeed: 0 },
      shards = {},
      serversCount = 0,
    } = latestMetrics;

    // Extract ping history from analytics records
    const pingHistory = pingStats.reduce(
      (acc, record) => {
        const data = record.data || {};
        if (data.music?.ping) acc.music.push(data.music.ping);
        if (data.render?.ping) acc.render.push(data.render.ping);
        if (data.database?.ping) acc.database.push(data.database.ping);
        return acc;
      },
      { music: [], render: [], database: [] }
    );

    // Format shard stats from the data
    const shardStats = Object.entries(shards).map(([id, data]) => ({
      id: Number(id),
      guilds: data.guildsOnShard,
      ping: Array(6).fill(data.shardPing), // Fill ping history with current ping
    }));

    // If no shards data, use single shard mode
    if (shardStats.length === 0) {
      shardStats.push({
        id: 0,
        guilds: serversCount,
        ping: Array(6).fill(interaction.client.ws.ping),
      });
    }

    // Get guild count history
    const guildStats = await Database.getAnalytics("guilds", 100);

    console.log({
      guilds_stats: guildStats.map((stat) => stat.data.count || 0),
      database_pings: pingHistory.database,
      render_pings: pingHistory.render,
      music_pings: pingHistory.music,
    });

    // Generate the image using the Statistics component
    let imageResponse = await generateRemoteImage(
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
            guilds_stats: guildStats.map((stat) => stat.data.count || 0),
            database_pings: pingHistory.database,
            render_pings: pingHistory.render,
            music_pings: pingHistory.music,
          },
          avatar_url: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
        },
      },
      { width: 320, height: 310 },
      { image: 2, emoji: 1 }
    );

    const attachment = new AttachmentBuilder(imageResponse.buffer, {
      name: `stats.${
        imageResponse.contentType === "image/gif" ? "gif" : "png"
      }`,
    });

    let stats_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage(
        `attachment://stats.${
          imageResponse.contentType === "image/gif" ? "gif" : "png"
        }`
      )
      .setAuthor({
        name: i18n.__("help.stats.title"),
        iconURL: interaction.client.user.displayAvatarURL(),
      });

    imageResponse = null;

    await interaction.editReply({
      embeds: [stats_embed],
      files: [attachment],
    });
  },
  localization_strings: {
    name: {
      en: "stats",
      ru: "статистика",
      uk: "статистика",
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
};
