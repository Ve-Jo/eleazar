import fetch from "node-fetch";
import type { RequestInit as NodeFetchRequestInit } from "node-fetch";
import WebSocket from "ws";
import dotenv from "dotenv";
import {
  DEFAULT_SERVICE_PORTS,
  DEFAULT_SERVICE_URLS,
} from "../../../hub/shared/src/serviceConfig.ts";
import type {
  AddBalanceRequest,
  AddGameXpRequest,
  AddGameXpResponse,
  AddXpResponse,
  AllCooldownsResponse,
  AiHubModel,
  AiHealthResponse,
  AiMetricsResponse,
  AiModelsListResponse,
  AiProcessRequest,
  AiProcessSuccessEnvelope,
  AiStreamChunk,
  AiStreamCompletion,
  AiStreamMessage,
  AiTranscriptionRequest,
  AiTranscriptionResponse,
  BalanceResponse,
  CacheInvalidateResponse,
  CacheSetResponse,
  CacheEntry,
  CalculateVoiceXpRequest,
  CalculateVoiceXpResponse,
  CooldownResponse,
  CooldownRecordResponse,
  DeleteManyResponse,
  EnsureGuildUserRequest,
  EnsureUserRequest,
  GameRecordsResponse,
  GuildRecord,
  HubLocaleResponse,
  HubCompositeHealth,
  HubSuccessResponse,
  HubUserRecord,
  ImageColorProcessingResponse,
  InteractionStatsResponse,
  LevelCalculation,
  LevelRole,
  LevelRoleEnvelope,
  LevelUpCheck,
  LocalizationTree,
  MostUsedInteraction,
  NextLevelRoleEnvelope,
  RegisterLocalizationsRequest,
  RenderingComponentsResponse,
  RenderingGenerateImageResponse,
  SeasonLeaderboardResponse,
  SeasonSummaryResponse,
  SetUserLocaleRequest,
  StatisticsRecordResponse,
  SupportedLocalesResponse,
  TransactionExecuteResponse,
  TranslationGroupResponse,
  TranslationResponse,
  TranslationVariables,
  UpgradeInfoResponse,
  UpgradeRecord,
  UpdateGameRecordRequest,
  UpdateGameRecordResponse,
  UserLevelsResponse,
  UserUpgradesResponse,
  UpdateUserProfileRequest,
  UserLocaleResponse,
  UserProfile,
  VoiceSessionRecord,
  GenericRecordResponse,
} from "../../../hub/shared/src/contracts/hub.ts";

export type CooldownMap = Record<string, number>;
export {
  COOLDOWNS,
  CRATE_TYPES,
  DEFAULT_VALUES,
  UPGRADES,
} from "../../../hub/shared/src/domain.ts";
export type {
  AiHubModel,
  CacheEntry,
  LevelCalculation,
  LevelUpCheck,
  LocalizationTree,
  TranslationVariables,
};

