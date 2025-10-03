import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

// Hub service URLs
const DATABASE_SERVICE_URL =
  process.env.DATABASE_SERVICE_URL || "http://localhost:3003";
const RENDERING_SERVICE_URL =
  process.env.RENDERING_SERVICE_URL || "http://localhost:3004";
const LOCALIZATION_SERVICE_URL =
  process.env.LOCALIZATION_SERVICE_URL || "http://localhost:3005";
// Re-export constants from the hub (these should match the hub's constants)
export const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000, // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 1 week
  work: 3 * 60 * 60 * 1000, // 3 hours
  crime: 2 * 60 * 60 * 1000, // 2 hours
  message: 60 * 1000, // 1 minute
  upgraderevert: 10 * 60 * 1000, // 10 minutes
};

export const CRATE_TYPES = {
  daily: {
    cooldown: 24 * 60 * 60 * 1000,
    emoji: "🎁",
    rewards: {
      min_coins: 10,
      max_coins: 100,
      xp_chance: 0.5,
      xp_amount: 50,
      discount_chance: 0.3,
      discount_amount: 5,
      cooldown_reducer_chance: 0,
      cooldown_reducer_amount: 0,
    },
  },
  weekly: {
    cooldown: 7 * 24 * 60 * 60 * 1000,
    emoji: "📦",
    rewards: {
      min_coins: 50,
      max_coins: 250,
      xp_chance: 0.5,
      xp_amount: 100,
      discount_chance: 0.3,
      discount_amount: 5,
      cooldown_reducer_chance: 0,
      cooldown_reducer_amount: 0,
    },
  },
};

export const UPGRADES = {
  daily_bonus: {
    emoji: "🎁",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15,
    category: "economy",
  },
  daily_cooldown: {
    emoji: "⏳",
    basePrice: 50,
    priceMultiplier: 1.4,
    effectValue: 30 * 60 * 1000,
    category: "cooldowns",
  },
  crime: {
    emoji: "🦹",
    basePrice: 50,
    priceMultiplier: 1.2,
    effectValue: 20 * 60 * 1000,
    category: "cooldowns",
  },
  bank_rate: {
    emoji: "💰",
    basePrice: 100,
    priceMultiplier: 1.6,
    effectValue: 0.05,
    category: "economy",
  },
  games_earning: {
    emoji: "🎮",
    basePrice: 75,
    priceMultiplier: 1.3,
    effectMultiplier: 0.1,
    category: "economy",
  },
};

export const DEFAULT_VALUES = {
  user: {
    balance: 0,
    xp: 0,
    bannerUrl: null,
    lastActivity: Date.now(),
  },
  economy: {
    balance: 0,
    bankBalance: 0,
    bankRate: 0,
    bankStartTime: 0,
  },
  stats: {
    messageCount: 0,
    commandCount: 0,
    totalEarned: 0,
  },
  cooldowns: {},
  upgrades: {
    daily_bonus: { level: 1 },
    daily_cooldown: { level: 1 },
    crime: { level: 1 },
    bank_rate: { level: 1 },
    games_earning: { level: 1 },
  },
  ping: {
    music: { players: 0, ping: 0 },
    render: { recentRequests: 0, ping: 0 },
    database: { averageSpeed: 0, ping: 0 },
  },
  guild: {
    settings: {},
  },
};

// Helper function to parse numeric strings to numbers recursively
function parseNumericStrings(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(parseNumericStrings);
  }

  if (typeof obj === "object") {
    const parsed = {};
    for (const [key, value] of Object.entries(obj)) {
      parsed[key] = parseNumericStrings(value);
    }
    return parsed;
  }

  if (typeof obj === "string") {
    // Check if string represents a decimal number
    const numericValue = parseFloat(obj);
    if (
      !isNaN(numericValue) &&
      isFinite(numericValue) &&
      obj.trim() === numericValue.toString()
    ) {
      return numericValue;
    }
  }

  return obj;
}

// Helper function for API requests
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return parseNumericStrings(data);
  } catch (error) {
    console.error(`API request error for ${url}:`, error);
    throw error;
  }
}

// Hub API Client Class
class HubClient {
  constructor() {
    this.databaseUrl = DATABASE_SERVICE_URL;
    this.renderingUrl = RENDERING_SERVICE_URL;
    this.localizationUrl = LOCALIZATION_SERVICE_URL;
  }

