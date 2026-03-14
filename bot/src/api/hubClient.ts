import fetch from "node-fetch";
import WebSocket from "ws";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../../../hub/shared/src/serviceConfig.ts";

export type CooldownMap = Record<string, number>;

export type CrateRewardConfig = {
  min_coins?: number;
  max_coins?: number;
  xp_chance?: number;
  xp_amount?: number;
  discount_chance?: number;
  discount_amount?: number;
  cooldown_reducer_chance?: number;
  cooldown_reducer_amount?: number;
};

export type CrateTypeConfig = {
  cooldown: number;
  emoji?: string;
  rewards?: CrateRewardConfig;
};

export type UpgradeConfig = {
  emoji?: string;
  basePrice: number;
  priceMultiplier: number;
  effectMultiplier?: number;
  effectValue?: number;
  category?: string;
};

export type LevelCalculation = {
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
};

export type LevelUpCheck = {
  oldLevel: number;
  newLevel: number;
  levelUp: boolean;
};

export type TranslationVariables = Record<string, unknown>;
export type LocalizationTree = Record<string, unknown>;
export type CacheEntry = { expiresAt: number; value: unknown };

export type AiHubModel = {
  id: string;
  name?: string;
  provider?: string;
  capabilities?: {
    vision?: boolean;
    tools?: boolean;
    maxContext?: number;
    reasoning?: boolean;
    [key: string]: unknown;
  };
  context_window?: number;
  context_length?: number;
  pricing?: Record<string, unknown>;
  isFeatured?: boolean;
  [key: string]: unknown;
};

