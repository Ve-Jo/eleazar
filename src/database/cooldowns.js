import { COOLDOWNS, UPGRADES } from "./client.js";

export default {
  // Cooldown Management
  async getCooldown(guildId, userId, type) {
    const user = await this.getUser(guildId, userId, { cooldowns: true });
    if (!user?.cooldowns) return 0;

    const cooldowns = JSON.parse(user.cooldowns.data);
    const lastUsed = cooldowns[type] || 0;
    const baseTime = COOLDOWNS[type];

    if (type === "crime") {
      const userUpgrades = await this.client.upgrade.findMany({
        where: { userId, guildId },
      });
      const crimeUpgrade = userUpgrades.find((u) => u.type === "crime");
      const crimeLevel = crimeUpgrade?.level || 1;
      const reduction = (crimeLevel - 1) * UPGRADES.crime.effectValue;
      return Math.max(0, lastUsed + baseTime - reduction - Date.now());
    }

    return Math.max(0, lastUsed + baseTime - Date.now());
  },

  async updateCooldown(guildId, userId, type) {
    const cooldown = await this.client.cooldown.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    const cooldowns = JSON.parse(cooldown?.data || "{}");
    cooldowns[type] = Date.now();

    return this.client.cooldown.upsert({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
      create: {
        userId,
        guildId,
        data: JSON.stringify(cooldowns),
      },
      update: {
        data: JSON.stringify(cooldowns),
      },
    });
  },
};