  // Database API methods
  async getUser(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`);
  }

  async createUser(userData) {
    return await apiRequest(`${this.databaseUrl}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(guildId, userId, updateData) {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });
  }

  async deleteUser(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`, {
      method: "DELETE",
    });
  }

  async ensureUser(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/users/ensure`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async addBalance(guildId, userId, amount) {
    return await apiRequest(`${this.databaseUrl}/economy/balance/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async getBalance(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/economy/balance/${guildId}/${userId}`
    );
  }

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    return await apiRequest(`${this.databaseUrl}/economy/transfer`, {
      method: "POST",
      body: JSON.stringify({ fromUserId, toUserId, guildId, amount }),
    });
  }

  async updateBankBalance(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/economy/bank/update`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async calculateInterest(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/economy/bank/interest`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async revertUpgrade(guildId, userId, upgradeType) {
    return await apiRequest(`${this.databaseUrl}/economy/upgrades/revert`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUpgradeInfo(upgradeType, level) {
    return await apiRequest(
      `${this.databaseUrl}/economy/upgrades/info/${upgradeType}/${level}`
    );
  }

  async setCooldown(guildId, userId, type, duration) {
    return await apiRequest(`${this.databaseUrl}/cooldowns/`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, type, duration }),
    });
  }

  async getCooldown(guildId, userId, type) {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`
    );
  }

  async getCrateCooldown(guildId, userId, type) {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/crate/${guildId}/${userId}/${type}`
    );
  }

  async deleteCooldown(guildId, userId, type) {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllCooldowns(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}`
    );
  }

  async addXP(guildId, userId, amount) {
    return await apiRequest(`${this.databaseUrl}/xp/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async getUserLevel(guildId, userId, type = "activity") {
    return await apiRequest(
      `${this.databaseUrl}/xp/level/${guildId}/${userId}?type=${type}`
    );
  }

  async getAllUserLevels(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/xp/levels/${guildId}/${userId}`
    );
  }

  async calculateLevelFromXP(xp) {
    return await apiRequest(`${this.databaseUrl}/xp/calculate`, {
      method: "POST",
      body: JSON.stringify({ xp }),
    });
  }

  async checkLevelUpFromXP(guildId, userId, oldXp, newXp) {
    return await apiRequest(`${this.databaseUrl}/xp/check-levelup`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, oldXp, newXp }),
    });
  }

  async addGameXP(guildId, userId, gameType, amount) {
    return await apiRequest(`${this.databaseUrl}/games/xp/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, gameType, amount }),
    });
  }

  // Guild management methods
  async getGuild(guildId) {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}`);
  }

  async ensureGuild(guildId, guildData = {}) {
    return await apiRequest(`${this.databaseUrl}/guilds/ensure`, {
      method: "POST",
      body: JSON.stringify({ guildId, ...guildData }),
    });
  }

  async updateGuild(guildId, updateData) {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  }

  async ensureGuildUser(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/guilds/${guildId}/users/ensure`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      }
    );
  }

  async updateGameHighScore(guildId, userId, gameType, score) {
    return await apiRequest(`${this.databaseUrl}/games/records`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, gameType, score }),
    });
  }

  async getGameRecords(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/games/records/${guildId}/${userId}`
    );
  }

  // Voice session management methods
  async createVoiceSession(guildId, userId, channelId, joinTime = Date.now()) {
    return await apiRequest(`${this.databaseUrl}/voice/sessions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, channelId, joinTime }),
    });
  }

  async getVoiceSession(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`
    );
  }

  async removeVoiceSession(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllGuildVoiceSessions(guildId) {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/guild/${guildId}`
    );
  }

  async calculateVoiceXP(guildId, userId, sessionDuration) {
    return await apiRequest(`${this.databaseUrl}/voice/xp/calculate`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, sessionDuration }),
    });
  }

  async purchaseUpgrade(guildId, userId, upgradeType) {
    return await apiRequest(`${this.databaseUrl}/economy/upgrades/purchase`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUserUpgrades(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/economy/upgrades/${guildId}/${userId}`
    );
  }

  // Level role management methods
  async getGuildLevelRoles(guildId) {
    return await apiRequest(`${this.databaseUrl}/levels/roles/${guildId}`);
  }

  async getEligibleRolesForLevel(guildId, level) {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/level/${level}`
    );
  }

  async getNextLevelRole(guildId, currentLevel) {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/next/${currentLevel}`
    );
  }

  async addLevelRole(guildId, level, roleId) {
    return await apiRequest(`${this.databaseUrl}/levels/roles`, {
      method: "POST",
      body: JSON.stringify({ guildId, level, roleId }),
    });
  }

  async removeLevelRole(guildId, level) {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/${level}`,
      {
        method: "DELETE",
      }
    );
  }

  async updateStats(guildId, userId, statType, increment = 1) {
    return await apiRequest(`${this.databaseUrl}/stats/${userId}/${guildId}`, {
      method: "PATCH",
      body: JSON.stringify({ statType, increment }),
    });
  }

  async getStatistics(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/stats/${guildId}/${userId}`);
  }

  async getInteractionStats(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}`
    );
  }

  async getMostUsedInteractions(guildId, userId, limit = 10) {
    return await apiRequest(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}/top?limit=${limit}`
    );
  }

  // Crypto trading methods
  async createCryptoPosition(guildId, userId, symbol, amount, price, type) {
    return await apiRequest(`${this.databaseUrl}/crypto/positions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, symbol, amount, price, type }),
    });
  }

  async getUserCryptoPositions(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${guildId}/${userId}`
    );
  }

  async getCryptoPositionById(positionId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/id/${positionId}`
    );
  }

  async updateCryptoPosition(positionId, updateData) {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "PUT",
        body: JSON.stringify(updateData),
      }
    );
  }

  async deleteCryptoPosition(positionId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllActiveCryptoPositions() {
    return await apiRequest(`${this.databaseUrl}/crypto/positions/active/all`);
  }

  // Marriage API methods
  async getMarriageStatus(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/marriage/status/${userId}?guildId=${guildId}`
    );
  }

  async proposeMarriage(guildId, userId1, userId2) {
    return await apiRequest(`${this.databaseUrl}/marriage/propose`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async acceptMarriage(guildId, userId1, userId2) {
    return await apiRequest(`${this.databaseUrl}/marriage/accept`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async rejectMarriage(guildId, userId1, userId2) {
    return await apiRequest(`${this.databaseUrl}/marriage/reject`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async dissolveMarriage(guildId, userId1, userId2) {
    return await apiRequest(`${this.databaseUrl}/marriage/dissolve`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  // Bank and Economy API methods
  async calculateBankBalance(user, tx = null) {
    return await apiRequest(`${this.databaseUrl}/economy/bank/calculate`, {
      method: "POST",
      body: JSON.stringify({ user, tx }),
    });
  }

  async deposit(guildId, userId, amount) {
    return await apiRequest(`${this.databaseUrl}/economy/deposit`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async withdraw(guildId, userId, amount) {
    return await apiRequest(`${this.databaseUrl}/economy/withdraw`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  // Level calculation methods
  calculateLevel(xp) {
    const xpNumber = typeof xp === "bigint" ? Number(xp) : xp;
    const level = Math.floor(Math.sqrt(xpNumber / 100)) + 1;
    const currentLevelXP = Math.pow(level - 1, 2) * 100;
    const nextLevelXP = Math.pow(level, 2) * 100;
    const actualLevel = xpNumber < 100 ? 1 : level;

    return {
      level: actualLevel,
      currentXP: xpNumber - currentLevelXP,
      requiredXP: nextLevelXP - currentLevelXP,
      totalXP: xpNumber,
    };
  }

  checkLevelUp(oldXp, newXp) {
    const oldXpNumber = typeof oldXp === "bigint" ? Number(oldXp) : oldXp;
    const newXpNumber = typeof newXp === "bigint" ? Number(newXp) : newXp;

    const oldLevelCalc = Math.floor(Math.sqrt(oldXpNumber / 100)) + 1;
    const oldLevel = oldXpNumber < 100 ? 1 : oldLevelCalc;

    const newLevelCalc = Math.floor(Math.sqrt(newXpNumber / 100)) + 1;
    const newLevel = newXpNumber < 100 ? 1 : newLevelCalc;

    if (newLevel > oldLevel) {
      return {
        oldLevel,
        newLevel,
        levelUp: true,
      };
    }

    return null;
  }

  // Music Player API methods
  async savePlayer(player) {
    return await apiRequest(`${this.databaseUrl}/music/players`, {
      method: "POST",
      body: JSON.stringify({ player }),
    });
  }

  async loadPlayers() {
    return await apiRequest(`${this.databaseUrl}/music/players`);
  }

  async deletePlayer(guildId) {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "DELETE",
    });
  }

  async getPlayer(guildId) {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`);
  }

  async updatePlayer(guildId, data) {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Crate methods
  async getUserCrates(guildId, userId) {
    return await apiRequest(`${this.databaseUrl}/crates/${guildId}/${userId}`);
  }

  async openCrate(guildId, userId, crateType) {
    return await apiRequest(`${this.databaseUrl}/crates/open`, {
      method: "POST",
      body: JSON.stringify({
        userId: userId,
        guildId: guildId,
        type: crateType,
      }),
    });
  }

  async transferBalance(guildId, fromUserId, toUserId, amount) {
    return await apiRequest(`${this.databaseUrl}/economy/transfer`, {
      method: "POST",
      body: JSON.stringify({ fromUserId, toUserId, guildId, amount }),
    });
  }

  // Guild and Season methods
  async getGuildUsers(guildId) {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}/users`);
  }

  async getCurrentSeason() {
    return await apiRequest(`${this.databaseUrl}/seasons/current`);
  }

  async getSeasonLeaderboard(limit = 250) {
    return await apiRequest(
      `${this.databaseUrl}/seasons/leaderboard?limit=${limit}`
    );
  }

  // User locale methods
  async getUserLocale(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`
    );
  }

  async setUserLocale(guildId, userId, locale) {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`,
      {
        method: "PUT",
        body: JSON.stringify({ locale }),
      }
    );
  }

  // Transaction methods
  async executeTransaction(operations) {
    return await apiRequest(`${this.databaseUrl}/transaction`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
  }

  // Cache management methods
  async invalidateCache(keys) {
    return await apiRequest(`${this.databaseUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ keys }),
    });
  }

  async getFromCache(key) {
    return await apiRequest(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`
    );
  }

  async setCache(key, value, ttl = null) {
    return await apiRequest(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value, ttl }),
      }
    );
  }

  // Legacy game data methods
  async getLegacyGameData(guildId, userId, gameId) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}?guildId=${guildId}`
    );
  }

  async setLegacyGameData(guildId, userId, gameId, data) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, data }),
      }
    );
  }

  async getLegacyValue(guildId, userId, gameId, key) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}?guildId=${guildId}`
    );
  }

  async setLegacyValue(guildId, userId, gameId, key, value) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, value }),
      }
    );
  }

  async incLegacyValue(guildId, userId, gameId, key, increment = 1) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/increment`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, increment }),
      }
    );
  }

  async decLegacyValue(guildId, userId, gameId, key, decrement = 1) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/decrement`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, decrement }),
      }
    );
  }

  async deleteLegacyValue(guildId, userId, gameId, key) {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "DELETE",
        body: JSON.stringify({ guildId }),
      }
    );
  }

  // Rendering API methods
  async generateImage(
    component,
    props = {},
    scaling = { image: 1, emoji: 1 },
    locale = "en",
    options = {}
  ) {
    const response = await fetch(`${this.renderingUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        component,
        props,
        scaling,
        locale,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Image generation failed: ${response.status} ${response.statusText}`
      );
    }

    // Check if response is JSON (with coloring data) or binary (image buffer)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const jsonResponse = await response.json();
      // If it's a JSON response with image and coloring, convert to expected format
      if (jsonResponse.image && jsonResponse.coloring) {
        const buffer = Buffer.from(jsonResponse.image, "base64");
        return [buffer, jsonResponse.coloring];
      }
      return jsonResponse;
    } else {
      return await response.buffer();
    }
  }

  async processImageColors(imageUrl) {
    return await apiRequest(`${this.renderingUrl}/colors`, {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
    });
  }

  async getAvailableComponents() {
    return await apiRequest(`${this.renderingUrl}/components`);
  }

  // Health check methods
  async checkDatabaseHealth() {
    try {
      return await apiRequest(`${this.databaseUrl}/health`);
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkRenderingHealth() {
    try {
      return await apiRequest(`${this.renderingUrl}/health`);
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkHealth() {
    const [database, rendering] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRenderingHealth(),
    ]);

    return {
      database,
      rendering,
      overall:
        database.status === "healthy" && rendering.status === "healthy"
          ? "healthy"
          : "degraded",
    };
  }

  // Localization methods
  async getTranslation(key, variables = {}, locale) {
    return await apiRequest(
      `${this.localizationUrl}/i18n/translate?key=${encodeURIComponent(
        key
      )}&variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}&locale=${encodeURIComponent(locale)}`
    );
  }

  async registerLocalizations(category, name, localizations, save = false) {
    return await apiRequest(`${this.localizationUrl}/i18n/register`, {
      method: "POST",
      body: JSON.stringify({ category, name, localizations, save }),
    });
  }

  async addTranslation(locale, key, value, save = false) {
    return await apiRequest(`${this.localizationUrl}/i18n/add`, {
      method: "POST",
      body: JSON.stringify({ locale, key, value, save }),
    });
  }

  async getTranslationGroup(groupKey, locale) {
    return await apiRequest(
      `${this.localizationUrl}/i18n/group?groupKey=${encodeURIComponent(
        groupKey
      )}&locale=${encodeURIComponent(locale)}`
    );
  }

  async saveAllTranslations() {
    return await apiRequest(`${this.localizationUrl}/i18n/save-all`, {
      method: "POST",
    });
  }

  async setHubLocale(locale) {
    return await apiRequest(`${this.localizationUrl}/i18n/set-locale`, {
      method: "POST",
      body: JSON.stringify({ locale }),
    });
  }

  async getHubLocale() {
    return await apiRequest(`${this.localizationUrl}/i18n/locale`);
  }

  async getSupportedLocales() {
    return await apiRequest(`${this.localizationUrl}/i18n/locales`);
  }
}

// Create and export a singleton instance
const hubClient = new HubClient();
export { hubClient };
export default hubClient;
