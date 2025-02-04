const COLLECTION_INTERVAL = 60000; // 1 minute

export default {
  // Store interval reference
  pingInterval: null,

  async logAnalytics(type, data) {
    return this.client.analytics.create({
      data: {
        timestamp: Date.now(),
        type,
        data,
      },
    });
  },

  async getAnalytics(type, limit = 100) {
    return this.client.analytics.findMany({
      where: { type },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
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
  },

  stopPingCollection() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log("Ping collection stopped");
    }
  },
};
