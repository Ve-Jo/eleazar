export default {
  // XP System
  async addXP(guildId, userId, amount) {
    return this.client.level.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        xp: amount,
      },
      update: {
        xp: { increment: amount },
      },
    });
  },

  calculateLevel(xp) {
    const level = Math.floor(Math.sqrt(xp / 100));
    const currentLevelXP = Math.pow(level, 2) * 100;
    const nextLevelXP = Math.pow(level + 1, 2) * 100;

    return {
      level: Math.max(1, level),
      currentXP: xp - currentLevelXP,
      requiredXP: nextLevelXP - currentLevelXP,
      totalXP: xp,
    };
  },
};
