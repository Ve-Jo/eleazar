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

  // System Monitoring
  async collectSystemPings() {
    try {
      // Get Postgres latency
      const postgresStart = Date.now();
      await this.client.$queryRaw`SELECT 1`; // Lighter query for latency check
      const postgresLatency = Date.now() - postgresStart;

      return {
        database: {
          averageSpeed: postgresLatency,
          ping: postgresLatency,
        },
        render: {
          recentRequests: 0,
          ping: 0, // This should be implemented based on your render server
        },
      };
    } catch (error) {
      console.error("Error collecting system pings:", error);
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
    }
  },

  async collectMusicPings(client) {
    try {
      if (!client.lavalink?.isInitialized) return null;

      const nodes = client.lavalink.nodeManager.nodes;
      let musicData = {
        players: 0,
        ping: 0,
      };

      for (const node of nodes.values()) {
        musicData.players += node.stats.players;
        musicData.ping = node.stats.latency;
      }

      return musicData;
    } catch (error) {
      console.error("Error collecting music pings:", error);
      return {
        players: 0,
        ping: 0,
      };
    }
  },

  async collectShardPings(client) {
    try {
      const shardsData = {};
      let totalGuilds = 0;

      // Use client.guilds.cache.size for single-shard bots
      if (!client.ws.shards) {
        totalGuilds = client.guilds.cache.size;
        shardsData[0] = {
          guilds: totalGuilds,
          ping: client.ws.ping,
        };
      } else {
        for (const shard of client.ws.shards.values()) {
          const guildCount = client.guilds.cache.filter(
            (g) => g.shardId === shard.id
          ).size;
          shardsData[shard.id] = {
            guildsOnShard: guildCount,
            shardPing: shard.ping,
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
      const [systemPings, musicPings, shardPings] = await Promise.all([
        this.collectSystemPings(),
        this.collectMusicPings(client),
        this.collectShardPings(client),
      ]);

      const pingData = {
        ...shardPings,
        music: musicPings,
        render: systemPings?.render,
        database: systemPings?.database,
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
