import {
  EmbedBuilder,
  AttachmentBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { generateImage } from "../../utils/imageGenerator.js";
import Database from "../../database/client.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("stats")
      .setDescription("Get the bot statistics");

    return builder;
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

  async execute(interaction, i18n) {
    await interaction.deferReply();

    // Get historical analytics data
    const pingStats = await Database.getAnalytics("ping", 10);

    const latestData = pingStats[0]?.data || {};
    const { shards = {}, serversCount = 0 } = latestData;

    // Format shard stats from the data
    const shardStats = Object.entries(shards).map(([id, data]) => ({
      id: Number(id),
      guilds: data.guildsOnShard,
      ping: Array(6).fill(0), // Zeroed out ping history
    }));

    // If no shards data, use single shard mode with the total server count
    if (shardStats.length === 0 && serversCount > 0) {
      shardStats.push({
        id: 0,
        guilds: serversCount,
        ping: Array(6).fill(0),
      });
    }

    // Extract server counts from ping history for graph
    const serverCountHistory = pingStats
      .map((record) => record.data?.serversCount || 0)
      .reverse();

    // Generate the image using the Statistics component
    let imageResponse = await generateImage(
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
            database_pings: Array(10).fill(0),
            render_pings: Array(10).fill(0),
            music_pings: Array(10).fill(0),
          },
          avatar_url: interaction.client.user.displayAvatarURL({
            extension: "png",
            size: 1024,
          }),
        },
        locale: interaction.locale,
      },
      { image: 2, emoji: 1 },
      i18n
    );

    const attachment = new AttachmentBuilder(imageResponse, {
      name: `stats.${
        imageResponse[0] === 0x47 &&
        imageResponse[1] === 0x49 &&
        imageResponse[2] === 0x46
          ? "gif"
          : "png"
      }`,
    });

    let stats_embed = new EmbedBuilder()
      .setTimestamp()
      .setColor(process.env.EMBED_COLOR)
      .setImage(
        `attachment://stats.${
          imageResponse[0] === 0x47 &&
          imageResponse[1] === 0x49 &&
          imageResponse[2] === 0x46
            ? "gif"
            : "png"
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
};
