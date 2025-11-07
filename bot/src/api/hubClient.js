import fetch from "node-fetch";
import WebSocket from "ws";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";

dotenv.config();

// Hub service URLs
const DATABASE_SERVICE_URL =
  process.env.DATABASE_SERVICE_URL || "http://localhost:3003";
const RENDERING_SERVICE_URL =
  process.env.RENDERING_SERVICE_URL || "http://localhost:3004";
const LOCALIZATION_SERVICE_URL =
  process.env.LOCALIZATION_SERVICE_URL || "http://localhost:3005";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8080";
const AI_SERVICE_WS_URL =
  process.env.AI_SERVICE_WS_URL || "ws://localhost:8080/ws";
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
    this.aiUrl = AI_SERVICE_URL;
    this.aiWsUrl = AI_SERVICE_WS_URL;

    // In-memory translation cache and in-flight deduping
    this._translationCache = new Map(); // key -> { value, expiresAt }
    this._translationInFlight = new Map(); // key -> Promise
    this._translationTTL = 5 * 60 * 1000; // 5 minutes TTL

    // Group cache and deduping for bulk fetches
    this._translationGroupCache = new Map(); // key -> { value, expiresAt }
    this._translationGroupInFlight = new Map(); // key -> Promise
    this._translationGroupTTL = 5 * 60 * 1000; // 5 minutes TTL

    // WebSocket connection management
    this._activeWebSockets = new Map(); // requestId -> WebSocket
    this._wsConnectionPool = new Map(); // Pool for connection reuse
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

  // Personalization API methods
  async getUserProfile(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`
    );
  }

  async updateUserProfile(guildId, userId, profileData) {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`,
      {
        method: "PATCH",
        body: JSON.stringify(profileData),
      }
    );
  }

  async setUserPersonalization(guildId, userId, personalizationData) {
    return await this.updateUserProfile(guildId, userId, personalizationData);
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

  async getTotalBankBalance(guildId, userId) {
    const balanceData = await this.getBalance(guildId, userId);
    if (!balanceData) {
      return new Prisma.Decimal(0);
    }
    return balanceData.totalBankBalance || new Prisma.Decimal(0);
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
      body: JSON.stringify({ userId, guildId, gameType, xp: amount }),
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
    return await apiRequest(`${this.databaseUrl}/games/records/update`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, gameId: gameType, score }),
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

  // Crypto Wallet API methods
  async getUserCryptoWallets(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}`
    );
  }

  async getCryptoWallet(guildId, userId, currency) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositAddress(guildId, userId, currency) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/deposit-address/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositHistory(
    guildId,
    userId,
    currency = null,
    limit = 50,
    offset = 0
  ) {
    const params = new URLSearchParams();
    if (currency) params.append("currency", currency);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return await apiRequest(
      `${
        this.databaseUrl
      }/crypto-wallet/deposits/${guildId}/${userId}?${params.toString()}`
    );
  }

  async getCryptoWithdrawalHistory(
    guildId,
    userId,
    currency = null,
    limit = 50,
    offset = 0
  ) {
    const params = new URLSearchParams();
    if (currency) params.append("currency", currency);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return await apiRequest(
      `${
        this.databaseUrl
      }/crypto-wallet/withdrawals/${guildId}/${userId}?${params.toString()}`
    );
  }

  async requestCryptoWithdrawal(
    guildId,
    userId,
    currency,
    amount,
    toAddress,
    memo = null
  ) {
    return await apiRequest(`${this.databaseUrl}/crypto-wallet/withdrawals`, {
      method: "POST",
      body: JSON.stringify({
        userId,
        guildId,
        currency,
        amount,
        toAddress,
        memo,
      }),
    });
  }

  async getCryptoPortfolioValue(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/portfolio/${guildId}/${userId}`
    );
  }

  async startCryptoDepositListening(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "POST",
      }
    );
  }

  async stopCryptoDepositListening(guildId, userId) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAvailableChains(currency) {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/chains/${currency}`
    );
  }

  // Guild Vault API methods
  async getGuildVault(guildId) {
    return await apiRequest(`${this.databaseUrl}/guild-vault/vault/${guildId}`);
  }

  async getGuildVaultDistributions(guildId, limit = 10) {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distributions?limit=${limit}`
    );
  }

  async getUserVaultDistributions(guildId, userId, limit = 10) {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/user/${userId}/distributions?limit=${limit}`
    );
  }

  async triggerManualDistribution(guildId, userId, amount) {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distribute`,
      {
        method: "POST",
        body: JSON.stringify({ userId, amount }),
      }
    );
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
    // Build a stable cache key
    const stableStringify = (obj) => {
      if (!obj || typeof obj !== "object") return String(obj ?? "");
      const keys = Object.keys(obj).sort();
      const parts = keys.map((k) => {
        const v = obj[k];
        return `${encodeURIComponent(k)}=${
          typeof v === "object" && v !== null
            ? encodeURIComponent(stableStringify(v))
            : encodeURIComponent(String(v))
        }`;
      });
      return parts.join("&");
    };

    const effectiveLocale = locale || "en";
    const variablesKey = stableStringify(variables || {});
    const cacheKey = `${effectiveLocale}::${key}::${variablesKey}`;

    // Return cached translation if valid
    const cached = this._translationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Deduplicate concurrent requests for the same key
    const inFlight = this._translationInFlight.get(cacheKey);
    if (inFlight) {
      return await inFlight;
    }

    const url = `${
      this.localizationUrl
    }/i18n/translate?key=${encodeURIComponent(
      key
    )}&variables=${encodeURIComponent(
      JSON.stringify(variables)
    )}&locale=${encodeURIComponent(effectiveLocale)}`;

    const p = apiRequest(url)
      .then((data) => {
        // Cache the result with TTL
        this._translationCache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + this._translationTTL,
        });
        this._translationInFlight.delete(cacheKey);
        return data;
      })
      .catch((err) => {
        // Ensure we clear in-flight on error
        this._translationInFlight.delete(cacheKey);
        throw err;
      });

    this._translationInFlight.set(cacheKey, p);
    return await p;
  }

  async registerLocalizations(category, name, localizations, save = false) {
    // Invalidate caches for safety when registry updates
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    return await apiRequest(`${this.localizationUrl}/i18n/register`, {
      method: "POST",
      body: JSON.stringify({ category, name, localizations, save }),
    });
  }

  async addTranslation(locale, key, value, save = false) {
    // Invalidate caches for safety when new translations are added
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    return await apiRequest(`${this.localizationUrl}/i18n/add`, {
      method: "POST",
      body: JSON.stringify({ locale, key, value, save }),
    });
  }

  async getTranslationGroup(groupKey, locale) {
    const effectiveLocale = locale || "en";
    const cacheKey = `${effectiveLocale}::group::${groupKey || ""}`;

    // Return cached group if valid
    const cached = this._translationGroupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const data = cached.value;
      // Prime cache from cached group as well
      try {
        this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
      } catch (e) {
        console.warn("[hubClient] Failed to prime cache from cached group:", e);
      }
      return data;
    }

    // Deduplicate concurrent group requests
    const inFlight = this._translationGroupInFlight.get(cacheKey);
    if (inFlight) {
      const data = await inFlight;
      try {
        this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
      } catch (e) {
        console.warn(
          "[hubClient] Failed to prime cache (in-flight) from group:",
          e
        );
      }
      return data;
    }

    const url = `${
      this.localizationUrl
    }/i18n/group?groupKey=${encodeURIComponent(
      groupKey
    )}&locale=${encodeURIComponent(effectiveLocale)}`;

    const p = apiRequest(url)
      .then((data) => {
        // Cache the group response
        this._translationGroupCache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + this._translationGroupTTL,
        });
        this._translationGroupInFlight.delete(cacheKey);
        return data;
      })
      .catch((err) => {
        this._translationGroupInFlight.delete(cacheKey);
        throw err;
      });

    this._translationGroupInFlight.set(cacheKey, p);
    const data = await p;

    // Prime the per-key translation cache with returned group entries
    try {
      this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
    } catch (e) {
      // Don't fail group fetch if priming fails; just return data
      console.warn(
        "[hubClient] Failed to prime translation cache from group:",
        e
      );
    }

    return data;
  }

  // Internal helper: prime per-key cache from group response
  _primeCacheFromGroupData(data, effectiveLocale, groupKey = null) {
    // Helper to flatten nested objects into dot-notated keys
    const flatten = (obj, prefix = "") => {
      const entries = [];
      if (!obj || typeof obj !== "object") return entries;
      for (const [k, v] of Object.entries(obj)) {
        const keyPath = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") {
          entries.push(...flatten(v, keyPath));
        } else if (typeof v === "string") {
          entries.push([keyPath, v]);
        }
      }
      return entries;
    };

    // The API may return either a plain object of keys → strings,
    // or an object wrapped under { translations: { ... } }
    const base =
      data && typeof data === "object" && data.translations
        ? data.translations
        : data;

    const pairs = flatten(base);
    for (const [fullKey, value] of pairs) {
      const prefixedKey =
        groupKey && !fullKey.startsWith(groupKey)
          ? `${groupKey}.${fullKey}`
          : fullKey;
      const key = `${effectiveLocale}::${prefixedKey}::`;
      this._translationCache.set(key, {
        value,
        expiresAt: Date.now() + this._translationTTL,
      });
    }
  }

  async saveAllTranslations() {
    // Persisted changes — clear caches to avoid stale entries
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
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

  // AI Service API methods
  async getAvailableModels(capability = null) {
    const params = new URLSearchParams();
    if (capability) params.append("capability", capability);

    return await apiRequest(
      `${this.aiUrl}/models${params.toString() ? `?${params.toString()}` : ""}`
    );
  }

  async getModelDetails(modelId) {
    return await apiRequest(
      `${this.aiUrl}/models/${encodeURIComponent(modelId)}`
    );
  }

  async processAIRequest(requestData) {
    return await apiRequest(`${this.aiUrl}/process`, {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  async processAIStream(requestData, onChunk, onError, onComplete) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.aiWsUrl}`);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "process",
            data: requestData,
          })
        );
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());

          switch (message.type) {
            case "chunk":
              if (onChunk) onChunk(message.data);
              break;
            case "error":
              if (onError) onError(new Error(message.error));
              ws.close();
              reject(new Error(message.error));
              break;
            case "complete":
              ws.close();
              if (onComplete) onComplete(message.data);
              resolve(message.data);
              break;
            case "tool_call":
              if (onChunk) onChunk({ tool_call: message.data });
              break;
            case "tool_result":
              if (onChunk) onChunk({ tool_result: message.data });
              break;
          }
        } catch (error) {
          if (onError) onError(error);
        }
      });

      ws.on("error", (error) => {
        if (onError) onError(error);
        reject(error);
      });

      ws.on("close", (code, reason) => {
        if (code !== 1000) {
          const error = new Error(
            `WebSocket closed with code ${code}: ${reason}`
          );
          if (onError) onError(error);
          reject(error);
        }
      });

      // Set timeout for connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          const error = new Error("WebSocket connection timeout");
          if (onError) onError(error);
          reject(error);
        }
      }, 30000); // 30 second timeout
    });
  }

  async checkAIHealth() {
    try {
      return await apiRequest(`${this.aiUrl}/health`);
    } catch (error) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async getAIMetrics() {
    return await apiRequest(`${this.aiUrl}/metrics`);
  }

  async invalidateAIModelCache() {
    return await apiRequest(`${this.aiUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ type: "models" }),
    });
  }

  // New AI Hub integration methods for seamless bot integration
  async getAIHubModels(
    capability = null,
    refresh = false,
    userId = null,
    provider = null,
    sortBy = "featured", // Default to featured sorting
    sortOrder = "desc" // Featured models first
  ) {
    try {
      const params = new URLSearchParams();
      if (capability) params.append("capability", capability);
      if (refresh) params.append("refresh", "true");
      if (userId) params.append("userId", userId);
      if (provider) params.append("provider", provider);
      if (sortBy) params.append("sortBy", sortBy);
      if (sortOrder) params.append("sortOrder", sortOrder);

      console.log(`[getAIHubModels] Fetching models with params:`, {
        capability,
        refresh,
        userId,
        provider,
        sortBy,
        sortOrder,
      });

      // Use the main models endpoint with userId for subscription filtering
      // The hub will handle subscription-based filtering internally
      const endpoint = "/ai/models";

      const response = await apiRequest(
        `${this.aiUrl}${endpoint}${
          params.toString() ? `?${params.toString()}` : ""
        }`
      );

      console.log(
        `[getAIHubModels] Received ${
          response.models?.length || response.length || 0
        } models`
      );

      return response.models || response;
    } catch (error) {
      console.error("Error fetching AI hub models:", error);
      throw error;
    }
  }

  async processAIHubRequest(requestData) {
    try {
      const response = await apiRequest(`${this.aiUrl}/ai/process`, {
        method: "POST",
        body: JSON.stringify(requestData),
      });

      // The hub wraps non-streaming responses as { success, data, requestId, ... }
      // Normalize to an OpenAI-like { choices: [{ message: { ... } }] } shape
      const data = response && response.data ? response.data : response;
      if (data && data.content !== undefined) {
        return {
          choices: [
            {
              message: {
                content: data.content || "",
                reasoning: data.reasoning || "",
                tool_calls: data.toolCalls || [],
              },
            },
          ],
          usage: data.usage || null,
          model: data.model,
          provider: data.provider,
        };
      }

      // Fallback to original response if already in expected shape
      return response;
    } catch (error) {
      console.error("Error processing AI hub request:", error);
      throw error;
    }
  }

  async processAIHubStream(requestData, onChunk, onError, onComplete) {
    const requestId = requestData.requestId;
    console.log(
      `[processAIHubStream] Starting stream for request ${requestId}`
    );

    // Check if we already have an active connection for this request
    if (this._activeWebSockets.has(requestId)) {
      console.warn(
        `[processAIHubStream] Already have active connection for request ${requestId}, cleaning up old connection`
      );
      try {
        const oldWs = this._activeWebSockets.get(requestId);
        if (oldWs && oldWs.readyState === WebSocket.OPEN) {
          oldWs.close(1000, "Replaced by new connection");
        }
      } catch (e) {
        console.error("[processAIHubStream] Error closing old connection:", e);
      }
      this._activeWebSockets.delete(requestId);
    }

    return new Promise((resolve, reject) => {
      let ws = null;
      let isResolved = false;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 2; // Reduced to prevent excessive reconnections
      const reconnectDelay = 1500; // Increased delay

      const safeCall = (fn, ...args) => {
        try {
          if (typeof fn === "function") fn(...args);
        } catch (e) {
          console.error("Stream callback error:", e);
        }
      };

      const cleanup = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, "Normal closure");
          } catch (e) {
            console.error("Error closing WebSocket:", e);
          }
        }
        this._activeWebSockets.delete(requestId);
        ws = null;
      };

      const resolveOnce = (data) => {
        if (!isResolved) {
          isResolved = true;
          if (typeof connectionTimeout !== "undefined") {
            clearTimeout(connectionTimeout);
          }
          cleanup();
          console.log(
            `[processAIHubStream] Stream resolved for request ${requestId}`
          );
          resolve(data);
        }
      };

      const rejectOnce = (error) => {
        if (!isResolved) {
          isResolved = true;
          if (typeof connectionTimeout !== "undefined") {
            clearTimeout(connectionTimeout);
          }
          cleanup();
          console.error(
            `[processAIHubStream] Stream rejected for request ${requestId}:`,
            error.message
          );
          reject(error);
        }
      };

      const connect = () => {
        try {
          ws = new WebSocket(`${this.aiWsUrl}`);
          this._activeWebSockets.set(requestId, ws);

          ws.on("open", () => {
            console.log(
              `[processAIHubStream] WebSocket connected for request ${requestId}`
            );
            reconnectAttempts = 0;

            const msg = {
              type: "ai_request",
              requestId: requestData.requestId,
              data: {
                requestId: requestData.requestId,
                model: requestData.model,
                provider: requestData.provider,
                messages: requestData.messages,
                parameters: { ...(requestData.parameters || {}), stream: true },
                stream: true,
              },
              timestamp: Date.now(),
            };

            try {
              ws.send(JSON.stringify(msg));
            } catch (sendError) {
              console.error(
                "[processAIHubStream] Error sending message:",
                sendError
              );
              safeCall(onError, sendError);
            }
          });

          ws.on("message", (raw) => {
            let message;
            try {
              message = JSON.parse(raw.toString());
            } catch (e) {
              console.error("[processAIHubStream] Error parsing message:", e);
              safeCall(onError, e);
              return;
            }

            switch (message.type) {
              case "connected":
              case "request_acknowledged":
                break;
              case "stream_chunk": {
                const chunk =
                  message.chunk || message.data?.chunk || message.data;
                if (!chunk) break;

                // Handle different chunk formats from the hub
                let mapped;
                if (chunk.type === "content" && chunk.data) {
                  // Hub sends content in chunk.data for content-type chunks
                  mapped = {
                    content: chunk.data || "",
                    reasoning: "",
                    tool_call: undefined,
                    finish_reason: undefined,
                  };
                } else if (chunk.type === "reasoning" && chunk.data) {
                  // Hub sends reasoning in chunk.data for reasoning-type chunks
                  // Extract the actual text content from the reasoning object
                  let reasoningText = "";
                  if (typeof chunk.data === "string") {
                    reasoningText = chunk.data;
                  } else if (chunk.data && chunk.data.content) {
                    reasoningText = chunk.data.content;
                  } else if (chunk.data && typeof chunk.data === "object") {
                    // Fallback: try to get any string property
                    reasoningText = JSON.stringify(chunk.data);
                  }

                  mapped = {
                    content: "",
                    reasoning: reasoningText,
                    tool_call: undefined,
                    finish_reason: undefined,
                  };
                } else if (chunk.type === "tool_calls" && chunk.data) {
                  // Hub sends tool calls in chunk.data for tool-type chunks
                  mapped = {
                    content: "",
                    reasoning: "",
                    tool_call: chunk.data[0] || undefined,
                    finish_reason: undefined,
                  };
                } else {
                  // Fallback to direct chunk properties (unified format)
                  mapped = {
                    content: chunk.content || "",
                    reasoning: chunk.reasoning || "",
                    tool_call: chunk.toolCalls?.[0] || undefined,
                    finish_reason: chunk.finishReason || undefined,
                  };
                }

                safeCall(onChunk, mapped);
                break;
              }
              case "tool_call": {
                const toolCall = message.toolCall || message.data?.toolCall;
                if (toolCall) safeCall(onChunk, { tool_call: toolCall });
                break;
              }
              case "error": {
                const errMsg =
                  message.error?.message || message.error || "Unknown error";
                const err = new Error(errMsg);
                console.error("[processAIHubStream] Hub error:", err);
                safeCall(onError, err);
                ws.close();
                rejectOnce(err);
                break;
              }
              case "stream_complete": {
                const finalData = {
                  finishReason:
                    message.finishReason ||
                    message.data?.finishReason ||
                    "stop",
                };
                safeCall(onComplete, finalData);
                ws.close();
                resolveOnce(finalData);
                break;
              }
              case "session_closed": {
                console.log("[processAIHubStream] Session closed by hub");
                ws.close();
                break;
              }
              default:
                break;
            }
          });

          ws.on("error", (error) => {
            console.error("[processAIHubStream] WebSocket error:", error);
            safeCall(onError, error);
            handleConnectionError(error);
          });

          ws.on("close", (code, reason) => {
            console.log(
              `[processAIHubStream] WebSocket closed: code=${code} reason=${
                reason?.toString?.() || ""
              }`
            );

            if (code === 1000) {
              // Normal closure
              if (!isResolved) {
                resolveOnce({ finishReason: "stop" });
              }
            } else if (code === 1005) {
              // No status code - often indicates clean disconnect
              console.log(
                `[processAIHubStream] Clean disconnect for request ${requestId}`
              );
              if (!isResolved) {
                resolveOnce({ finishReason: "stop" });
              }
            } else {
              // Other error codes - attempt reconnect only if we haven't resolved yet
              if (!isResolved && reconnectAttempts < maxReconnectAttempts) {
                console.log(
                  `[processAIHubStream] Connection lost, attempting reconnect ${
                    reconnectAttempts + 1
                  }/${maxReconnectAttempts}`
                );
                handleConnectionError(
                  new Error(`Connection lost (code ${code})`)
                );
              } else if (!isResolved) {
                const err = new Error(
                  `WebSocket closed with code ${code}: ${
                    reason?.toString?.() || ""
                  }`
                );
                safeCall(onError, err);
                rejectOnce(err);
              }
            }
          });
        } catch (connectionError) {
          console.error(
            "[processAIHubStream] Connection failed:",
            connectionError
          );
          handleConnectionError(connectionError);
        }
      };

      const handleConnectionError = (error) => {
        if (reconnectAttempts < maxReconnectAttempts && !isResolved) {
          reconnectAttempts++;
          console.log(
            `[processAIHubStream] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
          );
          setTimeout(() => {
            if (!isResolved) {
              cleanup();
              connect();
            }
          }, reconnectDelay);
        } else {
          console.error(
            "[processAIHubStream] Max reconnection attempts reached or already resolved"
          );
          rejectOnce(error);
        }
      };

      // Set timeout for initial connection
      let connectionTimeout;

      const startConnection = () => {
        connectionTimeout = setTimeout(() => {
          if (!isResolved && (!ws || ws.readyState !== WebSocket.OPEN)) {
            const timeoutError = new Error("WebSocket connection timeout");
            console.error("[processAIHubStream] Connection timeout");
            rejectOnce(timeoutError);
          }
        }, 30000); // 30 second timeout

        // Start connection
        connect();
      };

      startConnection();
    });
  }

  async stopAIHubStream(requestId) {
    // Implementation for stopping streams if needed
    console.log(`[stopAIHubStream] Stopping stream for request ${requestId}`);
    const ws = this._activeWebSockets.get(requestId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(1000, "Client requested stop");
        console.log(
          `[stopAIHubStream] Successfully stopped stream for request ${requestId}`
        );
      } catch (e) {
        console.error(
          `[stopAIHubStream] Error stopping stream for request ${requestId}:`,
          e
        );
      }
    }
    this._activeWebSockets.delete(requestId);
    return true;
  }

  /**
   * Process AI request with streaming through hub
   * @param {Object} requestData - Request data
   * @param {Function} onChunk - Callback for streaming chunks
   * @param {Function} onError - Callback for errors
   * @param {Function} onComplete - Callback for completion
   * @returns {Promise<void>}
   */
  async processAIStream(requestData, onChunk, onError, onComplete) {
    // Alias to processAIHubStream for backwards compatibility
    return this.processAIHubStream(requestData, onChunk, onError, onComplete);
  }

  /**
   * Transcribe audio through AI Hub
   * @param {Object} params - Transcription parameters
   * @param {Buffer} params.audioData - Audio file data
   * @param {string} params.filename - Original filename
   * @param {string} params.language - Language code (optional)
   * @param {string} params.userId - User ID for subscription access
   * @returns {Promise<Object>} Transcription result
   */
  async transcribeAudio({ audioData, filename, language = "auto", userId }) {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([audioData]), filename);
      formData.append("model", "whisper-1");
      formData.append("language", language);
      formData.append("userId", userId);

      const response = await apiRequest(`${this.aiUrl}/ai/audio/transcribe`, {
        method: "POST",
        body: formData,
      });

      return response.data;
    } catch (error) {
      console.error("Error transcribing audio through hub:", error);
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const hubClient = new HubClient();
export { hubClient };
export default hubClient;