export type HubClientLike = {
  databaseUrl?: string;
  renderingUrl?: string;
  localizationUrl?: string;
  aiUrl?: string;
  aiWsUrl?: string;
  _translationCache?: Map<string, CacheEntry>;
  _translationInFlight?: Map<string, Promise<unknown>>;
  _translationTTL?: number;
  _translationGroupCache?: Map<string, CacheEntry>;
  _translationGroupInFlight?: Map<string, Promise<unknown>>;
  _translationGroupTTL?: number;
  _activeWebSockets?: Map<string, unknown>;
  _wsConnectionPool?: Map<string, unknown>;
  getUser: (guildId: string, userId: string) => Promise<any>;
  createUser: (userData: unknown) => Promise<any>;
  updateUser: (guildId: string, userId: string, updateData: unknown) => Promise<any>;
  deleteUser: (guildId: string, userId: string) => Promise<any>;
  getUserProfile: (guildId: string, userId: string) => Promise<any>;
  updateUserProfile: (guildId: string, userId: string, profileData: unknown) => Promise<any>;
  setUserPersonalization: (guildId: string, userId: string, personalizationData: unknown) => Promise<any>;
  ensureUser: (guildId: string, userId: string) => Promise<any>;
  addBalance: (guildId: string, userId: string, amount: number) => Promise<any>;
  getBalance: (guildId: string, userId: string) => Promise<any>;
  getTotalBankBalance: (guildId: string, userId: string) => Promise<any>;
  transferBalance: (guildId: string, fromUserId: string, toUserId: string, amount: number) => Promise<any>;
  updateBankBalance: (guildId: string, userId: string) => Promise<any>;
  calculateInterest: (guildId: string, userId: string) => Promise<any>;
  revertUpgrade: (guildId: string, userId: string, upgradeType: string) => Promise<any>;
  getUpgradeInfo: (upgradeType: string, level: number) => Promise<any>;
  setCooldown: (guildId: string, userId: string, type: string, duration: number) => Promise<any>;
  getCooldown: (guildId: string, userId: string, type: string) => Promise<any>;
  getCrateCooldown: (guildId: string, userId: string, type: string) => Promise<any>;
  deleteCooldown: (guildId: string, userId: string, type: string) => Promise<any>;
  getAllCooldowns: (guildId: string, userId: string) => Promise<any>;
  addXP: (guildId: string, userId: string, amount: number) => Promise<any>;
  getUserLevel: (guildId: string, userId: string, type?: string) => Promise<any>;
  getAllUserLevels: (guildId: string, userId: string) => Promise<any>;
  calculateLevelFromXP: (xp: number) => Promise<any>;
  checkLevelUpFromXP: (guildId: string, userId: string, oldXp: number, newXp: number) => Promise<any>;
  addGameXP: (guildId: string, userId: string, gameType: string, amount: number) => Promise<any>;
  getGuild: (guildId: string) => Promise<any>;
  ensureGuild: (guildId: string, guildData?: Record<string, unknown>) => Promise<any>;
  updateGuild: (guildId: string, updateData: unknown) => Promise<any>;
  ensureGuildUser: (guildId: string, userId: string) => Promise<any>;
  updateGameHighScore: (guildId: string, userId: string, gameType: string, score: number) => Promise<any>;
  getGameRecords: (guildId: string, userId: string) => Promise<any>;
  createVoiceSession: (guildId: string, userId: string, channelId: string, joinTime?: number) => Promise<any>;
  getVoiceSession: (guildId: string, userId: string) => Promise<any>;
  removeVoiceSession: (guildId: string, userId: string) => Promise<any>;
  getAllGuildVoiceSessions: (guildId: string) => Promise<any>;
  calculateVoiceXP: (guildId: string, userId: string, sessionDuration: number) => Promise<any>;
  purchaseUpgrade: (guildId: string, userId: string, upgradeType: string) => Promise<any>;
  getUserUpgrades: (guildId: string, userId: string) => Promise<any>;
  getGuildLevelRoles: (guildId: string) => Promise<any>;
  getEligibleRolesForLevel: (guildId: string, level: number) => Promise<any>;
  getNextLevelRole: (guildId: string, currentLevel: number) => Promise<any>;
  addLevelRole: (guildId: string, level: number, roleId: string) => Promise<any>;
  removeLevelRole: (guildId: string, level: number) => Promise<any>;
  updateStats: (guildId: string, userId: string, statType: string, increment?: number) => Promise<any>;
  getStatistics: (guildId: string, userId: string) => Promise<any>;
  getInteractionStats: (guildId: string, userId: string) => Promise<any>;
  getMostUsedInteractions: (guildId: string, userId: string, limit?: number) => Promise<any>;
  deposit: (guildId: string, userId: string, amount: number) => Promise<any>;
  withdraw: (guildId: string, userId: string, amount: number) => Promise<any>;
  calculateLevel: (xp: number | bigint) => LevelCalculation;
  checkLevelUp: (oldXp: number | bigint, newXp: number | bigint) => LevelUpCheck | null;
  savePlayer: (player: unknown) => Promise<any>;
  loadPlayers: () => Promise<any>;
  deletePlayer: (guildId: string) => Promise<any>;
  getPlayer: (guildId: string) => Promise<any>;
  updatePlayer: (guildId: string, data: unknown) => Promise<any>;
  getUserCrates: (guildId: string, userId: string) => Promise<any>;
  openCrate: (guildId: string, userId: string, crateType: string) => Promise<any>;
  getGuildUsers: (guildId: string) => Promise<any[]>;
  getCurrentSeason: () => Promise<any>;
  getSeasonLeaderboard: (limit?: number) => Promise<any[]>;
  getUserLocale: (guildId: string, userId: string) => Promise<any>;
  setUserLocale: (guildId: string, userId: string, locale: string) => Promise<any>;
  executeTransaction: (operations: unknown[]) => Promise<any>;
  invalidateCache: (keys: string[]) => Promise<any>;
  getFromCache: (key: string) => Promise<any>;
  setCache: (key: string, value: unknown, ttl?: number | null) => Promise<any>;
  getTranslation: (
    key: string,
    variables?: TranslationVariables | string,
    locale?: string
  ) => Promise<any>;
  registerLocalizations: (
    category: string,
    name: string,
    localizations: LocalizationTree,
    save?: boolean
  ) => Promise<any>;
  addTranslation: (locale: string, key: string, value: unknown, save?: boolean) => Promise<any>;
  getTranslationGroup: (groupKey: string, locale?: string) => Promise<any>;
  saveAllTranslations: () => Promise<any>;
  setHubLocale: (locale: string) => Promise<any>;
  getHubLocale: () => Promise<any>;
  getSupportedLocales: () => Promise<any>;
  getAIHubModels: (
    capability?: string | null,
    refresh?: boolean,
    userId?: string | null,
    search?: string | null,
    sortBy?: string | null,
    sortOrder?: string | null
  ) => Promise<AiHubModel[]>;
  generateImage: (
    component: string,
    props?: Record<string, unknown>,
    scaling?: Record<string, unknown>,
    locale?: string,
    options?: Record<string, unknown>
  ) => Promise<any>;
  processImageColors: (imageUrl: string) => Promise<any>;
  [key: string]: unknown;
};