export type HubClientLike = {
  databaseUrl?: string;
  renderingUrl?: string;
  localizationUrl?: string;
  aiUrl?: string;
  aiWsUrl?: string;
  _translationCache?: Map<string, CacheEntry<TranslationResponse>>;
  _translationInFlight?: Map<string, Promise<TranslationResponse>>;
  _translationTTL?: number;
  _translationGroupCache?: Map<string, CacheEntry>;
  _translationGroupInFlight?: Map<string, Promise<unknown>>;
  _translationGroupTTL?: number;
  _activeWebSockets?: Map<string, unknown>;
  _wsConnectionPool?: Map<string, unknown>;
  getUser: (guildId: string, userId: string) => Promise<HubUserRecord | null>;
  createUser: (userData: unknown) => Promise<HubUserRecord>;
  updateUser: (guildId: string, userId: string, updateData: unknown) => Promise<HubUserRecord>;
  deleteUser: (guildId: string, userId: string) => Promise<HubSuccessResponse>;
  getUserProfile: (guildId: string, userId: string) => Promise<UserProfile>;
  updateUserProfile: (
    guildId: string,
    userId: string,
    profileData: UpdateUserProfileRequest
  ) => Promise<UserProfile>;
  setUserPersonalization: (
    guildId: string,
    userId: string,
    personalizationData: UpdateUserProfileRequest
  ) => Promise<UserProfile>;
  ensureUser: (guildId: string, userId: string) => Promise<HubUserRecord>;
  addBalance: (guildId: string, userId: string, amount: number) => Promise<HubUserRecord>;
  getBalance: (guildId: string, userId: string) => Promise<BalanceResponse>;
  getTotalBankBalance: (guildId: string, userId: string) => Promise<number>;
  transferBalance: (
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ) => Promise<HubSuccessResponse>;
  updateBankBalance: (guildId: string, userId: string) => Promise<BalanceResponse>;
  calculateInterest: (guildId: string, userId: string) => Promise<BalanceResponse>;
  revertUpgrade: (guildId: string, userId: string, upgradeType: string) => Promise<UpgradeRecord>;
  getUpgradeInfo: (upgradeType: string, level: number) => Promise<UpgradeInfoResponse>;
  setCooldown: (
    guildId: string,
    userId: string,
    type: string,
    duration: number
  ) => Promise<CooldownRecordResponse>;
  getCooldown: (
    guildId: string,
    userId: string,
    type: string
  ) => Promise<number | CooldownResponse>;
  getCrateCooldown: (guildId: string, userId: string, type: string) => Promise<number | null>;
  deleteCooldown: (guildId: string, userId: string, type: string) => Promise<CooldownRecordResponse>;
  getAllCooldowns: (guildId: string, userId: string) => Promise<AllCooldownsResponse>;
  addXP: (guildId: string, userId: string, amount: number) => Promise<AddXpResponse>;
  getUserLevel: (guildId: string, userId: string, type?: string) => Promise<LevelCalculation>;
  getAllUserLevels: (guildId: string, userId: string) => Promise<UserLevelsResponse>;
  calculateLevelFromXP: (xp: number) => Promise<LevelCalculation>;
  checkLevelUpFromXP: (
    guildId: string,
    userId: string,
    oldXp: number,
    newXp: number
  ) => Promise<LevelUpCheck | null>;
  addGameXP: (
    guildId: string,
    userId: string,
    gameType: string,
    amount: number
  ) => Promise<AddGameXpResponse>;
  getGuild: (guildId: string) => Promise<GuildRecord>;
  ensureGuild: (guildId: string, guildData?: Record<string, unknown>) => Promise<GuildRecord>;
  updateGuild: (guildId: string, updateData: unknown) => Promise<GuildRecord>;
  ensureGuildUser: (guildId: string, userId: string) => Promise<HubUserRecord>;
  updateGameHighScore: (
    guildId: string,
    userId: string,
    gameType: string,
    score: number
  ) => Promise<UpdateGameRecordResponse>;
  getGameRecords: (guildId: string, userId: string) => Promise<GameRecordsResponse>;
  createVoiceSession: (
    guildId: string,
    userId: string,
    channelId: string,
    joinTime?: number
  ) => Promise<VoiceSessionRecord>;
  getVoiceSession: (guildId: string, userId: string) => Promise<VoiceSessionRecord>;
  removeVoiceSession: (guildId: string, userId: string) => Promise<VoiceSessionRecord>;
  getAllGuildVoiceSessions: (guildId: string) => Promise<VoiceSessionRecord[]>;
  calculateVoiceXP: (
    guildId: string,
    userId: string,
    sessionDuration: number
  ) => Promise<CalculateVoiceXpResponse>;
  purchaseUpgrade: (guildId: string, userId: string, upgradeType: string) => Promise<UpgradeRecord>;
  getUserUpgrades: (guildId: string, userId: string) => Promise<UserUpgradesResponse>;
  getGuildLevelRoles: (guildId: string) => Promise<LevelRole[]>;
  getEligibleRolesForLevel: (guildId: string, level: number) => Promise<LevelRoleEnvelope>;
  getNextLevelRole: (guildId: string, currentLevel: number) => Promise<NextLevelRoleEnvelope>;
  addLevelRole: (guildId: string, level: number, roleId: string) => Promise<LevelRole>;
  removeLevelRole: (guildId: string, level: number) => Promise<DeleteManyResponse>;
  updateStats: (
    guildId: string,
    userId: string,
    statType: string,
    increment?: number
  ) => Promise<StatisticsRecordResponse>;
  getStatistics: (guildId: string, userId: string) => Promise<StatisticsRecordResponse | null>;
  getInteractionStats: (guildId: string, userId: string) => Promise<InteractionStatsResponse>;
  getMostUsedInteractions: (
    guildId: string,
    userId: string,
    limit?: number
  ) => Promise<MostUsedInteraction[]>;
  deposit: (guildId: string, userId: string, amount: number) => Promise<BalanceResponse>;
  withdraw: (guildId: string, userId: string, amount: number) => Promise<BalanceResponse>;
  calculateLevel: (xp: number | bigint) => LevelCalculation;
  checkLevelUp: (oldXp: number | bigint, newXp: number | bigint) => LevelUpCheck | null;
  savePlayer: (player: unknown) => Promise<GenericRecordResponse>;
  loadPlayers: () => Promise<GenericRecordResponse>;
  deletePlayer: (guildId: string) => Promise<GenericRecordResponse>;
  getPlayer: (guildId: string) => Promise<GenericRecordResponse>;
  updatePlayer: (guildId: string, data: unknown) => Promise<GenericRecordResponse>;
  getUserCrates: (guildId: string, userId: string) => Promise<GenericRecordResponse>;
  openCrate: (guildId: string, userId: string, crateType: string) => Promise<GenericRecordResponse>;
  getGuildUsers: (guildId: string) => Promise<HubUserRecord[]>;
  getCurrentSeason: () => Promise<SeasonSummaryResponse>;
  getSeasonLeaderboard: (limit?: number) => Promise<SeasonLeaderboardResponse>;
  getUserLocale: (guildId: string, userId: string) => Promise<string | null>;
  setUserLocale: (
    guildId: string,
    userId: string,
    locale: string
  ) => Promise<HubSuccessResponse>;
  executeTransaction: (operations: unknown[]) => Promise<TransactionExecuteResponse>;
  invalidateCache: (keys: string[]) => Promise<CacheInvalidateResponse>;
  getFromCache: (key: string) => Promise<GenericRecordResponse | null>;
  setCache: (key: string, value: unknown, ttl?: number | null) => Promise<CacheSetResponse>;
  getTranslation: (
    key: string,
    variables?: TranslationVariables | string,
    locale?: string
  ) => Promise<TranslationResponse>;
  registerLocalizations: (
    category: string,
    name: string,
    localizations: LocalizationTree,
    save?: boolean
  ) => Promise<HubSuccessResponse>;
  addTranslation: (
    locale: string,
    key: string,
    value: unknown,
    save?: boolean
  ) => Promise<HubSuccessResponse>;
  getTranslationGroup: (
    groupKey: string,
    locale?: string
  ) => Promise<Record<string, unknown>>;
  saveAllTranslations: () => Promise<HubSuccessResponse>;
  setHubLocale: (locale: string) => Promise<HubLocaleResponse>;
  getHubLocale: () => Promise<HubLocaleResponse>;
  getSupportedLocales: () => Promise<SupportedLocalesResponse>;
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
  ) => Promise<RenderingGenerateImageResponse | Buffer | [Buffer, unknown]>;
  processImageColors: (imageUrl: string) => Promise<ImageColorProcessingResponse>;
  processAIHubRequest: (requestData: AiProcessRequest) => Promise<GenericRecordResponse>;
  processAIHubStream: (
    requestData: AiProcessRequest,
    onChunk: (chunk: AiStreamChunk) => void | Promise<void>,
    onError: (error: Error) => void | Promise<void>,
    onComplete: (completion: AiStreamCompletion) => void | Promise<void>
  ) => Promise<AiStreamCompletion>;
  stopAIHubStream: (requestId: string) => Promise<boolean>;
  processAIStream: (
    requestData: AiProcessRequest,
    onChunk: (chunk: AiStreamChunk) => void | Promise<void>,
    onError: (error: Error) => void | Promise<void>,
    onComplete: (completion: AiStreamCompletion) => void | Promise<void>
  ) => Promise<AiStreamCompletion>;
  transcribeAudio: (params: AiTranscriptionRequest) => Promise<AiTranscriptionResponse>;
  checkHealth: () => Promise<HubCompositeHealth>;
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

// Helper function to parse numeric strings to numbers recursively
function parseNumericStrings<TValue>(obj: TValue): TValue {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((value) => parseNumericStrings(value)) as TValue;
  }

  if (typeof obj === "object") {
    const parsed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      parsed[key] = parseNumericStrings(value);
    }
    return parsed as TValue;
  }

  if (typeof obj === "string") {
    // Check if string represents a decimal number
    const numericValue = parseFloat(obj);
    if (
      !isNaN(numericValue) &&
      isFinite(numericValue) &&
      obj.trim() === numericValue.toString()
    ) {
      return numericValue as TValue;
    }
  }

  return obj;
}

type ApiRequestOptions<TBody extends NodeFetchRequestInit["body"] = NodeFetchRequestInit["body"]> = {
  method?: string;
  headers?: Record<string, string>;
  body?: TBody;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function normalizeTranslationResponse(
  value: TranslationResponse | string | null
): TranslationResponse {
  if (value && typeof value === "object" && "translation" in value) {
    const translationValue = value.translation;
    return {
      translation:
        typeof translationValue === "string"
          ? translationValue
          : String(translationValue ?? ""),
    };
  }
  return { translation: typeof value === "string" ? value : "" };
}

// Helper function for API requests
async function apiRequest<
  TResponse,
  TBody extends NodeFetchRequestInit["body"] = NodeFetchRequestInit["body"]
>(
  url: string,
  options: ApiRequestOptions<TBody> = {}
): Promise<TResponse> {
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

    const data = (await response.json()) as TResponse;
    return parseNumericStrings(data);
  } catch (error: unknown) {
    console.error(`API request error for ${url}:`, error);
    throw error;
  }
}

