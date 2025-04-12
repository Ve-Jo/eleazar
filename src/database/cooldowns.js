import { COOLDOWNS, UPGRADES } from "./client.js";

export default {
  // Cooldown Management
  async getCooldown(guildId, userId, type) {
    const user = await this.getUser(guildId, userId, { cooldowns: true });
    if (!user?.cooldowns) return 0;

    // Safeguard for data format consistency
    let cooldowns = {};

    // Prisma should already provide this as a parsed object, but let's be safe
    if (user.cooldowns.data) {
      if (
        typeof user.cooldowns.data === "object" &&
        !Array.isArray(user.cooldowns.data)
      ) {
        cooldowns = user.cooldowns.data;
      } else if (typeof user.cooldowns.data === "string") {
        try {
          cooldowns = JSON.parse(user.cooldowns.data);
        } catch (error) {
          console.warn(
            `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }
    }

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
    // First, make sure the user exists to avoid constraint errors
    await this.ensureUser(guildId, userId);

    // Try to get the current cooldown data
    const cooldown = await this.client.cooldown.findUnique({
      where: {
        userId_guildId: {
          userId,
          guildId,
        },
      },
    });

    // Initialize a clean object to work with
    let cooldowns = {};

    // If data exists and it's an object, use it directly
    if (cooldown?.data) {
      if (typeof cooldown.data === "object" && !Array.isArray(cooldown.data)) {
        cooldowns = cooldown.data;
      } else if (typeof cooldown.data === "string") {
        try {
          cooldowns = JSON.parse(cooldown.data);
        } catch (error) {
          console.warn(
            `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
          );
        }
      }
    }

    // Update the timestamp for this specific cooldown
    cooldowns[type] = Date.now();

    // Perform cleanup - remove expired cooldowns
    // But make sure to preserve crate-related cooldowns!
    const now = Date.now();
    Object.entries(cooldowns).forEach(([cooldownType, timestamp]) => {
      // Skip cleanup for crate cooldowns
      if (cooldownType.startsWith("crate_")) return;

      const baseTime = COOLDOWNS[cooldownType];
      if (!baseTime || now >= timestamp + baseTime) {
        delete cooldowns[cooldownType];
      }
    });

    // If no active cooldowns, delete the record ONLY if there are no crate cooldowns
    // This ensures we don't accidentally delete crate cooldowns
    const hasCrateCooldowns = Object.keys(cooldowns).some((key) =>
      key.startsWith("crate_")
    );
    if (
      Object.keys(cooldowns).length === 0 ||
      (!hasCrateCooldowns &&
        Object.keys(cooldowns).every((key) => {
          const baseTime = COOLDOWNS[key];
          return !baseTime || now >= cooldowns[key] + baseTime;
        }))
    ) {
      if (cooldown) {
        return this.client.cooldown.delete({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
        });
      }
      return { userId, guildId, data: {} };
    }

    // Update or create cooldown record with a proper object (not stringified)
    try {
      return await this.client.cooldown.upsert({
        where: {
          userId_guildId: {
            userId,
            guildId,
          },
        },
        create: {
          userId,
          guildId,
          data: cooldowns, // Prisma will handle JSONB conversion
        },
        update: {
          data: cooldowns, // Prisma will handle JSONB conversion
        },
      });
    } catch (error) {
      console.error(
        `Error updating cooldown for ${userId} in guild ${guildId}:`,
        error
      );
      // If something went wrong, return a placeholder
      return { userId, guildId, data: {} };
    }
  },
};
