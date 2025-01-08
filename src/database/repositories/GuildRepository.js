import BaseRepository from "../BaseRepository.js";
import DatabaseConnection from "../connection.js";
import { DEFAULT_VALUES } from "../../utils/economy.js";

class GuildRepository extends BaseRepository {
  constructor() {
    super("guilds");
  }

  async getGuildSettings(guildId) {
    const guild = await this.findOne({ guild_id: guildId });
    if (!guild) {
      return {
        counting: DEFAULT_VALUES.guild.counting,
        settings: DEFAULT_VALUES.guild.settings,
      };
    }
    return {
      counting: guild.counting,
      settings: guild.settings,
    };
  }

  async updateGuildSettings(guildId, settings = {}) {
    // Get existing settings first
    const existing = (await this.findOne({ guild_id: guildId })) || {
      counting: DEFAULT_VALUES.guild.counting,
      settings: DEFAULT_VALUES.guild.settings,
    };

    // If no settings provided, return existing
    if (!settings || Object.keys(settings).length === 0) {
      return existing;
    }

    const data = {
      updated_at: Date.now(),
    };

    // Only include fields that are actually being updated
    if (settings.counting) {
      data.counting = { ...existing.counting, ...settings.counting };
    }
    if (settings.settings) {
      data.settings = { ...existing.settings, ...settings.settings };
    }

    // If no actual updates, return existing
    if (Object.keys(data).length === 1 && data.updated_at) {
      return existing;
    }

    return await this.upsert({ guild_id: guildId }, data);
  }

  async listGuilds() {
    const guilds = await this.find({}, "guild_id");
    return guilds.map((guild) => guild.guild_id);
  }

  async searchGuilds(prefix) {
    // Fix the query to properly handle the LIKE condition and join
    const query = `
      SELECT DISTINCT g.guild_id, g.counting, g.settings
      FROM guilds g
      WHERE g.guild_id::text LIKE $1 || '%'
    `;

    const results = await DatabaseConnection.query(query, [prefix]);

    return results.map((row) => ({
      key: row.guild_id,
      value: {
        counting: row.counting,
        settings: row.settings,
      },
    }));
  }
}

export default new GuildRepository();
