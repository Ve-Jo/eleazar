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

    // Check if we need to store this cooldown
    // If we're storing a cooldown that's already expired, don't bother
    const baseTime = COOLDOWNS[type];
    const now = Date.now();
    const isExpired = now >= cooldowns[type] + baseTime;

    if (isExpired) {
      delete cooldowns[type]; // Remove expired cooldown
    }

    // If there are no meaningful cooldowns, delete the record instead of storing empty data
    if (Object.keys(cooldowns).length === 0) {
      if (cooldown) {
        // Delete existing record if it exists but would be empty
        return this.client.cooldown.delete({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
        });
      }
      // Return a mock record representing empty cooldowns
      return { userId, guildId, data: "{}" };
    }

    // Otherwise update/create with the non-empty cooldown data
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