// Hub API Client Class
class HubClient {
  [key: string]: unknown;
  databaseUrl: string;
  renderingUrl: string;
  localizationUrl: string;
  aiUrl: string;
  aiWsUrl: string;
  _translationCache: Map<string, CacheEntry<TranslationResponse>>;
  _translationInFlight: Map<string, Promise<TranslationResponse>>;
  _translationTTL: number;
  _translationGroupCache: Map<string, CacheEntry<Record<string, unknown>>>;
  _translationGroupInFlight: Map<string, Promise<Record<string, unknown>>>;
  _translationGroupTTL: number;
  _activeWebSockets: Map<string, WebSocket>;
  _wsConnectionPool: Map<string, WebSocket>;

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
  async getUser(guildId: string, userId: string): Promise<HubUserRecord | null> {
    return await apiRequest<HubUserRecord>(
      `${this.databaseUrl}/users/${guildId}/${userId}`
    );
  }

  async createUser(userData: unknown): Promise<HubUserRecord> {
    return await apiRequest<HubUserRecord, string>(`${this.databaseUrl}/users`, {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async updateUser(
    guildId: string,
    userId: string,
    updateData: unknown
  ): Promise<HubUserRecord> {
    return await apiRequest<HubUserRecord, string>(
      `${this.databaseUrl}/users/${guildId}/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updateData),
      }
    );
  }

  async deleteUser(guildId: string, userId: string): Promise<HubSuccessResponse> {
    return await apiRequest<HubSuccessResponse>(`${this.databaseUrl}/users/${guildId}/${userId}`, {
      method: "DELETE",
    });
  }

  // Personalization API methods
  async getUserProfile(guildId: string, userId: string): Promise<UserProfile> {
    return await apiRequest<UserProfile>(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`
    );
  }

  async updateUserProfile(
    guildId: string,
    userId: string,
    profileData: UpdateUserProfileRequest
  ): Promise<UserProfile> {
    return await apiRequest<UserProfile, string>(
      `${this.databaseUrl}/users/${guildId}/${userId}/profile`,
      {
        method: "PATCH",
        body: JSON.stringify(profileData),
      }
    );
  }

  async setUserPersonalization(
    guildId: string,
    userId: string,
    personalizationData: UpdateUserProfileRequest
  ): Promise<UserProfile> {
    return await this.updateUserProfile(guildId, userId, personalizationData);
  }

  async ensureUser(guildId: string, userId: string): Promise<HubUserRecord> {
    const body: EnsureUserRequest = { userId, guildId };
    return await apiRequest<HubUserRecord, string>(`${this.databaseUrl}/users/ensure`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async addBalance(
    guildId: string,
    userId: string,
    amount: number
  ): Promise<HubUserRecord> {
    const body: AddBalanceRequest = { userId, guildId, amount };
    return await apiRequest<HubUserRecord, string>(`${this.databaseUrl}/economy/balance/add`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async getBalance(guildId: string, userId: string): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse>(
      `${this.databaseUrl}/economy/balance/${guildId}/${userId}`
    );
  }

  async getTotalBankBalance(guildId: string, userId: string): Promise<number> {
    const balanceData = await this.getBalance(guildId, userId);
    if (!balanceData) {
      return 0;
    }
    return Number(balanceData.totalBankBalance ?? 0);
  }

  async transferBalance(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<HubSuccessResponse> {
    const body = { fromUserId, toUserId, guildId, amount };
    return await apiRequest<HubSuccessResponse, string>(`${this.databaseUrl}/economy/transfer`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async updateBankBalance(guildId: string, userId: string): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse, string>(`${this.databaseUrl}/economy/bank/update`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async calculateInterest(guildId: string, userId: string): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse, string>(`${this.databaseUrl}/economy/bank/interest`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId }),
    });
  }

  async revertUpgrade(
    guildId: string,
    userId: string,
    upgradeType: string
  ): Promise<UpgradeRecord> {
    return await apiRequest<UpgradeRecord, string>(`${this.databaseUrl}/economy/upgrades/revert`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUpgradeInfo(upgradeType: string, level: number): Promise<UpgradeInfoResponse> {
    return await apiRequest<UpgradeInfoResponse>(
      `${this.databaseUrl}/economy/upgrades/info/${upgradeType}/${level}`
    );
  }

  async setCooldown(
    guildId: string,
    userId: string,
    type: string,
    duration: number
  ): Promise<CooldownRecordResponse> {
    return await apiRequest<CooldownRecordResponse, string>(`${this.databaseUrl}/cooldowns/`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, type, duration }),
    });
  }

  async getCooldown(
    guildId: string,
    userId: string,
    type: string
  ): Promise<number | CooldownResponse> {
    return await apiRequest(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`
    );
  }

  async getCrateCooldown(
    guildId: string,
    userId: string,
    type: string
  ): Promise<number | null> {
    return await apiRequest<number | null>(
      `${this.databaseUrl}/cooldowns/crate/${guildId}/${userId}/${type}`
    );
  }

  async deleteCooldown(
    guildId: string,
    userId: string,
    type: string
  ): Promise<CooldownRecordResponse> {
    return await apiRequest<CooldownRecordResponse>(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}/${type}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllCooldowns(guildId: string, userId: string): Promise<AllCooldownsResponse> {
    return await apiRequest<AllCooldownsResponse>(
      `${this.databaseUrl}/cooldowns/${guildId}/${userId}`
    );
  }

  async addXP(guildId: string, userId: string, amount: number): Promise<AddXpResponse> {
    return await apiRequest<AddXpResponse, string>(`${this.databaseUrl}/xp/add`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async getUserLevel(
    guildId: string,
    userId: string,
    type: string = "activity"
  ): Promise<LevelCalculation> {
    return await apiRequest<LevelCalculation>(
      `${this.databaseUrl}/xp/level/${guildId}/${userId}?type=${type}`
    );
  }

  async getAllUserLevels(guildId: string, userId: string): Promise<UserLevelsResponse> {
    return await apiRequest<UserLevelsResponse>(
      `${this.databaseUrl}/xp/levels/${guildId}/${userId}`
    );
  }

  async calculateLevelFromXP(xp: number): Promise<LevelCalculation> {
    return await apiRequest<LevelCalculation, string>(`${this.databaseUrl}/xp/calculate`, {
      method: "POST",
      body: JSON.stringify({ xp }),
    });
  }

  async checkLevelUpFromXP(
    guildId: string,
    userId: string,
    oldXp: number,
    newXp: number
  ): Promise<LevelUpCheck | null> {
    return await apiRequest<LevelUpCheck | null, string>(`${this.databaseUrl}/xp/check-levelup`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, oldXp, newXp }),
    });
  }

  async addGameXP(
    guildId: string,
    userId: string,
    gameType: string,
    amount: number
  ): Promise<AddGameXpResponse> {
    const body: AddGameXpRequest = { userId, guildId, gameType, xp: amount };
    return await apiRequest<AddGameXpResponse, string>(`${this.databaseUrl}/games/xp/add`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // Guild management methods
  async getGuild(guildId: string): Promise<GuildRecord> {
    return await apiRequest<GuildRecord>(`${this.databaseUrl}/guilds/${guildId}`);
  }

  async ensureGuild(
    guildId: string,
    guildData: Record<string, unknown> = {}
  ): Promise<GuildRecord> {
    return await apiRequest<GuildRecord, string>(`${this.databaseUrl}/guilds/ensure`, {
      method: "POST",
      body: JSON.stringify({ guildId, ...guildData }),
    });
  }

  async updateGuild(guildId: string, updateData: unknown): Promise<GuildRecord> {
    return await apiRequest<GuildRecord, string>(`${this.databaseUrl}/guilds/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
  }

  async ensureGuildUser(guildId: string, userId: string): Promise<HubUserRecord> {
    const body: EnsureGuildUserRequest = { userId };
    return await apiRequest<HubUserRecord, string>(
      `${this.databaseUrl}/guilds/${guildId}/users/ensure`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  async updateGameHighScore(
    guildId: string,
    userId: string,
    gameType: string,
    score: number
  ): Promise<UpdateGameRecordResponse> {
    const body: UpdateGameRecordRequest = { userId, guildId, gameId: gameType, score };
    return await apiRequest<UpdateGameRecordResponse, string>(
      `${this.databaseUrl}/games/records/update`,
      {
      method: "POST",
        body: JSON.stringify(body),
      }
    );
  }

  async getGameRecords(guildId: string, userId: string): Promise<GameRecordsResponse> {
    return await apiRequest<GameRecordsResponse>(
      `${this.databaseUrl}/games/records/${guildId}/${userId}`
    );
  }

  // Voice session management methods
  async createVoiceSession(
    guildId: string,
    userId: string,
    channelId: string,
    joinTime: number = Date.now()
  ): Promise<VoiceSessionRecord> {
    return await apiRequest<VoiceSessionRecord, string>(`${this.databaseUrl}/voice/sessions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, channelId, joinTime }),
    });
  }

  async getVoiceSession(guildId: string, userId: string): Promise<VoiceSessionRecord> {
    return await apiRequest<VoiceSessionRecord>(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`
    );
  }

  async removeVoiceSession(guildId: string, userId: string): Promise<VoiceSessionRecord> {
    return await apiRequest<VoiceSessionRecord>(
      `${this.databaseUrl}/voice/sessions/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllGuildVoiceSessions(guildId: string): Promise<VoiceSessionRecord[]> {
    return await apiRequest<VoiceSessionRecord[]>(
      `${this.databaseUrl}/voice/sessions/guild/${guildId}`
    );
  }

  async calculateVoiceXP(
    guildId: string,
    userId: string,
    sessionDuration: number
  ): Promise<CalculateVoiceXpResponse> {
    const body: CalculateVoiceXpRequest = { userId, guildId, timeSpent: sessionDuration };
    return await apiRequest<CalculateVoiceXpResponse, string>(`${this.databaseUrl}/voice/xp/calculate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async purchaseUpgrade(
    guildId: string,
    userId: string,
    upgradeType: string
  ): Promise<UpgradeRecord> {
    return await apiRequest<UpgradeRecord, string>(`${this.databaseUrl}/economy/upgrades/purchase`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, upgradeType }),
    });
  }

  async getUserUpgrades(guildId: string, userId: string): Promise<UserUpgradesResponse> {
    return await apiRequest<UserUpgradesResponse>(
      `${this.databaseUrl}/economy/upgrades/${guildId}/${userId}`
    );
  }

  // Level role management methods
  async getGuildLevelRoles(guildId: string): Promise<LevelRole[]> {
    return await apiRequest<LevelRole[]>(`${this.databaseUrl}/levels/roles/${guildId}`);
  }

  async getEligibleRolesForLevel(guildId: string, level: number): Promise<LevelRoleEnvelope> {
    return await apiRequest<LevelRoleEnvelope>(
      `${this.databaseUrl}/levels/roles/${guildId}/level/${level}`
    );
  }

  async getNextLevelRole(guildId: string, currentLevel: number): Promise<NextLevelRoleEnvelope> {
    return await apiRequest<NextLevelRoleEnvelope>(
      `${this.databaseUrl}/levels/roles/${guildId}/next/${currentLevel}`
    );
  }

  async addLevelRole(guildId: string, level: number, roleId: string): Promise<LevelRole> {
    return await apiRequest<LevelRole, string>(`${this.databaseUrl}/levels/roles`, {
      method: "POST",
      body: JSON.stringify({ guildId, level, roleId }),
    });
  }

  async removeLevelRole(guildId: string, level: number): Promise<DeleteManyResponse> {
    return await apiRequest<DeleteManyResponse>(
      `${this.databaseUrl}/levels/roles/${guildId}/${level}`,
      {
        method: "DELETE",
      }
    );
  }

  async updateStats(
    guildId: string,
    userId: string,
    statType: string,
    increment: number = 1
  ): Promise<StatisticsRecordResponse> {
    return await apiRequest<StatisticsRecordResponse, string>(`${this.databaseUrl}/stats/${userId}/${guildId}`, {
      method: "PATCH",
      body: JSON.stringify({ statType, increment }),
    });
  }

  async getStatistics(guildId: string, userId: string): Promise<StatisticsRecordResponse | null> {
    return await apiRequest<StatisticsRecordResponse | null>(
      `${this.databaseUrl}/stats/${guildId}/${userId}`
    );
  }

  async getInteractionStats(guildId: string, userId: string): Promise<InteractionStatsResponse> {
    return await apiRequest<InteractionStatsResponse>(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}`
    );
  }

  async getMostUsedInteractions(
    guildId: string,
    userId: string,
    limit: number = 10
  ): Promise<MostUsedInteraction[]> {
    return await apiRequest<MostUsedInteraction[]>(
      `${this.databaseUrl}/stats/interactions/${guildId}/${userId}/top?limit=${limit}`
    );
  }

  // Crypto trading methods
  async createCryptoPosition(
    guildId: string,
    userId: string,
    symbol: string,
    amount: number,
    price: number,
    type: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/crypto/positions`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, symbol, amount, price, type }),
    });
  }

  async getUserCryptoPositions(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto/positions/${guildId}/${userId}`
    );
  }

  async getCryptoPositionById(positionId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto/positions/id/${positionId}`
    );
  }

  async updateCryptoPosition(
    positionId: string,
    updateData: Record<string, unknown>
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "PUT",
        body: JSON.stringify(updateData),
      }
    );
  }

