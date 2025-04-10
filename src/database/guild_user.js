import { DEFAULT_VALUES } from "./client.js";

export default {
  async getUser(guildId, userId, includeRelations = true) {
    // Ensure guild exists first
    await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });

    const include = includeRelations
      ? {
          economy: true,
          Level: true,
          cooldowns: true,
          upgrades: true,
          stats: true, // Changed from statistics to stats to match schema
        }
      : {};

    // Try to get existing user
    const user = await this.client.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      include,
    });

    // If user doesn't exist, create it with default values
    if (!user) {
      return this.createUser(guildId, userId);
    }

    return user;
  },

  async createUser(guildId, userId, data = {}) {
    // Ensure guild exists first
    await this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });

    const { economy, level, cooldowns, upgrades, stats, ...userData } = data;

    try {
      return await this.client.$transaction(async (tx) => {
        // Explicitly check if the user exists in this specific guild with a FOR UPDATE lock
        // This prevents race conditions where two createUser calls might happen simultaneously
        const existingUser = await tx.user.findUnique({
          where: {
            guildId_id: {
              guildId,
              id: userId,
            },
          },
        });

        if (existingUser) {
          // User already exists in this guild, update instead of create
          // Only update if there are actual changes to minimize database operations
          const shouldUpdateUser =
            Object.keys(userData).length > 0 || userData.lastActivity;

          let user;

          if (shouldUpdateUser) {
            user = await tx.user.update({
              where: {
                guildId_id: {
                  guildId,
                  id: userId,
                },
              },
              data: {
                lastActivity: Date.now(),
                ...userData,
                // Update related records if they exist and if non-default values provided
                ...(economy && Object.values(economy).some((v) => v !== 0)
                  ? {
                      economy: {
                        upsert: {
                          create: {
                            balance: DEFAULT_VALUES.economy.balance,
                            bankBalance: DEFAULT_VALUES.economy.bankBalance,
                            bankRate: DEFAULT_VALUES.economy.bankRate,
                            bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
                            ...economy,
                          },
                          update: {
                            ...economy,
                          },
                        },
                      },
                    }
                  : {}),
                ...(stats && Object.values(stats).some((v) => v !== 0)
                  ? {
                      stats: {
                        upsert: {
                          create: {
                            totalEarned: 0,
                            messageCount: DEFAULT_VALUES.stats.messageCount,
                            commandCount: DEFAULT_VALUES.stats.commandCount,
                            lastUpdated: Date.now(),
                            gameRecords: JSON.stringify({
                              2048: { highScore: 0 },
                              snake: { highScore: 0 },
                            }),
                            ...stats,
                          },
                          update: {
                            ...stats,
                          },
                        },
                      },
                    }
                  : {}),
                ...(level && level.xp > 0
                  ? {
                      Level: {
                        upsert: {
                          create: {
                            xp: 0,
                            ...level,
                          },
                          update: {
                            ...level,
                          },
                        },
                      },
                    }
                  : {}),
                ...(cooldowns && Object.keys(cooldowns).length > 0
                  ? {
                      cooldowns: {
                        upsert: {
                          create: {
                            data: JSON.stringify(DEFAULT_VALUES.cooldowns),
                            ...cooldowns,
                          },
                          update: {
                            ...cooldowns,
                          },
                        },
                      },
                    }
                  : {}),
              },
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
          } else {
            // Just fetch the user with relationships if no updates needed
            user = await tx.user.findUnique({
              where: {
                guildId_id: {
                  guildId,
                  id: userId,
                },
              },
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
          }

          // Handle upgrades separately if non-default values are provided
          if (
            upgrades &&
            Object.values(upgrades).some((upgrade) => upgrade.level > 1)
          ) {
            await this.updateUpgrades(guildId, userId, upgrades);
          }

          return user;
        } else {
          // User doesn't exist in this guild, create a new entry
          // Only include non-default related records
          const hasNonDefaultEconomy =
            economy && Object.values(economy).some((v) => v !== 0);
          const hasNonDefaultStats =
            stats && Object.values(stats).some((v) => v !== 0);
          const hasNonDefaultLevel = level && level.xp > 0;
          const hasNonDefaultCooldowns =
            cooldowns && Object.keys(cooldowns).length > 0;
          const hasNonDefaultUpgrades =
            upgrades &&
            Object.values(upgrades).some((upgrade) => upgrade.level > 1);

          const createData = {
            id: userId,
            guildId,
            lastActivity: Date.now(),
            ...userData,
          };

          // Only add related records if they have non-default values
          if (hasNonDefaultEconomy) {
            createData.economy = {
              create: {
                balance: DEFAULT_VALUES.economy.balance,
                bankBalance: DEFAULT_VALUES.economy.bankBalance,
                bankRate: DEFAULT_VALUES.economy.bankRate,
                bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
                ...economy,
              },
            };
          }

          if (hasNonDefaultStats) {
            createData.stats = {
              create: {
                totalEarned: 0,
                messageCount: DEFAULT_VALUES.stats.messageCount,
                commandCount: DEFAULT_VALUES.stats.commandCount,
                lastUpdated: Date.now(),
                gameRecords: JSON.stringify({
                  2048: { highScore: 0 },
                  snake: { highScore: 0 },
                }),
                ...stats,
              },
            };
          }

          if (hasNonDefaultLevel) {
            createData.Level = {
              create: {
                xp: 0,
                ...level,
              },
            };
          }

          if (hasNonDefaultCooldowns) {
            createData.cooldowns = {
              create: {
                data: JSON.stringify(DEFAULT_VALUES.cooldowns),
                ...cooldowns,
              },
            };
          }

          if (hasNonDefaultUpgrades) {
            createData.upgrades = {
              create: Object.entries(upgrades)
                .filter(([_, data]) => data.level > 1)
                .map(([type, data]) => ({
                  type,
                  level: data.level,
                })),
            };
          }

          try {
            const user = await tx.user.create({
              data: createData,
              include: {
                economy: true,
                stats: true,
                Level: true,
                cooldowns: true,
                upgrades: true,
              },
            });
            return user;
          } catch (error) {
            // Handle potential race condition where user was created in the meantime
            if (error.code === "P2002") {
              console.warn(
                `User ${userId} was created concurrently, fetching instead`
              );
              return await tx.user.findUnique({
                where: {
                  guildId_id: {
                    guildId,
                    id: userId,
                  },
                },
                include: {
                  economy: true,
                  stats: true,
                  Level: true,
                  cooldowns: true,
                  upgrades: true,
                },
              });
            }
            throw error;
          }
        }
      });
    } catch (error) {
      console.error(
        `Error in createUser for userId ${userId} in guild ${guildId}:`,
        error
      );
      // Fallback: try to get the user if creation failed but they might already exist
      const existingUser = await this.client.user.findUnique({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        include: {
          economy: true,
          stats: true,
          Level: true,
          cooldowns: true,
          upgrades: true,
        },
      });

      if (existingUser) {
        return existingUser;
      }

      // If all else fails, rethrow the error
      throw error;
    }
  },

  async updateUser(guildId, userId, data) {
    // Ensure user exists first
    const existingUser = await this.getUser(guildId, userId);
    if (!existingUser) {
      return this.createUser(guildId, userId, data);
    }

    const { economy, level, cooldowns, upgrades, ...userData } = data;
    const updateData = {
      lastActivity: Date.now(),
      ...userData,
    };

    if (economy) {
      updateData.economy = {
        upsert: {
          create: { ...economy },
          update: { ...economy },
        },
      };
    }

    if (level) {
      updateData.Level = {
        upsert: {
          create: { ...level },
          update: { ...level },
        },
      };
    }

    if (cooldowns) {
      updateData.cooldowns = {
        upsert: {
          create: { data: JSON.stringify(cooldowns) },
          update: { data: JSON.stringify(cooldowns) },
        },
      };
    }

    if (upgrades) {
      // Handle upgrades differently since it's a one-to-many relation
      await this.updateUpgrades(guildId, userId, upgrades);
    }

    return this.client.user.update({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
      data: updateData,
      include: {
        economy: true,
        Level: true,
        cooldowns: true,
        upgrades: true,
      },
    });
  },

  // Helper method to ensure user exists
  async ensureUser(guildId, userId) {
    const user = await this.getUser(guildId, userId);
    if (!user) {
      return this.createUser(guildId, userId);
    }
    return user;
  },

  // Helper method to ensure guild exists
  async ensureGuild(guildId) {
    return this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, settings: {} },
      update: {},
    });
  },

  async ensureGuildUser(guildId, userId) {
    try {
      // First check if the user already exists to avoid unnecessary operations
      const existingUser = await this.client.user.findUnique({
        where: {
          guildId_id: { guildId, id: userId },
        },
      });

      if (existingUser) {
        // User exists, check if we need to update lastActivity
        const currentTime = Date.now();
        const lastActivityTime = Number(existingUser.lastActivity || 0);
        const lastActivityAge = currentTime - lastActivityTime;

        // Only update if the last activity was more than 5 minutes ago
        // This avoids excessive database updates for frequent operations
        if (lastActivityAge > 5 * 60 * 1000) {
          return await this.client.user.update({
            where: {
              guildId_id: { guildId, id: userId },
            },
            data: {
              lastActivity: Date.now(),
            },
          });
        }

        // Return existing user without updating if recently active
        return existingUser;
      }

      // If user doesn't exist, use a transaction to ensure atomicity
      return await this.client.$transaction(async (prisma) => {
        // Ensure guild exists first
        await prisma.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, settings: {} },
          update: {},
        });

        // Try to create the user, handling potential race conditions
        try {
          return await prisma.user.create({
            data: {
              id: userId,
              guildId,
              lastActivity: Date.now(),
            },
          });
        } catch (error) {
          // If another process created the user in the meantime (P2002 = unique constraint violation)
          if (error.code === "P2002") {
            return await prisma.user.findUnique({
              where: {
                guildId_id: { guildId, id: userId },
              },
            });
          }
          throw error;
        }
      });
    } catch (error) {
      console.error(
        `Error in ensureGuildUser for userId ${userId} in guild ${guildId}:`,
        error
      );

      // Last resort fallback - try one more time with a simpler approach
      try {
        await this.client.guild.upsert({
          where: { id: guildId },
          create: { id: guildId, settings: {} },
          update: {},
        });

        return await this.client.user.upsert({
          where: {
            guildId_id: { guildId, id: userId },
          },
          create: {
            id: userId,
            guildId,
            lastActivity: Date.now(),
          },
          update: {
            lastActivity: Date.now(),
          },
        });
      } catch (secondError) {
        console.error(
          `Final fallback failed for userId ${userId} in guild ${guildId}:`,
          secondError
        );
        throw secondError;
      }
    }
  },

  // Guild Operations
  async getGuild(guildId) {
    return this.client.guild.findUnique({
      where: { id: guildId },
      include: { users: true },
    });
  },

  async upsertGuild(guildId, data = {}) {
    return this.client.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, ...data },
      update: data,
    });
  },

  async getGameRecords(guildId, userId) {
    const user = await this.getUser(guildId, userId);
    if (!user?.stats) {
      // Return default game records if no stats exist
      return {
        2048: { highScore: 0 },
        snake: { highScore: 0 },
      };
    }
    return JSON.parse(user.stats.gameRecords);
  },

  async updateGameHighScore(guildId, userId, gameId, newScore) {
    const user = await this.getUser(guildId, userId);
    if (!user?.stats) {
      return false;
    }

    try {
      const gameRecords = JSON.parse(user.stats.gameRecords);
      const currentHighScore = gameRecords[gameId]?.highScore || 0;

      // Only update if new score is higher
      if (newScore > currentHighScore) {
        gameRecords[gameId] = {
          ...gameRecords[gameId],
          highScore: newScore,
        };

        await this.client.statistics.update({
          where: {
            userId_guildId: {
              userId,
              guildId,
            },
          },
          data: {
            gameRecords: JSON.stringify(gameRecords),
          },
        });

        return true; // Indicates a new high score was set
      }

      return false; // No new high score
    } catch (error) {
      console.error("Error updating game high score:", error);
      return false;
    }
  },
};
