import { Events } from "discord.js";
import Database from "../database/client.js";

const voiceStates = new Map();

export default {
  name: Events.VoiceStateUpdate,
  essential: true,
  async execute(oldState, newState) {
    const { guild, member } = oldState;
    if (!member || member.user.bot) return;

    const now = Date.now();
    const userId = member.id;
    const guildId = guild.id;

    // User joined a voice channel
    if (!oldState.channelId && newState.channelId) {
      // Check if there are other non-bot users in the channel
      const channel = newState.channel;
      const nonBotMembers = channel.members.filter((m) => !m.user.bot);

      if (nonBotMembers.size > 1) {
        voiceStates.set(`${guildId}-${userId}`, now);
      }
    }
    // User left a voice channel or switched channels
    else if (oldState.channelId) {
      const joinTime = voiceStates.get(`${guildId}-${userId}`);
      if (joinTime) {
        const timeSpent = now - joinTime;
        voiceStates.delete(`${guildId}-${userId}`);

        try {
          // Get current XP stats
          const stats = await Database.client.statistics.findUnique({
            where: {
              userId_guildId: { userId, guildId },
            },
            select: { xpStats: true },
          });

          let xpStats = stats?.xpStats || {};
          if (typeof xpStats === "string") {
            xpStats = JSON.parse(xpStats);
          }

          // Initialize channel tracking if needed
          if (!xpStats.channels) {
            xpStats.channels = {};
          }
          if (!xpStats.channels[oldState.channelId]) {
            xpStats.channels[oldState.channelId] = {
              name: oldState.channel.name,
              chat: 0,
              voice: 0,
            };
          }

          // Get guild settings for XP amount
          const guildSettings = await Database.client.guild.findUnique({
            where: { id: guildId },
            select: { settings: true },
          });

          const xpPerMinute = guildSettings?.settings?.xp_per_voice_minute || 1;
          const xpAmount = Math.floor((timeSpent / 60000) * xpPerMinute);

          if (xpAmount > 0) {
            // Update global voice XP
            xpStats.voice = (xpStats.voice || 0) + xpAmount;
            // Update channel-specific voice XP
            xpStats.channels[oldState.channelId].voice += xpAmount;

            // Update statistics with new XP data
            await Database.client.statistics.upsert({
              where: {
                userId_guildId: { userId, guildId },
              },
              create: {
                userId,
                guildId,
                voiceTime: BigInt(timeSpent),
                xpStats,
                user: {
                  connect: {
                    guildId_id: { guildId, id: userId },
                  },
                },
              },
              update: {
                voiceTime: {
                  increment: timeSpent,
                },
                xpStats,
              },
            });

            await Database.addXP(guildId, userId, xpAmount, "voice");
          }
        } catch (error) {
          console.error("Error updating voice time:", error);
        }
      }
    }

    // If user switched to a new channel, check if there are other users and start tracking
    if (newState.channelId && oldState.channelId !== newState.channelId) {
      const channel = newState.channel;
      const nonBotMembers = channel.members.filter((m) => !m.user.bot);

      if (nonBotMembers.size > 1) {
        voiceStates.set(`${guildId}-${userId}`, now);
      }
    }
  },
};