  async deleteCryptoPosition(positionId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto/positions/${positionId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAllActiveCryptoPositions(): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/crypto/positions/active/all`);
  }

  // Crypto Wallet API methods
  async getUserCryptoWallets(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}`
    );
  }

  async getCryptoWallet(
    guildId: string,
    userId: string,
    currency: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/wallets/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositAddress(
    guildId: string,
    userId: string,
    currency: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/deposit-address/${guildId}/${userId}/${currency}`
    );
  }

  async getCryptoDepositHistory(
    guildId: string,
    userId: string,
    currency: string | null = null,
    limit: number = 50,
    offset: number = 0
  ): Promise<GenericRecordResponse> {
    const params = new URLSearchParams();
    if (currency) params.append("currency", currency);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return await apiRequest<GenericRecordResponse>(
      `${
        this.databaseUrl
      }/crypto-wallet/deposits/${guildId}/${userId}?${params.toString()}`
    );
  }

  async getCryptoWithdrawalHistory(
    guildId: string,
    userId: string,
    currency: string | null = null,
    limit: number = 50,
    offset: number = 0
  ): Promise<GenericRecordResponse> {
    const params = new URLSearchParams();
    if (currency) params.append("currency", currency);
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    return await apiRequest<GenericRecordResponse>(
      `${
        this.databaseUrl
      }/crypto-wallet/withdrawals/${guildId}/${userId}?${params.toString()}`
    );
  }

  async requestCryptoWithdrawal(
    guildId: string,
    userId: string,
    currency: string,
    amount: number,
    toAddress: string,
    memo: string | null = null
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/crypto-wallet/withdrawals`, {
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

  async getCryptoPortfolioValue(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/portfolio/${guildId}/${userId}`
    );
  }

  async startCryptoDepositListening(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "POST",
      }
    );
  }

  async stopCryptoDepositListening(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/listen-deposits/${guildId}/${userId}`,
      {
        method: "DELETE",
      }
    );
  }

  async getAvailableChains(currency: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/crypto-wallet/chains/${currency}`
    );
  }

  // Guild Vault API methods
  async getGuildVault(guildId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/guild-vault/vault/${guildId}`);
  }

  async getGuildVaultDistributions(guildId: string, limit: number = 10): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distributions?limit=${limit}`
    );
  }

  async getUserVaultDistributions(
    guildId: string,
    userId: string,
    limit: number = 10
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/user/${userId}/distributions?limit=${limit}`
    );
  }

  async triggerManualDistribution(
    guildId: string,
    userId: string,
    amount: number
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/guild-vault/vault/${guildId}/distribute`,
      {
        method: "POST",
        body: JSON.stringify({ userId, amount }),
      }
    );
  }

  // Marriage API methods
  async getMarriageStatus(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/marriage/status/${userId}?guildId=${guildId}`
    );
  }

  async proposeMarriage(guildId: string, userId1: string, userId2: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/marriage/propose`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async acceptMarriage(guildId: string, userId1: string, userId2: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/marriage/accept`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async rejectMarriage(guildId: string, userId1: string, userId2: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/marriage/reject`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  async dissolveMarriage(guildId: string, userId1: string, userId2: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/marriage/dissolve`, {
      method: "POST",
      body: JSON.stringify({ guildId, userId1, userId2 }),
    });
  }

  // Bank and Economy API methods
  async calculateBankBalance(
    user: Record<string, unknown>,
    tx: Record<string, unknown> | null = null
  ): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse, string>(`${this.databaseUrl}/economy/bank/calculate`, {
      method: "POST",
      body: JSON.stringify({ user, tx }),
    });
  }

  async deposit(guildId: string, userId: string, amount: number): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse, string>(`${this.databaseUrl}/economy/deposit`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  async withdraw(guildId: string, userId: string, amount: number): Promise<BalanceResponse> {
    return await apiRequest<BalanceResponse, string>(`${this.databaseUrl}/economy/withdraw`, {
      method: "POST",
      body: JSON.stringify({ userId, guildId, amount }),
    });
  }

  // Level calculation methods
  calculateLevel(xp: number | bigint): LevelCalculation {
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

  checkLevelUp(oldXp: number | bigint, newXp: number | bigint): LevelUpCheck | null {
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
  async savePlayer(player: unknown): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/music/players`, {
      method: "POST",
      body: JSON.stringify({ player }),
    });
  }

  async loadPlayers(): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/music/players`);
  }

  async deletePlayer(guildId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "DELETE",
    });
  }

  async getPlayer(guildId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/music/players/${guildId}`);
  }

  async updatePlayer(
    guildId: string,
    data: Record<string, unknown>
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/music/players/${guildId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Crate methods
  async getUserCrates(guildId: string, userId: string): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(`${this.databaseUrl}/crates/${guildId}/${userId}`);
  }

  async openCrate(
    guildId: string,
    userId: string,
    crateType: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(`${this.databaseUrl}/crates/open`, {
      method: "POST",
      body: JSON.stringify({
        userId: userId,
        guildId: guildId,
        type: crateType,
      }),
    });
  }

  // Guild and Season methods
  async getGuildUsers(guildId: string): Promise<HubUserRecord[]> {
    return await apiRequest<HubUserRecord[]>(`${this.databaseUrl}/guilds/${guildId}/users`);
  }

  async getCurrentSeason(): Promise<SeasonSummaryResponse> {
    return await apiRequest<SeasonSummaryResponse>(`${this.databaseUrl}/seasons/current`);
  }

  async getSeasonLeaderboard(limit: number = 250): Promise<SeasonLeaderboardResponse> {
    return await apiRequest<SeasonLeaderboardResponse>(
      `${this.databaseUrl}/seasons/leaderboard?limit=${limit}`
    );
  }

  // User locale methods
  async getUserLocale(guildId: string, userId: string): Promise<string | null> {
    const response = await apiRequest<UserLocaleResponse>(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`
    );
    return response.locale;
  }

  async setUserLocale(
    guildId: string,
    userId: string,
    locale: string
  ): Promise<HubSuccessResponse> {
    const body: SetUserLocaleRequest = { locale };
    return await apiRequest<HubSuccessResponse, string>(
      `${this.databaseUrl}/users/${guildId}/${userId}/locale`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      }
    );
  }

  // Transaction methods
  async executeTransaction(operations: unknown[]): Promise<TransactionExecuteResponse> {
    return await apiRequest<TransactionExecuteResponse, string>(`${this.databaseUrl}/transaction`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
  }

  // Cache management methods
  async invalidateCache(keys: string[]): Promise<CacheInvalidateResponse> {
    return await apiRequest<CacheInvalidateResponse, string>(`${this.databaseUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ keys }),
    });
  }

  async getFromCache(key: string): Promise<GenericRecordResponse | null> {
    return await apiRequest<GenericRecordResponse | null>(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`
    );
  }

  async setCache(
    key: string,
    value: unknown,
    ttl: number | null = null
  ): Promise<CacheSetResponse> {
    return await apiRequest<CacheSetResponse, string>(
      `${this.databaseUrl}/cache/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value, ttl }),
      }
    );
  }

  // Legacy game data methods
  async getLegacyGameData(
    guildId: string,
    userId: string,
    gameId: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}?guildId=${guildId}`
    );
  }

  async setLegacyGameData(
    guildId: string,
    userId: string,
    gameId: string,
    data: unknown
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, data }),
      }
    );
  }

  async getLegacyValue(
    guildId: string,
    userId: string,
    gameId: string,
    key: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}?guildId=${guildId}`
    );
  }

  async setLegacyValue(
    guildId: string,
    userId: string,
    gameId: string,
    key: string,
    value: unknown
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "PUT",
        body: JSON.stringify({ guildId, value }),
      }
    );
  }

  async incLegacyValue(
    guildId: string,
    userId: string,
    gameId: string,
    key: string,
    increment: number = 1
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/increment`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, increment }),
      }
    );
  }

  async decLegacyValue(
    guildId: string,
    userId: string,
    gameId: string,
    key: string,
    decrement: number = 1
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}/decrement`,
      {
        method: "POST",
        body: JSON.stringify({ guildId, decrement }),
      }
    );
  }

  async deleteLegacyValue(
    guildId: string,
    userId: string,
    gameId: string,
    key: string
  ): Promise<GenericRecordResponse> {
    return await apiRequest<GenericRecordResponse, string>(
      `${this.databaseUrl}/legacy/games/${gameId}/${userId}/${key}`,
      {
        method: "DELETE",
        body: JSON.stringify({ guildId }),
      }
    );
  }

  // Rendering API methods
  async generateImage(
    component: string,
    props: Record<string, unknown> = {},
    scaling: Record<string, unknown> = { image: 1, emoji: 1 },
    locale: string = "en",
    options: Record<string, unknown> = {}
  ): Promise<RenderingGenerateImageResponse | Buffer | [Buffer, unknown]> {
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
      const jsonResponse = (await response.json()) as Record<string, unknown>;
      // If it's a JSON response with image and coloring, convert to expected format
      if (typeof jsonResponse.image === "string" && "coloring" in jsonResponse) {
        const buffer = Buffer.from(jsonResponse.image, "base64");
        return [buffer, jsonResponse.coloring];
      }
      return jsonResponse as RenderingGenerateImageResponse;
    } else {
      return await response.buffer();
    }
  }

  async processImageColors(imageUrl: string): Promise<ImageColorProcessingResponse> {
    return await apiRequest<ImageColorProcessingResponse, string>(
      `${this.renderingUrl}/colors`,
      {
      method: "POST",
      body: JSON.stringify({ imageUrl }),
      }
    );
  }

  async getAvailableComponents(): Promise<RenderingComponentsResponse> {
    return await apiRequest<RenderingComponentsResponse>(`${this.renderingUrl}/components`);
  }

  // Health check methods
  async checkDatabaseHealth(): Promise<{ status: string; error?: string } | Record<string, unknown>> {
    try {
      return await apiRequest<Record<string, unknown>>(`${this.databaseUrl}/health`);
    } catch (error: unknown) {
      return { status: "unhealthy", error: getErrorMessage(error) };
    }
  }

  async checkRenderingHealth(): Promise<{ status: string; error?: string } | Record<string, unknown>> {
    try {
      return await apiRequest<Record<string, unknown>>(`${this.renderingUrl}/health`);
    } catch (error: unknown) {
      return { status: "unhealthy", error: getErrorMessage(error) };
    }
  }

  async checkHealth(): Promise<HubCompositeHealth> {
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
  async getTranslation(
    key: string,
    variables: TranslationVariables | string = {},
    locale?: string
  ): Promise<TranslationResponse> {
    // Build a stable cache key
    const stableStringify = (obj: unknown): string => {
      if (!obj || typeof obj !== "object") return String(obj ?? "");
      const keys = Object.keys(obj).sort();
      const parts: string[] = keys.map((k: string): string => {
        const record = obj as Record<string, unknown>;
        const v = record[k];
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

    const p = apiRequest<TranslationResponse | string | null>(url)
      .then((data) => {
        const normalized = normalizeTranslationResponse(data);
        // Cache the result with TTL
        this._translationCache.set(cacheKey, {
          value: normalized,
          expiresAt: Date.now() + this._translationTTL,
        });
        this._translationInFlight.delete(cacheKey);
        return normalized;
      })
      .catch((err: unknown) => {
        // Ensure we clear in-flight on error
        this._translationInFlight.delete(cacheKey);
        throw err;
      });

    this._translationInFlight.set(cacheKey, p);
    return await p;
  }

  async registerLocalizations(
    category: string,
    name: string,
    localizations: LocalizationTree,
    save = false
  ): Promise<HubSuccessResponse> {
    // Invalidate caches for safety when registry updates
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    const body: RegisterLocalizationsRequest = { category, name, localizations, save };
    return await apiRequest<HubSuccessResponse, string>(`${this.localizationUrl}/i18n/register`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async addTranslation(
    locale: string,
    key: string,
    value: unknown,
    save = false
  ): Promise<HubSuccessResponse> {
    // Invalidate caches for safety when new translations are added
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    return await apiRequest<HubSuccessResponse, string>(`${this.localizationUrl}/i18n/add`, {
      method: "POST",
      body: JSON.stringify({ locale, key, value, save }),
    });
  }

  async getTranslationGroup(
    groupKey: string,
    locale?: string
  ): Promise<Record<string, unknown>> {
    const effectiveLocale = locale || "en";
    const cacheKey = `${effectiveLocale}::group::${groupKey || ""}`;

    // Return cached group if valid
    const cached = this._translationGroupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const data = cached.value;
      // Prime cache from cached group as well
      try {
        this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
      } catch (e: unknown) {
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
      } catch (e: unknown) {
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

    const p = apiRequest<Record<string, unknown>>(url)
      .then((data) => {
        // Cache the group response
        this._translationGroupCache.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + this._translationGroupTTL,
        });
        this._translationGroupInFlight.delete(cacheKey);
        return data;
      })
      .catch((err: unknown) => {
        this._translationGroupInFlight.delete(cacheKey);
        throw err;
      });

    this._translationGroupInFlight.set(cacheKey, p);
    const data = await p;

    // Prime the per-key translation cache with returned group entries
    try {
      this._primeCacheFromGroupData(data, effectiveLocale, groupKey);
    } catch (e: unknown) {
      // Don't fail group fetch if priming fails; just return data
      console.warn(
        "[hubClient] Failed to prime translation cache from group:",
        e
      );
    }

    return data;
  }

  // Internal helper: prime per-key cache from group response
  _primeCacheFromGroupData(
    data: Record<string, unknown> | null | undefined,
    effectiveLocale: string,
    groupKey: string | null = null
  ): void {
    // Helper to flatten nested objects into dot-notated keys
    const flatten = (
      obj: Record<string, unknown> | null | undefined,
      prefix = ""
    ): Array<[string, string]> => {
      const entries: Array<[string, string]> = [];
      if (!obj || typeof obj !== "object") return entries;
      for (const [k, v] of Object.entries(obj)) {
        const keyPath = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") {
          entries.push(...flatten(v as Record<string, unknown>, keyPath));
        } else if (typeof v === "string") {
          entries.push([keyPath, v]);
        }
      }
      return entries;
    };

    // The API may return either a plain object of keys → strings,
    // or an object wrapped under { translations: { ... } }
    const base = (data &&
      typeof data === "object" &&
      "translations" in data &&
      data.translations &&
      typeof data.translations === "object"
      ? (data.translations as Record<string, unknown>)
      : data) as Record<string, unknown> | null | undefined;

    const pairs = flatten(base);
    for (const [fullKey, value] of pairs) {
      const prefixedKey =
        groupKey && !fullKey.startsWith(groupKey)
          ? `${groupKey}.${fullKey}`
          : fullKey;
      const key = `${effectiveLocale}::${prefixedKey}::`;
      this._translationCache.set(key, {
        value: normalizeTranslationResponse(value),
        expiresAt: Date.now() + this._translationTTL,
      });
    }
  }

  async saveAllTranslations(): Promise<HubSuccessResponse> {
    // Persisted changes — clear caches to avoid stale entries
    this._translationCache.clear();
    this._translationGroupCache.clear();
    this._translationInFlight.clear();
    this._translationGroupInFlight.clear();
    return await apiRequest<HubSuccessResponse>(`${this.localizationUrl}/i18n/save-all`, {
      method: "POST",
    });
  }

  async setHubLocale(locale: string): Promise<HubLocaleResponse> {
    return await apiRequest<HubLocaleResponse, string>(`${this.localizationUrl}/i18n/set-locale`, {
      method: "POST",
      body: JSON.stringify({ locale }),
    });
  }

  async getHubLocale(): Promise<HubLocaleResponse> {
    return await apiRequest<HubLocaleResponse>(`${this.localizationUrl}/i18n/locale`);
  }

  async getSupportedLocales(): Promise<SupportedLocalesResponse> {
    return await apiRequest<SupportedLocalesResponse>(
      `${this.localizationUrl}/i18n/locales`
    );
  }

  // AI Service API methods
  async getAvailableModels(capability: string | null = null): Promise<AiModelsListResponse> {
    const params = new URLSearchParams();
    if (capability) params.append("capability", capability);

    return await apiRequest<AiModelsListResponse>(
      `${this.aiUrl}/models${params.toString() ? `?${params.toString()}` : ""}`
    );
  }

  async getModelDetails(modelId: string): Promise<AiHubModel> {
    return await apiRequest<AiHubModel>(
      `${this.aiUrl}/models/${encodeURIComponent(modelId)}`
    );
  }

  async processAIRequest(requestData: AiProcessRequest): Promise<AiProcessSuccessEnvelope> {
    return await apiRequest<AiProcessSuccessEnvelope, string>(`${this.aiUrl}/process`, {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  async checkAIHealth(): Promise<AiHealthResponse> {
    try {
      return await apiRequest<AiHealthResponse>(`${this.aiUrl}/health`);
    } catch (error: unknown) {
      return { status: "unhealthy", error: getErrorMessage(error) };
    }
  }

  async getAIMetrics(): Promise<AiMetricsResponse> {
    return await apiRequest<AiMetricsResponse>(`${this.aiUrl}/metrics`);
  }

  async invalidateAIModelCache(): Promise<CacheInvalidateResponse> {
    return await apiRequest<CacheInvalidateResponse, string>(`${this.aiUrl}/cache/invalidate`, {
      method: "POST",
      body: JSON.stringify({ type: "models" }),
    });
  }

  // New AI Hub integration methods for seamless bot integration
  async getAIHubModels(
    capability: string | null = null,
    refresh = false,
    userId: string | null = null,
    provider: string | null = null,
    sortBy: string | null = "featured",
    sortOrder: string | null = "desc"
  ): Promise<AiHubModel[]> {
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

      const response = await apiRequest<AiModelsListResponse | AiHubModel[]>(
        `${this.aiUrl}${endpoint}${
          params.toString() ? `?${params.toString()}` : ""
        }`
      );

      if (Array.isArray(response)) {
        console.log(`[getAIHubModels] Received ${response.length} models`);
        return response;
      }
      console.log(`[getAIHubModels] Received ${response.models?.length || 0} models`);
      return response.models || [];
    } catch (error: unknown) {
      console.error("Error fetching AI hub models:", error);
      throw error;
    }
  }

  async processAIHubRequest(
    requestData: AiProcessRequest
  ): Promise<Record<string, unknown>> {
    try {
      const response = await apiRequest<
        AiProcessSuccessEnvelope<Record<string, unknown>> | Record<string, unknown>,
        string
      >(`${this.aiUrl}/ai/process`, {
        method: "POST",
        body: JSON.stringify(requestData),
      });

      // The hub wraps non-streaming responses as { success, data, requestId, ... }
      // Normalize to an OpenAI-like { choices: [{ message: { ... } }] } shape
      const envelope = response as AiProcessSuccessEnvelope<Record<string, unknown>>;
      const data = envelope && "data" in envelope ? envelope.data : response;
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
      return (response as Record<string, unknown>) ?? {};
    } catch (error: unknown) {
      console.error("Error processing AI hub request:", error);
      throw error;
    }
  }

  async processAIHubStream(
    requestData: AiProcessRequest,
    onChunk: (chunk: AiStreamChunk) => void | Promise<void>,
    onError: (error: Error) => void | Promise<void>,
    onComplete: (completion: AiStreamCompletion) => void | Promise<void>
  ): Promise<AiStreamCompletion> {
    const requestId = requestData.requestId;
    if (!requestId) {
      throw new Error("requestId is required for AI streaming");
    }
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
      } catch (e: unknown) {
        console.error("[processAIHubStream] Error closing old connection:", e);
      }
      this._activeWebSockets.delete(requestId);
    }

    return new Promise<AiStreamCompletion>((resolve, reject) => {
      let ws: WebSocket | null = null;
      let isResolved = false;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 2; // Reduced to prevent excessive reconnections
      const reconnectDelay = 1500; // Increased delay

      const safeCall = <TArgs extends unknown[]>(
        fn: (...args: TArgs) => unknown,
        ...args: TArgs
      ) => {
        try {
          if (typeof fn === "function") fn(...args);
        } catch (e: unknown) {
          console.error("Stream callback error:", e);
        }
      };

      const cleanup = () => {
        if (ws?.readyState === WebSocket.OPEN) {
          try {
            ws.close(1000, "Normal closure");
          } catch (e: unknown) {
            console.error("Error closing WebSocket:", e);
          }
        }
        this._activeWebSockets.delete(requestId);
        ws = null;
      };

      const resolveOnce = (data: AiStreamCompletion) => {
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

      const rejectOnce = (error: Error) => {
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
              ws?.send(JSON.stringify(msg));
            } catch (sendError: unknown) {
              const normalizedError =
                sendError instanceof Error ? sendError : new Error(String(sendError));
              console.error(
                "[processAIHubStream] Error sending message:",
                normalizedError
              );
              safeCall(onError, normalizedError);
            }
          });

          ws.on("message", (raw: WebSocket.RawData) => {
            let message: AiStreamMessage;
            try {
              message = JSON.parse(raw.toString());
            } catch (e: unknown) {
              const parseError = e instanceof Error ? e : new Error(String(e));
              console.error("[processAIHubStream] Error parsing message:", e);
              safeCall(onError, parseError);
              return;
            }

            switch (message.type) {
              case "connected":
              case "request_acknowledged":
                break;
              case "stream_chunk": {
                const chunk = (message.chunk ||
                  message.data?.chunk ||
                  message.data) as
                  | {
                      type?: string;
                      data?: unknown;
                      content?: unknown;
                      reasoning?: unknown;
                      toolCalls?: unknown;
                      finishReason?: unknown;
                    }
                  | undefined;
                if (!chunk) break;

                // Handle different chunk formats from the hub
                let mapped: AiStreamChunk;
                if (chunk.type === "content" && typeof chunk.data === "string") {
                  // Hub sends content in chunk.data for content-type chunks
                  mapped = {
                    content: chunk.data,
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
                  } else if (
                    typeof chunk.data === "object" &&
                    chunk.data !== null &&
                    "content" in chunk.data
                  ) {
                    const contentValue = (chunk.data as Record<string, unknown>).content;
                    reasoningText = typeof contentValue === "string" ? contentValue : "";
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
                } else if (
                  chunk.type === "tool_calls" &&
                  Array.isArray(chunk.data) &&
                  chunk.data.length > 0
                ) {
                  // Hub sends tool calls in chunk.data for tool-type chunks
                  mapped = {
                    content: "",
                    reasoning: "",
                    tool_call:
                      typeof chunk.data[0] === "object" && chunk.data[0] !== null
                        ? (chunk.data[0] as Record<string, unknown>)
                        : undefined,
                    finish_reason: undefined,
                  };
                } else {
                  // Fallback to direct chunk properties (unified format)
                  mapped = {
                    content: typeof chunk.content === "string" ? chunk.content : "",
                    reasoning: typeof chunk.reasoning === "string" ? chunk.reasoning : "",
                    tool_call:
                      Array.isArray(chunk.toolCalls) &&
                      typeof chunk.toolCalls[0] === "object" &&
                      chunk.toolCalls[0] !== null
                        ? (chunk.toolCalls[0] as Record<string, unknown>)
                        : undefined,
                    finish_reason:
                      typeof chunk.finishReason === "string"
                        ? chunk.finishReason
                        : undefined,
                  };
                }

                safeCall(onChunk, mapped);
                break;
              }
              case "tool_call": {
                const toolCall = message.toolCall || message.data?.toolCall;
                if (toolCall) safeCall(onChunk, { tool_call: toolCall as Record<string, unknown> });
                break;
              }
              case "error": {
                const errMsg =
                  typeof message.error === "string"
                    ? message.error
                    : message.error?.message || "Unknown error";
                const err = new Error(String(errMsg));
                console.error("[processAIHubStream] Hub error:", err);
                safeCall(onError, err);
                ws?.close();
                rejectOnce(err);
                break;
              }
              case "stream_complete": {
                const finishReasonFromData =
                  message.data && typeof message.data.finishReason === "string"
                    ? message.data.finishReason
                    : null;
                const finalData: AiStreamCompletion = {
                  finishReason:
                    (typeof message.finishReason === "string"
                      ? message.finishReason
                      : null) ||
                    finishReasonFromData ||
                    "stop",
                };
                safeCall(onComplete, finalData);
                ws?.close();
                resolveOnce(finalData);
                break;
              }
              case "session_closed": {
                console.log("[processAIHubStream] Session closed by hub");
                ws?.close();
                break;
              }
              default:
                break;
            }
          });

          ws.on("error", (error: Error) => {
            console.error("[processAIHubStream] WebSocket error:", error);
            safeCall(onError, error);
            handleConnectionError(error);
          });

          ws.on("close", (code: number, reason: Buffer) => {
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
        } catch (connectionError: unknown) {
          const normalizedError =
            connectionError instanceof Error
              ? connectionError
              : new Error(String(connectionError));
          console.error(
            "[processAIHubStream] Connection failed:",
            normalizedError
          );
          handleConnectionError(normalizedError);
        }
      };

      const handleConnectionError = (error: Error) => {
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
      let connectionTimeout: ReturnType<typeof setTimeout>;

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

  async stopAIHubStream(requestId: string): Promise<boolean> {
    // Implementation for stopping streams if needed
    console.log(`[stopAIHubStream] Stopping stream for request ${requestId}`);
    const ws = this._activeWebSockets.get(requestId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(1000, "Client requested stop");
        console.log(
          `[stopAIHubStream] Successfully stopped stream for request ${requestId}`
        );
      } catch (e: unknown) {
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
  async processAIStream(
    requestData: AiProcessRequest,
    onChunk: (chunk: AiStreamChunk) => void | Promise<void>,
    onError: (error: Error) => void | Promise<void>,
    onComplete: (completion: AiStreamCompletion) => void | Promise<void>
  ): Promise<AiStreamCompletion> {
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
  async transcribeAudio(params: AiTranscriptionRequest): Promise<AiTranscriptionResponse> {
    try {
      const { audioData, filename, language = "auto", userId } = params;
      const formData = new FormData();
      formData.append("file", new Blob([audioData]), filename);
      formData.append("model", "whisper-1");
      formData.append("language", language);
      formData.append("userId", userId);

      const response = await apiRequest<{ data?: Record<string, unknown> }>(
        `${this.aiUrl}/ai/audio/transcribe`,
        {
        method: "POST",
        body: formData as unknown as NodeFetchRequestInit["body"],
        }
      );

      return response.data ?? {};
    } catch (error: unknown) {
      console.error("Error transcribing audio through hub:", error);
      throw new Error(`Audio transcription failed: ${getErrorMessage(error)}`);
    }
  }
}

// Create and export a singleton instance
const hubClient = new HubClient() as HubClientLike;
export { hubClient };
export default hubClient;
