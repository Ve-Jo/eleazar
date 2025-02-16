export default {
  async createVoiceSession(guildId, userId, channelId, joinedAt) {
    return await this.client.voiceSession.upsert({
      where: {
        userId_guildId: { userId, guildId },
      },
      create: {
        channelId,
        joinedAt: BigInt(joinedAt),
        user: {
          connect: {
            guildId_id: { guildId, id: userId },
          },
        },
      },
      update: {
        channelId,
        joinedAt: BigInt(joinedAt),
      },
    });
  },

  async removeVoiceSession(guildId, userId) {
    return await this.client.voiceSession.delete({
      where: {
        userId_guildId: { userId, guildId },
      },
    });
  },

  async getVoiceSession(guildId, userId) {
    return await this.client.voiceSession.findUnique({
      where: {
        userId_guildId: { userId, guildId },
      },
    });
  },

  async getAllVoiceSessions(guildId, channelId) {
    return await this.client.voiceSession.findMany({
      where: {
        guildId,
        channelId,
      },
    });
  },

  async calculateAndAddVoiceXP(guildId, userId, session) {
    const timeSpent = Date.now() - Number(session.joinedAt);

    // Get guild settings for XP amount
    const guildSettings = await this.client.guild.findUnique({
      where: { id: guildId },
      select: { settings: true },
    });

    const xpPerMinute = guildSettings?.settings?.xp_per_voice_minute || 1;
    const xpAmount = Math.floor((timeSpent / 60000) * xpPerMinute);

    if (xpAmount > 0) {
      await this.addXP(guildId, userId, xpAmount, "voice");

      // Update voice time in statistics
      await this.client.statistics.update({
        where: {
          userId_guildId: { userId, guildId },
        },
        data: {
          voiceTime: {
            increment: timeSpent,
          },
        },
      });
    }

    return { timeSpent, xpAmount };
  },
};
