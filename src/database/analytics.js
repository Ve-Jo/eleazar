const COLLECTION_INTERVAL = 60000; // 1 minute
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_RETENTION_DAYS = 1; // Keep only 7 days of analytics by default

export default {
  // Store interval references
  pingInterval: null,
  cleanupInterval: null,

  // Configuration
  retentionDays: DEFAULT_RETENTION_DAYS,

  // Set retention policy
  setRetentionPolicy(days) {
    if (days <= 0) {
      console.warn("Invalid retention days, using default value");
      this.retentionDays = DEFAULT_RETENTION_DAYS;
    } else {
      this.retentionDays = days;
      console.log(`Analytics retention policy set to ${days} days`);
    }
  },

  async logAnalytics(type, data) {
    try {
      return await this.client.analytics.create({
        data: {
          timestamp: BigInt(Date.now()),
          type,
          data,
        },
      });
    } catch (error) {
      console.error(`Error logging analytics (${type}):`, error);
      // Return empty object instead of failing
      return {};
    }
  },

  async getAnalytics(type, limit = 100) {
    return this.client.analytics.findMany({
      where: { type },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  },

  // Cleanup old analytics data
  async cleanupOldAnalytics() {
    try {
      console.log("Beginning analytics cleanup...");

      // Get total count first
      const totalCount = await this.client.analytics.count();
      console.log(`Total analytics entries: ${totalCount}`);

      if (totalCount === 0) {
        console.log("No analytics entries to clean up.");
        return;
      }

      // Get the timestamp directly from the database as a string
      // This avoids any BigInt conversion issues
      const nowBigInt = BigInt(Date.now());
      console.log(`Current timestamp (BigInt): ${nowBigInt}`);

      // Ensure retentionDays is a number
      const retentionDays = Number(
        this.retentionDays || DEFAULT_RETENTION_DAYS
      );
      console.log(`Using retention days: ${retentionDays}`);

      // Calculate cutoff time
      const millisPerDay = BigInt(24 * 60 * 60 * 1000);
      // Use a number for days, then convert the final result to BigInt
      const retentionMs = BigInt(
        Math.floor(retentionDays * 24 * 60 * 60 * 1000)
      );
      const cutoffBigInt = nowBigInt - retentionMs;

      console.log(`Retention period: ${retentionDays} days`);
      console.log(`Retention milliseconds: ${retentionMs}`);
      console.log(`Cutoff timestamp (BigInt): ${cutoffBigInt}`);

      // Delete records
      try {
        const result = await this.client.analytics.deleteMany({
          where: {
            timestamp: {
              lt: cutoffBigInt,
            },
          },
        });

        console.log(`Deletion result: ${JSON.stringify(result)}`);

        if (result.count > 0) {
          console.log(
            `Cleaned up ${result.count} analytics entries older than ${this.retentionDays} days`
          );
        } else {
          console.log(
            `No analytics entries older than ${this.retentionDays} days found.`
          );
        }
      } catch (deleteError) {
        console.error(`Error during deletion:`, deleteError);
        console.error(`Error stack:`, deleteError.stack);
      }
    } catch (error) {
      console.error("Error cleaning up old analytics:", error);
      console.error("Error stack:", error.stack);
    }
  },

  // Simplified to return zeroes
  async collectSystemPings() {
    return {
      database: {
        averageSpeed: 0,
        ping: 0,
      },
      render: {
        recentRequests: 0,
        ping: 0,
      },
    };
  },

  // Simplified to return zeroes
  async collectMusicPings() {
    return {
      players: 0,
      ping: 0,
    };
  },

  async collectShardPings(client) {
    try {
      const shardsData = {};
      let totalGuilds = 0;

      // Use client.guilds.cache.size for single-shard bots
      if (!client.ws.shards) {
        totalGuilds = client.guilds.cache.size;
        // For non-sharded bots, still use the same structure but with shard 0
        shardsData[0] = {
          guildsOnShard: totalGuilds,
          shardPing: 0, // Zeroed out ping
        };
      } else {
        for (const shard of client.ws.shards.values()) {
          const guildCount = client.guilds.cache.filter(
            (g) => g.shardId === shard.id
          ).size;
          shardsData[shard.id] = {
            guildsOnShard: guildCount,
            shardPing: 0, // Zeroed out ping
          };
          totalGuilds += guildCount;
        }
      }

      return {
        serversCount: totalGuilds,
        shards: shardsData,
      };
    } catch (error) {
      console.error("Error collecting shard pings:", error);
      return {
        serversCount: 0,
        shards: {},
      };
    }
  },

  async recordPing(client) {
    try {
      const shardPings = await this.collectShardPings(client);

      const pingData = {
        ...shardPings,
        music: await this.collectMusicPings(),
        render: (await this.collectSystemPings()).render,
        database: (await this.collectSystemPings()).database,
      };

      await this.logAnalytics("ping", pingData);

      if (process.env.NODE_ENV !== "production") {
        console.log("Ping data recorded");
      }
    } catch (error) {
      console.error("Error recording ping:", error);
    }
  },

  startPingCollection(client) {
    this.stopPingCollection(); // Clear any existing interval
    this.pingInterval = setInterval(
      () => this.recordPing(client),
      COLLECTION_INTERVAL
    );
    console.log("Ping collection started");

    // Also start cleanup job
    this.startCleanupJob();
  },

  stopPingCollection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log("Ping collection stopped");
    }
  },

  startCleanupJob() {
    this.stopCleanupJob(); // Clear any existing interval

    // Run cleanup once immediately
    this.cleanupOldAnalytics();

    // Then schedule regular cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanupOldAnalytics(),
      CLEANUP_INTERVAL
    );
    console.log(
      `Analytics cleanup job started (retention: ${this.retentionDays} days)`
    );
  },

  stopCleanupJob() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log("Analytics cleanup job stopped");
    }
  },
};
