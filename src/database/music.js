import prisma from "./client.js";

const musicDB = {
  client: prisma.client,

  async savePlayer(player) {
    if (!player?.guildId) {
      console.error("Invalid player object provided");
      return null;
    }

    console.log("Saving player state:", {
      guildId: player.guildId,
      hasQueue: !!player.queue,
      queueState: player.queue && {
        current: !!player.queue.current,
        tracksLength: player.queue.tracks?.length,
        size: player.queue.size,
      },
    });

    // Don't save if there's nothing to save
    if (
      !player.queue?.current &&
      (!player.queue?.tracks || player.queue.tracks.length === 0)
    ) {
      console.log(`No content to save for player ${player.guildId}`);
      // Clean up any existing record
      try {
        await this.deletePlayer(player.guildId);
      } catch (error) {
        // Ignore deletion errors
        console.log(`No existing record found for ${player.guildId}`);
      }
      return null;
    }

    // Validate and transform queue
    let queue = [];
    if (player.queue?.tracks?.length > 0) {
      try {
        queue = player.queue.tracks.map((track) => {
          if (!track?.encoded || !track?.info) {
            throw new Error(`Invalid track object: ${JSON.stringify(track)}`);
          }
          return {
            encoded: track.encoded,
            info: track.info,
          };
        });
      } catch (error) {
        console.error("Error mapping queue tracks:", error);
        queue = [];
      }
    }

    // Validate current track
    let currentTrack = null;
    if (player.queue?.current) {
      try {
        if (!player.queue.current.encoded || !player.queue.current.info) {
          throw new Error("Invalid current track object");
        }
        currentTrack = {
          encoded: player.queue.current.encoded,
          info: player.queue.current.info,
        };
      } catch (error) {
        console.error("Error processing current track:", error);
      }
    }

    console.log("Saving player data:", {
      guildId: player.guildId,
      hasCurrentTrack: !!currentTrack,
      queueLength: queue.length,
    });

    try {
      // First try to delete any existing record to avoid conflicts
      try {
        await this.client.musicPlayer.delete({
          where: { id: player.guildId },
        });
      } catch (error) {
        // Ignore deletion errors
        console.log(`No existing record found for ${player.guildId}`);
      }

      // Then create a new record
      return await this.client.musicPlayer.create({
        data: {
          id: player.guildId,
          voiceChannelId: player.voiceChannelId || "",
          textChannelId: player.textChannelId || "",
          queue: queue,
          currentTrack: currentTrack
            ? {
                encoded: currentTrack.encoded,
                info: currentTrack.info,
              }
            : null,
          position: player.position || 0,
          volume: player.volume,
          repeatMode: player.repeatMode || "off",
          autoplay: player.get("autoplay") || false,
          filters: player.filters || {},
        },
      });
    } catch (error) {
      console.error("Error saving player:", error);
      throw error;
    }
  },

  async getPlayer(guildId) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    try {
      return await this.client.musicPlayer.findUnique({
        where: { id: guildId },
      });
    } catch (error) {
      console.error(`Error getting player ${guildId}:`, error);
      return null;
    }
  },

  async loadPlayers() {
    try {
      console.log("Attempting to load music players from database...");
      let players = await this.client.musicPlayer.findMany({
        where: {},
        select: {
          id: true,
          voiceChannelId: true,
          textChannelId: true,
          queue: true,
          currentTrack: true,
          position: true,
          volume: true,
          repeatMode: true,
          autoplay: true,
          filters: true,
        },
      });

      console.log("Database query completed");
      console.log("Found players:", {
        count: players?.length || 0,
        players: players,
      });
      return players || [];
    } catch (error) {
      console.error("Error loading music players:", error);
      return [];
    }
  },

  async deletePlayer(guildId) {
    if (!guildId) {
      console.log("No guild ID provided for deletion");
      return null;
    }

    try {
      return await this.client.musicPlayer.delete({
        where: { id: guildId },
      });
    } catch (error) {
      if (error.code === "P2025") {
        console.log(`No music player found for guild ${guildId}`);
        return null;
      }
      console.error(`Error deleting player ${guildId}:`, error);
      throw error;
    }
  },

  async ensurePlayer(guildId, data = {}) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    try {
      // Delete any existing record first
      try {
        await this.client.musicPlayer.delete({
          where: { id: guildId },
        });
      } catch (error) {
        // Ignore deletion errors
        console.log(`No existing record found for ${guildId}`);
      }

      // Create new record
      return await this.client.musicPlayer.create({
        data: {
          id: guildId,
          voiceChannelId: "",
          textChannelId: "",
          queue: [],
          currentTrack: null,
          position: 0,
          volume: 100,
          repeatMode: "off",
          autoplay: false,
          filters: {},
          ...data,
        },
      });
    } catch (error) {
      console.error(`Error ensuring player ${guildId}:`, error);
      throw error;
    }
  },

  async updatePlayer(guildId, data) {
    if (!guildId) {
      console.error("Guild ID is required");
      return null;
    }

    try {
      // Check if player exists first
      const exists = await this.client.musicPlayer.findUnique({
        where: { id: guildId },
        select: { id: true },
      });

      if (!exists) {
        // If it doesn't exist, create it
        return await this.client.musicPlayer.create({
          data: {
            id: guildId,
            ...data,
          },
        });
      }

      // If it exists, update it
      return await this.client.musicPlayer.update({
        where: { id: guildId },
        data,
      });
    } catch (error) {
      console.error(`Error updating player ${guildId}:`, error);
      throw error;
    }
  },
};

export default musicDB;
