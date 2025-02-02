export default {
  // Add new methods for counter updates
  async incrementMessageCount(guildId, userId) {
    return this.client.statistics.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        messageCount: 1,
        commandCount: 0,
        totalEarned: 0,
        lastUpdated: Date.now(),
      },
      update: {
        messageCount: { increment: 1 },
        lastUpdated: Date.now(),
      },
    });
  },

  async incrementCommandCount(guildId, userId) {
    return this.client.statistics.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        messageCount: 0,
        commandCount: 1,
        totalEarned: 0,
        lastUpdated: Date.now(),
      },
      update: {
        commandCount: { increment: 1 },
        lastUpdated: Date.now(),
      },
    });
  },
};
