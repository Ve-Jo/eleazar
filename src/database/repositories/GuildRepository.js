import BaseRepository from "../BaseRepository.js";
import DatabaseConnection from "../connection.js";
import { DEFAULT_VALUES } from "../../utils/economy.js";

class GuildRepository extends BaseRepository {
  constructor() {
    super("guilds");
  }

  // Core Operations
  async getGuild(guildId) {
    try {
      const result = await DatabaseConnection.query(
        `SELECT * FROM guilds WHERE guild_id = $1`,
        [guildId]
      );

      if (!result.length) {
        return {
          settings: DEFAULT_VALUES.guild.settings,
          counting: DEFAULT_VALUES.guild.counting,
        };
      }

      return {
        settings: result[0].settings,
        counting: result[0].counting,
      };
    } catch (error) {
      console.error("Error in getGuild:", error);
      throw error;
    }
  }

  async updateGuild(guildId, data = {}) {
    try {
      const existing = await this.getGuild(guildId);
      const updateData = {
        settings: { ...existing.settings, ...(data.settings || {}) },
        counting: { ...existing.counting, ...(data.counting || {}) },
        updated_at: Date.now(),
      };

      await DatabaseConnection.query(
        `INSERT INTO guilds (guild_id, settings, counting, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) 
         DO UPDATE SET 
           settings = $2,
           counting = $3,
           updated_at = $4`,
        [
          guildId,
          updateData.settings,
          updateData.counting,
          updateData.updated_at,
        ]
      );

      return updateData;
    } catch (error) {
      console.error("Error in updateGuild:", error);
      throw error;
    }
  }

  async listGuilds() {
    try {
      const result = await DatabaseConnection.query(
        `SELECT guild_id FROM guilds`
      );
      return result.map((guild) => guild.guild_id);
    } catch (error) {
      console.error("Error in listGuilds:", error);
      throw error;
    }
  }
}

export default new GuildRepository();
