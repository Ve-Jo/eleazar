import { DEFAULT_VALUES } from "./client.js";

export default {
  async transaction(fn) {
    return this.client.$transaction(fn);
  },

  // Universal data access
  async get(path) {
    if (!path || typeof path !== "string") {
      throw new Error("Invalid path: must be a non-empty string");
    }

    const parts = path.split(".");

    // Handle guild and user paths (main functionality)
    if (parts[0]) {
      // Check if this is a guild-related path
      if ((await this.client.guild.count({ where: { id: parts[0] } })) > 0) {
        const guildId = parts[0];

        // Get guild data with necessary relations
        const guild = await this.client.guild.findUnique({
          where: { id: guildId },
          include: {
            users: {
              include: {
                economy: true,
                level: true,
                cooldowns: true,
                upgrades: true,
                stats: true,
              },
            },
          },
        });

        // If no guild found, return default values
        if (!guild && parts.length === 1) {
          return DEFAULT_VALUES.guild;
        }

        // Handle user data
        if (parts.length > 1) {
          const userId = parts[1];
          let user = guild?.users.find((u) => u.id === userId);

          // If no user found, return default values
          if (!user) {
            user = {
              ...DEFAULT_VALUES.user,
              id: userId,
              guildId,
              economy: {
                balance: DEFAULT_VALUES.economy.balance,
                bankBalance: DEFAULT_VALUES.economy.bankBalance,
                bankRate: DEFAULT_VALUES.economy.bankRate,
                bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
              },
              level: { xp: 0 },
              cooldowns: { data: {} }, // Use object directly, not stringified
              upgrades: Object.entries(DEFAULT_VALUES.upgrades).map(
                ([type, data]) => ({
                  type,
                  level: data.level,
                })
              ),
            };
          }

          // Return specific field if requested
          if (parts.length > 2) {
            const field = parts[2];
            switch (field) {
              case "balance":
                return user.economy?.balance ?? DEFAULT_VALUES.economy.balance;
              case "bankBalance":
                return (
                  user.economy?.bankBalance ??
                  DEFAULT_VALUES.economy.bankBalance
                );
              case "bankRate":
                return (
                  user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate
                );
              case "bankStartTime":
                return (
                  user.economy?.bankStartTime ??
                  DEFAULT_VALUES.economy.bankStartTime
                );
              case "messageCount":
                return (
                  user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount
                );
              case "commandCount":
                return (
                  user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount
                );
              case "totalEarned":
                return (
                  user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned
                );
              case "xp":
                return user.level?.xp ?? 0;
              case "cooldowns":
                // Handle different cooldown data formats
                if (!user.cooldowns) return {};

                try {
                  if (
                    typeof user.cooldowns.data === "object" &&
                    !Array.isArray(user.cooldowns.data)
                  ) {
                    return user.cooldowns.data;
                  } else if (typeof user.cooldowns.data === "string") {
                    return JSON.parse(user.cooldowns.data || "{}");
                  }
                  return {};
                } catch (error) {
                  console.warn(
                    `Failed to parse cooldown data: ${error.message}`
                  );
                  return {};
                }
              case "upgrades":
                return (
                  user.upgrades?.reduce(
                    (acc, u) => ({
                      ...acc,
                      [u.type]: { level: u.level },
                    }),
                    {}
                  ) ?? DEFAULT_VALUES.upgrades
                );
              default:
                return user[field] ?? DEFAULT_VALUES.user[field];
            }
          }

          // Return full user data
          const cooldownsData = user.cooldowns?.data;
          let parsedCooldowns = {};

          try {
            if (
              typeof cooldownsData === "object" &&
              !Array.isArray(cooldownsData)
            ) {
              parsedCooldowns = cooldownsData;
            } else if (typeof cooldownsData === "string") {
              parsedCooldowns = JSON.parse(cooldownsData || "{}");
            }
          } catch (error) {
            console.warn(
              `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${error.message}`
            );
          }

          return {
            ...user,
            balance: user.economy?.balance ?? DEFAULT_VALUES.economy.balance,
            bankBalance:
              user.economy?.bankBalance ?? DEFAULT_VALUES.economy.bankBalance,
            bankRate: user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate,
            bankStartTime:
              user.economy?.bankStartTime ??
              DEFAULT_VALUES.economy.bankStartTime,
            messageCount:
              user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount,
            commandCount:
              user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount,
            totalEarned:
              user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned,
            xp: user.level?.xp ?? 0,
            cooldowns: parsedCooldowns,
            upgrades:
              user.upgrades?.reduce(
                (acc, u) => ({
                  ...acc,
                  [u.type]: { level: u.level },
                }),
                {}
              ) ?? DEFAULT_VALUES.upgrades,
          };
        }

        // Return full guild data
        return guild || DEFAULT_VALUES.guild;
      }

      // Handle custom paths (non-guild related)
      const customData = await this.client.analytics.findFirst({
        where: { type: parts[0] },
        orderBy: { timestamp: "desc" },
      });

      if (!customData) return null;

      // Navigate through the path to get the specific value
      let value = customData.data;
      for (let i = 1; i < parts.length; i++) {
        value = value?.[parts[i]];
        if (value === undefined) return null;
      }

      return value;
    }

    throw new Error("Invalid path");
  },
};