dotenv.config();

// Hub service URLs
const DATABASE_SERVICE_URL =
  process.env.DATABASE_SERVICE_URL || DEFAULT_SERVICE_URLS.database;
const RENDERING_SERVICE_URL =
  process.env.RENDERING_SERVICE_URL || DEFAULT_SERVICE_URLS.rendering;
const LOCALIZATION_SERVICE_URL =
  process.env.LOCALIZATION_SERVICE_URL || DEFAULT_SERVICE_URLS.localization;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || DEFAULT_SERVICE_URLS.ai;
const AI_SERVICE_WS_URL =
  process.env.AI_SERVICE_WS_URL ||
  (process.env.AI_SERVICE_URL
    ? `${process.env.AI_SERVICE_URL.replace(/^http/, "ws").replace(/\/$/, "")}/ws`
    : `ws://localhost:${DEFAULT_SERVICE_PORTS.ai}/ws`);
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
function parseNumericStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(parseNumericStrings);
  }

  if (typeof obj === "object") {
    const parsed: Record<string, any> = {};
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
async function apiRequest(url: any, options: any = {}): Promise<any> {
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
  } catch (error: any) {
    console.error(`API request error for ${url}:`, error);
    throw error;
  }
}

// Hub API Client Class
class HubClient {
  [key: string]: any;
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
  async getUser(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`);
  }

  async createUser(userData: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(guildId: any, userId: any, updateData: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
    });
  }

  async deleteUser(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/users/${guildId}/${userId}`, {
      method: "DELETE",
    });
  }

  // Personalization API methods
  async getUserProfile(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`
    );
  }

  async updateUserProfile(guildId: any, userId: any, profileData: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`,
      {
        method: "PATCH",
        body: JSON.stringify(profileData),
      }
    );
  }

  async setUserPersonalization(guildId: any, userId: any, personalizationData: any): Promise<any> {
    return await this.updateUserProfile(guildId, userId, personalizationData);
  }

  async ensureUser(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/users/ensure`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async addBalance(guildId: any, userId: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/balance/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async getBalance(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/economy/balance/${guildId}/${userId}`
    );
  }

  async getTotalBankBalance(guildId: any, userId: any): Promise<any> {
    const balanceData = await this.getBalance(guildId, userId);
    if (!balanceData) {
      return new (Prisma as any).Decimal(0);
    }
    return balanceData.totalBankBalance || new (Prisma as any).Decimal(0);
  }

  async transferBalance(guildId: any, fromUserId: any, toUserId: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/transfer`, {
      method: "POST",
      body: JSON.stringify({ fromUserId, toUserId, guildId, amount }),
    });
  }

  async updateBankBalance(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/bank/update`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async calculateInterest(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/bank/interest`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async revertUpgrade(guildId: any, userId: any, upgradeType: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/upgrades/revert`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUpgradeInfo(upgradeType: any, level: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/economy/upgrades/info/${upgradeType}/${level}`
    );
  }

  async setCooldown(guildId: any, userId: any, type: any, duration: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/cooldowns/`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, type, duration }),
    });
  }

  async getCooldown(guildId: any, userId: any, type: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`
    );
  }

  async getCrateCooldown(guildId: any, userId: any, type: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/crate/${guildId}/${userId}/${type}`
    );
  }

  async deleteCooldown(guildId: any, userId: any, type: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllCooldowns(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}`
    );
  }

  async addXP(guildId: any, userId: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/xp/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async getUserLevel(guildId: any, userId: any, type: any = "activity"): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/xp/level/${guildId}/${userId}?type=${type}`
    );
  }

  async getAllUserLevels(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/xp/levels/${guildId}/${userId}`
    );
  }

  async calculateLevelFromXP(xp: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/xp/calculate`, {
      method: "POST",
      body: JSON.stringify({ xp }),
    });
  }

  async checkLevelUpFromXP(guildId: any, userId: any, oldXp: any, newXp: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/xp/check-levelup`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, oldXp, newXp }),
    });
  }

  async addGameXP(guildId: any, userId: any, gameType: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/games/xp/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, gameType, xp: amount }),
    });
  }

  // Guild management methods
  async getGuild(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}`);
  }

  async ensureGuild(guildId: any, guildData: any = {}): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/guilds/ensure`, {
      method: "POST",
      body: JSON.stringify({ guildId, ...guildData }),
    });
  }

  async updateGuild(guildId: any, updateData: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  }

  async ensureGuildUser(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/guilds/${guildId}/users/ensure`,
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      }
    );
  }

  async updateGameHighScore(guildId: any, userId: any, gameType: any, score: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/games/records/update`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, gameId: gameType, score }),
    });
  }

  async getGameRecords(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/games/records/${guildId}/${userId}`
    );
  }

  // Voice session management methods
  async createVoiceSession(
    guildId: any,
    userId: any,
    channelId: any,
    joinTime: any = Date.now()
  ): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/voice/sessions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, channelId, joinTime }),
    });
  }

  async getVoiceSession(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`
    );
  }

  async removeVoiceSession(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllGuildVoiceSessions(guildId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/voice/sessions/guild/${guildId}`
    );
  }

  async calculateVoiceXP(guildId: any, userId: any, sessionDuration: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/voice/xp/calculate`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, sessionDuration }),
    });
  }

  async purchaseUpgrade(guildId: any, userId: any, upgradeType: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/upgrades/purchase`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUserUpgrades(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/economy/upgrades/${guildId}/${userId}`
    );
  }

  // Level role management methods
  async getGuildLevelRoles(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/levels/roles/${guildId}`);
  }

  async getEligibleRolesForLevel(guildId: any, level: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/level/${level}`
    );
  }

  async getNextLevelRole(guildId: any, currentLevel: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/next/${currentLevel}`
    );
  }

  async addLevelRole(guildId: any, level: any, roleId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/levels/roles`, {
      method: "POST",
      body: JSON.stringify({ guildId, level, roleId }),
    });
  }

  async removeLevelRole(guildId: any, level: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/levels/roles/${guildId}/${level}`,
      {
        method: "DELETE",
      }
    );
  }

  async updateStats(guildId: any, userId: any, statType: any, increment: any = 1): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/stats/${userId}/${guildId}`, {
      method: "PATCH",
      body: JSON.stringify({ statType, increment }),
    });
  }

  async getStatistics(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/stats/${guildId}/${userId}`);
  }

  async getInteractionStats(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}`
    );
  }

  async getMostUsedInteractions(guildId: any, userId: any, limit: any = 10): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}/top?limit=${limit}`
    );
  }

  // Crypto trading methods
  async createCryptoPosition(guildId: any, userId: any, symbol: any, amount: any, price: any, type: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/crypto/positions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, symbol, amount, price, type }),
    });
  }

  async getUserCryptoPositions(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${guildId}/${userId}`
    );
  }

  async getCryptoPositionById(positionId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/id/${positionId}`
    );
  }

  async updateCryptoPosition(positionId: any, updateData: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "PUT",
        body: JSON.stringify(updateData),
      }
    );
  }

  async deleteCryptoPosition(positionId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllActiveCryptoPositions(): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/crypto/positions/active/all`);
  }

  // Crypto Wallet API methods
  async getUserCryptoWallets(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}`
    );
  }

  async getCryptoWallet(guildId: any, userId: any, currency: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositAddress(guildId: any, userId: any, currency: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/deposit-address/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositHistory(guildId: any, userId: any, currency: any = null, limit: any = 50, offset: any = 0): Promise<any> {
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

  async getCryptoWithdrawalHistory(guildId: any, userId: any, currency: any = null, limit: any = 50, offset: any = 0): Promise<any> {
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

  async requestCryptoWithdrawal(guildId: any, userId: any, currency: any, amount: any, toAddress: any, memo: any = null): Promise<any> {
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

  async getCryptoPortfolioValue(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/portfolio/${guildId}/${userId}`
    );
  }

  async startCryptoDepositListening(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "POST",
      }
    );
  }

  async stopCryptoDepositListening(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAvailableChains(currency: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/crypto-wallet/chains/${currency}`
    );
  }

  // Guild Vault API methods
  async getGuildVault(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/guild-vault/vault/${guildId}`);
  }

  async getGuildVaultDistributions(guildId: any, limit: any = 10): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distributions?limit=${limit}`
    );
  }

  async getUserVaultDistributions(guildId: any, userId: any, limit: any = 10): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/user/${userId}/distributions?limit=${limit}`
    );
  }

  async triggerManualDistribution(guildId: any, userId: any, amount: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distribute`,
      {
        method: "POST",
        body: JSON.stringify({ userId, amount }),
      }
    );
  }

  // Marriage API methods
  async getMarriageStatus(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/marriage/status/${userId}?guildId=${guildId}`
    );
  }

  async proposeMarriage(guildId: any, userId1: any, userId2: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/marriage/propose`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async acceptMarriage(guildId: any, userId1: any, userId2: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/marriage/accept`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async rejectMarriage(guildId: any, userId1: any, userId2: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/marriage/reject`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async dissolveMarriage(guildId: any, userId1: any, userId2: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/marriage/dissolve`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  // Bank and Economy API methods
  async calculateBankBalance(user: any, tx: any = null): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/bank/calculate`, {
      method: "POST",
      body: JSON.stringify({ user, tx }),
    });
  }

  async deposit(guildId: any, userId: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/deposit`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async withdraw(guildId: any, userId: any, amount: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/economy/withdraw`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  // Level calculation methods
  calculateLevel(xp: any): any {
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

  checkLevelUp(oldXp: any, newXp: any): any {
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
  async savePlayer(player: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/music/players`, {
      method: "POST",
      body: JSON.stringify({ player }),
    });
  }

  async loadPlayers(): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/music/players`);
  }

  async deletePlayer(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "DELETE",
    });
  }

  async getPlayer(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`);
  }

  async updatePlayer(guildId: any, data: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Crate methods
  async getUserCrates(guildId: any, userId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/crates/${guildId}/${userId}`);
  }

  async openCrate(guildId: any, userId: any, crateType: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/crates/open`, {
      method: "POST",
      body: JSON.stringify({
        userId: userId,
        guildId: guildId,
        type: crateType,
      }),
    });
  }

  // Guild and Season methods
  async getGuildUsers(guildId: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/guilds/${guildId}/users`);
  }

  async getCurrentSeason(): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/seasons/current`);
  }

  async getSeasonLeaderboard(limit: any = 250): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/seasons/leaderboard?limit=${limit}`
    );
  }

  // User locale methods
  async getUserLocale(guildId: any, userId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`
    );
  }

  async setUserLocale(guildId: any, userId: any, locale: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`,
      {
        method: "PUT",
        body: JSON.stringify({ locale }),
      }
    );
  }

  // Transaction methods
  async executeTransaction(operations: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/transaction`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
  }

  // Cache management methods
  async invalidateCache(keys: any): Promise<any> {
    return await apiRequest(`${this.databaseUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ keys }),
    });
  }

  async getFromCache(key: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`
    );
  }

  async setCache(key: any, value: any, ttl: any = null): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value, ttl }),
      }
    );
  }

  // Legacy game data methods
  async getLegacyGameData(guildId: any, userId: any, gameId: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}?guildId=${guildId}`
    );
  }

  async setLegacyGameData(guildId: any, userId: any, gameId: any, data: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, data }),
      }
    );
  }

  async getLegacyValue(guildId: any, userId: any, gameId: any, key: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}?guildId=${guildId}`
    );
  }

  async setLegacyValue(guildId: any, userId: any, gameId: any, key: any, value: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, value }),
      }
    );
  }

  async incLegacyValue(guildId: any, userId: any, gameId: any, key: any, increment: any = 1): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/increment`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, increment }),
      }
    );
  }

  async decLegacyValue(guildId: any, userId: any, gameId: any, key: any, decrement: any = 1): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/decrement`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, decrement }),
      }
    );
  }

  async deleteLegacyValue(guildId: any, userId: any, gameId: any, key: any): Promise<any> {
    return await apiRequest(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "DELETE",
        body: JSON.stringify({ guildId }),
      }
    );
  }

  // Rendering API methods
  async generateImage(component: any, props: any = {}, scaling = { image: 1, emoji: 1 }, locale: any = "en", options: any = {}): Promise<any> {
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

  async processImageColors(imageUrl: any): Promise<any> {
    return await apiRequest(`${this.renderingUrl}/colors`, {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
    });
  }

  async getAvailableComponents(): Promise<any> {
    return await apiRequest(`${this.renderingUrl}/components`);
  }

  // Health check methods
  async checkDatabaseHealth(): Promise<any> {
    try {
      return await apiRequest(`${this.databaseUrl}/health`);
    } catch (error: any) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkRenderingHealth(): Promise<any> {
    try {
      return await apiRequest(`${this.renderingUrl}/health`);
    } catch (error: any) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async checkHealth(): Promise<any> {
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
  async getTranslation(key: any, variables: any = {}, locale: any): Promise<any> {
    // Build a stable cache key
    const stableStringify = (obj: any): string => {
      if (!obj || typeof obj !== "object") return String(obj ?? "");
      const keys = Object.keys(obj).sort();
      const parts: string[] = keys.map((k: any): string => {
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
      .then((data: any) => {
        // Cache the result with TTL
        this._translationCache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + this._translationTTL,
        });
        this._translationInFlight.delete(cacheKey);
        return data;
      })
      .catch((err: any) => {
        // Ensure we clear in-flight on error
        this._translationInFlight.delete(cacheKey);
        throw err;
      });

    this._translationInFlight.set(cacheKey, p);
    return await p;
  }

  async registerLocalizations(category: any, name: any, localizations: any, save: any = false): Promise<any> {
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

  async addTranslation(locale: any, key: any, value: any, save: any = false): Promise<any> {
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

  async getTranslationGroup(groupKey: any, locale: any): Promise<any> {
    const effectiveLocale = locale || "en";
    const cacheKey = `${effectiveLocale}::group::${groupKey || ""}`;

    // Return cached group if valid
    const cached = this._translationGroupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const data = cached.value;
      // Prime cache from cached group as well
      try {
        this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
      } catch (e: any) {
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
      } catch (e: any) {
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
      .then((data: any) => {
        // Cache the group response
        this._translationGroupCache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + this._translationGroupTTL,
        });
        this._translationGroupInFlight.delete(cacheKey);
        return data;
      })
      .catch((err: any) => {
        this._translationGroupInFlight.delete(cacheKey);
        throw err;
      });

    this._translationGroupInFlight.set(cacheKey, p);
    const data = await p;

    // Prime the per-key translation cache with returned group entries
    try {
      this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
    } catch (e: any) {
      // Don't fail group fetch if priming fails; just return data
      console.warn(
        "[hubClient] Failed to prime translation cache from group:",
        e
      );
    }

    return data;
  }

  // Internal helper: prime per-key cache from group response
  _primeCacheFromGroupData(data: any, effectiveLocale: any, groupKey: any = null): any {
    // Helper to flatten nested objects into dot-notated keys
    const flatten = (obj: any, prefix = ""): Array<[string, string]> => {
      const entries: Array<[string, string]> = [];
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

  async saveAllTranslations(): Promise<any> {
    // Persisted changes — clear caches to avoid stale entries
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    return await apiRequest(`${this.localizationUrl}/i18n/save-all`, {
      method: "POST",
    });
  }

  async setHubLocale(locale: any): Promise<any> {
    return await apiRequest(`${this.localizationUrl}/i18n/set-locale`, {
      method: "POST",
      body: JSON.stringify({ locale }),
    });
  }

  async getHubLocale(): Promise<any> {
    return await apiRequest(`${this.localizationUrl}/i18n/locale`);
  }

  async getSupportedLocales(): Promise<any> {
    return await apiRequest(`${this.localizationUrl}/i18n/locales`);
  }

  // AI Service API methods
  async getAvailableModels(capability: any = null): Promise<any> {
    const params = new URLSearchParams();
    if (capability) params.append("capability", capability);

    return await apiRequest(
      `${this.aiUrl}/models${params.toString() ? `?${params.toString()}` : ""}`
    );
  }

  async getModelDetails(modelId: any): Promise<any> {
    return await apiRequest(
      `${this.aiUrl}/models/${encodeURIComponent(modelId)}`
    );
  }

  async processAIRequest(requestData: any): Promise<any> {
    return await apiRequest(`${this.aiUrl}/process`, {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  async checkAIHealth(): Promise<any> {
    try {
      return await apiRequest(`${this.aiUrl}/health`);
    } catch (error: any) {
      return { status: "unhealthy", error: error.message };
    }
  }

  async getAIMetrics(): Promise<any> {
    return await apiRequest(`${this.aiUrl}/metrics`);
  }

  async invalidateAIModelCache(): Promise<any> {
    return await apiRequest(`${this.aiUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ type: "models" }),
    });
  }

  // New AI Hub integration methods for seamless bot integration
  async getAIHubModels(
    capability: any = null,
    refresh: any = false,
    userId: any = null,
    provider: any = null,
    sortBy: any = "featured",
    sortOrder: any = "desc"
  ): Promise<any> {
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
    } catch (error: any) {
      console.error("Error fetching AI hub models:", error);
      throw error;
    }
  }

  async processAIHubRequest(requestData: any): Promise<any> {
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
    } catch (error: any) {
      console.error("Error processing AI hub request:", error);
      throw error;
    }
  }

  async processAIHubStream(requestData: any, onChunk: any, onError: any, onComplete: any): Promise<any> {
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
      } catch (e: any) {
        console.error("[processAIHubStream] Error closing old connection:", e);
      }
      this._activeWebSockets.delete(requestId);
    }

    return new Promise((resolve: any, reject: any) => {
      let ws: any = null;
      let isResolved = false;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 2; // Reduced to prevent excessive reconnections
      const reconnectDelay = 1500; // Increased delay

      const safeCall = (fn: any, ...args: any[]) => {
        try {
          if (typeof fn === "function") fn(...args);
        } catch (e: any) {
          console.error("Stream callback error:", e);
        }
      };

      const cleanup = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, "Normal closure");
          } catch (e: any) {
            console.error("Error closing WebSocket:", e);
          }
        }
        this._activeWebSockets.delete(requestId);
        ws = null;
      };

      const resolveOnce = (data: any) => {
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

      const rejectOnce = (error: any) => {
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
            } catch (sendError: any) {
              console.error(
                "[processAIHubStream] Error sending message:",
                sendError
              );
              safeCall(onError, sendError);
            }
          });

          ws.on("message", (raw: any) => {
            let message;
            try {
              message = JSON.parse(raw.toString());
            } catch (e: any) {
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

          ws.on("error", (error: any) => {
            console.error("[processAIHubStream] WebSocket error:", error);
            safeCall(onError, error);
            handleConnectionError(error);
          });

          ws.on("close", (code: any, reason: any) => {
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
        } catch (connectionError: any) {
          console.error(
            "[processAIHubStream] Connection failed:",
            connectionError
          );
          handleConnectionError(connectionError);
        }
      };

      const handleConnectionError = (error: any) => {
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
      let connectionTimeout: any;

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

  async stopAIHubStream(requestId: any): Promise<any> {
    // Implementation for stopping streams if needed
    console.log(`[stopAIHubStream] Stopping stream for request ${requestId}`);
    const ws = this._activeWebSockets.get(requestId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(1000, "Client requested stop");
        console.log(
          `[stopAIHubStream] Successfully stopped stream for request ${requestId}`
        );
      } catch (e: any) {
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
  async processAIStream(requestData: any, onChunk: any, onError: any, onComplete: any): Promise<any> {
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
  async transcribeAudio(params: any): Promise<any> {
    try {
      const { audioData, filename, language = "auto", userId } = params;
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
    } catch (error: any) {
      console.error("Error transcribing audio through hub:", error);
      throw new Error(`Audio transcription failed: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const hubClient = new HubClient() as HubClientLike;
export { hubClient };
export default hubClient;
