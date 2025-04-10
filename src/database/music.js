import Database from "./client.js";

const musicDB = {
  get client() {
    return Database.client;
  },

  async savePlayer(player) {
    try {
      if (!player || !player.guildId) {
        console.log("No player or invalid player provided to savePlayer");
        return null;
      }

      // Don't save if there's nothing to save
      if (
        !player.queue?.current &&
        (!player.queue?.tracks || player.queue.tracks.length === 0)
      ) {
        console.log(`No content to save for player ${player.guildId}`);
        return null;
      }

      // Helper function to safely extract avatar URL
      const getAvatarUrl = (requester) => {
        if (!requester) return null;

        // If avatarURL is a function, call it
        if (typeof requester.avatarURL === "function") {
          try {
            return requester.avatarURL();
          } catch (error) {
            console.error("Error getting avatar URL:", error);
            return null;
          }
        }

        // If it's already a string, return it
        if (typeof requester.avatarURL === "string") {
          return requester.avatarURL;
        }

        // Try displayAvatarURL as fallback
        if (typeof requester.displayAvatarURL === "function") {
          try {
            return requester.displayAvatarURL();
          } catch (error) {
            console.error("Error getting display avatar URL:", error);
            return null;
          }
        }

        return null;
      };

      // Prepare player data with safeguards against invalid data
      const playerData = {
        id: player.guildId,
        voiceChannelId: player.voiceChannelId || null,
        textChannelId: player.textChannelId || null,
        queue:
          player.queue?.tracks?.map((track) => ({
            encoded: track?.encoded || "",
            info: track?.info || {},
            requesterData: track?.requester
              ? {
                  id: track.requester.id,
                  username: track.requester.username || "Unknown",
                  displayName:
                    track.requester.displayName ||
                    track.requester.username ||
                    "Unknown",
                  avatarURL: getAvatarUrl(track.requester),
                  locale: track.requester.locale || "en",
                }
              : null,
          })) || [],
        currentTrack: player.queue?.current
          ? {
              encoded: player.queue.current.encoded || "",
              info: player.queue.current.info || {},
              requesterData: player.queue.current.requester
                ? {
                    id: player.queue.current.requester.id,
                    username:
                      player.queue.current.requester.username || "Unknown",
                    displayName:
                      player.queue.current.requester.displayName ||
                      player.queue.current.requester.username ||
                      "Unknown",
                    avatarURL: getAvatarUrl(player.queue.current.requester),
                    locale: player.queue.current.requester.locale || "en",
                  }
                : null,
            }
          : null,
        position: Math.max(0, Math.floor(player.position)) || 0,
        volume: player.volume || 100,
        repeatMode: player.repeatMode || "off",
        autoplay: !!player.get("autoplay_enabled"),
        filters: player.filters || {},
      };

      // Use a transaction for better reliability
      return await this.client.$transaction(
        async (tx) => {
          return await tx.musicPlayer.upsert({
            where: {
              id: playerData.id,
            },
            create: playerData,
            update: playerData,
          });
        },
        {
          timeout: 10000, // 10 second timeout
          isolationLevel: "ReadCommitted", // Less strict isolation level for better performance
        }
      );
    } catch (error) {
      console.error(
        `Failed to save player for guild ${player?.guildId || "unknown"}:`,
        error
      );
      return null;
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
