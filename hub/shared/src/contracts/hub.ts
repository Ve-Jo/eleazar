import type {
  CrateRewardConfig,
  CrateTypeConfig,
  UpgradeConfig,
} from "../domain.ts";

export type TranslationVariables = Record<string, unknown>;
export type LocalizationTree = Record<string, unknown>;

export type CacheEntry<TValue = unknown> = {
  expiresAt: number;
  value: TValue;
};

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

export type HubUserUpgrade = {
  type: string;
  level?: number;
};

export type HubUserEconomy = {
  balance?: number | string;
  bankBalance?: number | string;
  bankRate?: number | string;
  bankStartTime?: number | string;
};

export type HubUserLevel = {
  xp?: number | string;
  voiceXp?: number | string;
  gameXp?: number | string;
};

export type HubUserStats = {
  totalEarned?: number | string;
  messageCount?: number | string;
  commandCount?: number | string;
  gameRecords?: Record<string, unknown> | string;
};

export type HubUserRecord = {
  id: string;
  guildId?: string;
  economy?: HubUserEconomy | null;
  Level?: HubUserLevel | null;
  level?: HubUserLevel | null;
  stats?: HubUserStats | null;
  upgrades?: HubUserUpgrade[] | Record<string, { level?: number }> | null;
  cooldowns?: { data?: unknown } | Record<string, unknown> | null;
  levelProgress?: {
    chat?: LevelCalculation;
    voice?: LevelCalculation;
    game?: LevelCalculation;
  };
  [key: string]: unknown;
};

export type CooldownResponse = {
  cooldown?: number;
  [key: string]: unknown;
};

export type CooldownRecordResponse = {
  userId?: string;
  guildId?: string;
  data?: Record<string, number> | string | null;
  [key: string]: unknown;
};

export type AllCooldownsResponse = {
  cooldowns: Record<string, unknown>;
};

export type GameRecordEntry = {
  highScore?: number;
  [key: string]: unknown;
};

export type GameRecordsResponse = Record<string, GameRecordEntry>;

export type LevelRole = {
  requiredLevel?: number;
  level?: number;
  roleId: string;
  mode?: "text" | "voice" | "gaming" | "combined_activity" | "combined_all" | string;
  replaceLowerRoles?: boolean;
  [key: string]: unknown;
};

export type LevelRoleEnvelope = {
  role: LevelRole | null;
};

export type NextLevelRoleEnvelope = {
  nextRole: LevelRole | null;
};

export type DeleteManyResponse = {
  count: number;
};

export type HubSuccessResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

export type UserIdentifier = {
  guildId: string;
  userId: string;
};

export type EnsureUserRequest = UserIdentifier;

export type EnsureGuildUserRequest = {
  userId: string;
};

export type UserProfile = {
  realName?: unknown;
  age?: unknown;
  gender?: unknown;
  countryCode?: unknown;
  pronouns?: unknown;
  locale?: string | null;
};

export type UpdateUserProfileRequest = Partial<UserProfile>;

export type UserLocaleResponse = {
  locale: string | null;
};

export type SetUserLocaleRequest = {
  locale: string;
};

export type BalanceResponse = {
  balance?: number | string;
  bankBalance?: number | string;
  bankDistributed?: number | string;
  totalBankBalance?: number | string;
  bankRate?: number | string;
  bankStartTime?: number | string;
  [key: string]: unknown;
};

export type ActivitySupportedLocale = "en" | "ru" | "uk";

export type ActivityPalette = {
  textColor: string;
  secondaryTextColor: string;
  tertiaryTextColor: string;
  overlayBackground: string;
  backgroundGradient: string;
  accentColor: string;
  dominantColor?: string;
  isDarkText: boolean;
};

export type ActivityLauncherStrings = {
  nav: Record<string, string>;
  common: Record<string, string>;
  balance: Record<string, string>;
  cases: Record<string, string>;
  upgrades: Record<string, string>;
  games: Record<string, string>;
  modal: Record<string, string>;
};

export type ActivityUserSummary = {
  id?: string;
  username?: string;
  displayName?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  locale?: ActivitySupportedLocale;
};

export type ActivityGuildSummary = {
  id?: string;
  name?: string;
};

export type ActivityBalanceSnapshot = {
  walletBalance: number;
  bankBalance: number;
  bankDistributed: number;
  totalBankBalance: number;
  projectedBankBalance: number;
  projectedTotalBankBalance: number;
  annualRate: number;
  annualRatePercent: number;
  cycleStartTime: number;
  maxInactiveMs: number;
  timeIntoCycleMs: number;
  cycleProgress: number;
  cycleComplete: boolean;
  upgradeDiscount: number;
  updatedAt: number;
};

export type ActivityCrateCard = {
  type: string;
  name: string;
  description: string;
  emoji: string;
  count: number;
  available: boolean;
  cooldownRemainingMs: number;
  cooldownDurationMs: number;
  nextAvailableAt: number | null;
  statusLabel: string;
  rewardPreview: Record<string, number>;
  dailyStatus?: Record<string, unknown> | null;
};

export type ActivityCasesState = {
  totalCount: number;
  availableCount: number;
  dailyStatus?: Record<string, unknown> | null;
  cards: ActivityCrateCard[];
};

export type ActivityUpgradeCard = {
  type: string;
  category: string;
  emoji: string;
  name: string;
  description: string;
  impactLabel: string;
  currentLevel: number;
  nextLevel: number;
  currentEffect: number;
  nextEffect: number;
  deltaEffect: number;
  effectUnit: string;
  currentEffectLabel: string;
  nextEffectLabel: string;
  deltaEffectLabel: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  isAffordable: boolean;
  coinsNeeded: number;
};

export type ActivityUpgradeGroup = {
  key: string;
  title: string;
  items: ActivityUpgradeCard[];
};

export type ActivityUpgradesState = {
  totalCount: number;
  discountPercent: number;
  groups: ActivityUpgradeGroup[];
};

export type ActivityGameCard = {
  id: string;
  title: string;
  emoji: string;
  status: "playable" | "coming_soon";
  playable: boolean;
  highScore?: number;
  dailyStatus?: Record<string, unknown> | null;
};

export type ActivityGamesState = {
  items: ActivityGameCard[];
  playableGameId?: string | null;
};

export type ActivityLauncherPayload = {
  locale: ActivitySupportedLocale;
  strings: ActivityLauncherStrings;
  palette: ActivityPalette;
  user: ActivityUserSummary;
  guild: ActivityGuildSummary | null;
  readOnly: boolean;
  unsupportedReason?: string;
  balance: ActivityBalanceSnapshot;
  cases: ActivityCasesState;
  upgrades: ActivityUpgradesState;
  games: ActivityGamesState;
  refreshedAt: number;
};

export type ActivityMutationEnvelope<TAction = Record<string, unknown>> = {
  success: boolean;
  action?: TAction;
  launcher: ActivityLauncherPayload;
};

export type AddBalanceRequest = UserIdentifier & {
  amount: number;
  source?: string;
  metadata?: Record<string, unknown> | null;
};

export type TransferBalanceRequest = {
  guildId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
};

export type UpgradeActionRequest = UserIdentifier & {
  upgradeType: string;
};

export type UpgradeInfoResponse = Record<string, unknown>;

export type UpgradeRecord = {
  userId?: string;
  guildId?: string;
  type?: string;
  level?: number;
  [key: string]: unknown;
};

export type UserUpgradesResponse = HubUserRecord["upgrades"] | UpgradeRecord[];

export type UpdateGameRecordRequest = UserIdentifier & {
  gameId: string;
  score: number;
};

export type UpdateGameRecordResponse =
  | {
      newHighScore: number | null;
      previousHighScore: number;
      isNewRecord: boolean;
    }
  | {
      isNewRecord: false;
      error: string;
    };

export type AddGameXpRequest = UserIdentifier & {
  gameType: string;
  xp: number;
};

export type AddGameXpResponse = {
  level: Record<string, unknown>;
  stats: Record<string, unknown>;
  levelUp: LevelUpCheck | null;
  type: string;
};

export type AddXpRequest = UserIdentifier & {
  amount: number;
};

export type AddXpResponse = {
  level: Record<string, unknown>;
  stats: Record<string, unknown>;
  levelUp: (LevelUpCheck & { assignedRole?: string | null; removedRoles?: string[] }) | null;
  type: string;
};

export type UserLevelsResponse = {
  text: LevelCalculation;
  voice: LevelCalculation;
  gaming: LevelCalculation;
  season: LevelCalculation;
  details: {
    text: Record<string, unknown>;
    voice: Record<string, unknown>;
    gaming: Record<string, unknown>;
  };
};

export type GuildRecord = {
  id: string;
  settings?: Record<string, unknown>;
  users?: HubUserRecord[];
  [key: string]: unknown;
};

export type StatisticsRecordResponse = {
  userId?: string;
  guildId?: string;
  totalEarned?: number;
  messageCount?: number;
  commandCount?: number;
  gameRecords?: Record<string, unknown> | string;
  xpStats?: Record<string, unknown> | string;
  gameXpStats?: Record<string, unknown> | string;
  interactionStats?: Record<string, unknown> | string;
  voiceTime?: number;
  lastUpdated?: number;
  [key: string]: unknown;
};

export type InteractionStatsResponse = {
  commands: Record<string, number>;
  buttons: Record<string, number>;
  selectMenus: Record<string, number>;
  modals: Record<string, number>;
} | null;

export type MostUsedInteraction = {
  name: string;
  count: number;
};

export type VoiceSessionRecord = {
  guildId?: string;
  userId?: string;
  channelId?: string;
  joinTime?: number | string;
  leaveTime?: number | string;
  duration?: number | string;
  [key: string]: unknown;
};

export type CreateVoiceSessionRequest = UserIdentifier & {
  channelId: string;
  joinTime?: number;
};

export type CalculateVoiceXpRequest = UserIdentifier & {
  timeSpent: number;
};

export type CalculateVoiceXpResponse = {
  timeSpent: number;
  xpAmount: number;
  levelUp: (LevelUpCheck & { assignedRole?: string | null; removedRoles?: string[] }) | null;
};

export type TranslationResponse = {
  translation: string;
};

export type TranslationGroupResponse = {
  group: Record<string, unknown>;
};

export type RegisterLocalizationsRequest = {
  category: string;
  name: string;
  localizations: LocalizationTree;
  save?: boolean;
};

export type AddTranslationRequest = {
  locale: string;
  key: string;
  value: unknown;
  save?: boolean;
};

export type HubLocaleResponse = {
  locale: string;
};

export type SupportedLocalesResponse = {
  locales: string[];
};

export type RenderingGenerateImageRequest = {
  component: string;
  props?: Record<string, unknown>;
  scaling?: Record<string, unknown>;
  locale?: string;
  options?: Record<string, unknown>;
};

export type RenderingGenerateImageResponse =
  | {
      image: string;
      coloring: unknown;
    }
  | Record<string, unknown>;

export type ImageColorProcessingResponse = {
  backgroundColor?: string;
  primaryColor?: string;
  secondaryColor?: string;
  palette?: unknown;
  embedColor?: number | string;
  [key: string]: unknown;
};

export type RenderingComponentsResponse = {
  components: string[];
};

export type AiProcessRequest = {
  requestId?: string;
  model: string;
  provider?: string | null;
  userId?: string | null;
  guildId?: string | null;
  messages?: unknown[];
  parameters?: Record<string, unknown>;
  reasoning?: unknown;
  capabilities?: Record<string, unknown>;
  stream?: boolean;
  legacyFormat?: boolean;
  [key: string]: unknown;
};

export type AiProcessSuccessEnvelope<TData = unknown> = {
  success: boolean;
  data: TData;
  requestId?: string;
  duration?: string;
  timestamp?: string;
  format?: string;
  [key: string]: unknown;
};

export type AiModelsListResponse = {
  models: AiHubModel[];
  count?: number;
  timestamp?: string;
  [key: string]: unknown;
};

export type AiHealthResponse = {
  status: string;
  [key: string]: unknown;
};

export type AiMetricsResponse = Record<string, unknown>;

export type GenericRecordResponse = Record<string, unknown>;
export type GenericListResponse = Record<string, unknown>[];

export type HubServiceHealth = {
  status: string;
  error?: string;
  [key: string]: unknown;
};

export type HubCompositeHealth = {
  database: HubServiceHealth | Record<string, unknown>;
  rendering: HubServiceHealth | Record<string, unknown>;
  overall: "healthy" | "degraded";
};

export type SeasonSummaryResponse = {
  seasonNumber?: number;
  seasonEnds?: number;
  [key: string]: unknown;
};

export type SeasonLeaderboardEntry = {
  userId?: string;
  guildId?: string;
  score?: number;
  xp?: number;
  rank?: number;
  [key: string]: unknown;
};

export type SeasonLeaderboardResponse = SeasonLeaderboardEntry[];

export type GameLeaderboardCategory = "games" | "2048" | "snake";
export type GameLeaderboardScope = "local" | "global";

export type GameLeaderboardEntry = {
  id: string;
  userId: string;
  guildId?: string;
  score: number;
  stats?: {
    gameRecords?: {
      "2048"?: { highScore?: number };
      snake?: { highScore?: number };
    };
  };
  [key: string]: unknown;
};

export type GameLeaderboardResponse = GameLeaderboardEntry[];

export type TransactionExecuteResponse = {
  results: unknown[];
  [key: string]: unknown;
};

export type CacheInvalidateResponse = {
  success?: boolean;
  keys?: string[];
  [key: string]: unknown;
};

export type CacheSetResponse = {
  success?: boolean;
  key?: string;
  ttl?: number | null;
  [key: string]: unknown;
};

export type AiStreamChunk = {
  content?: string;
  reasoning?: string;
  tool_call?: Record<string, unknown>;
  finish_reason?: string;
};

export type AiStreamCompletion = {
  finishReason: string;
  [key: string]: unknown;
};

export type AiStreamMessage = {
  type?: string;
  requestId?: string;
  chunk?: Record<string, unknown>;
  data?: Record<string, unknown>;
  toolCall?: Record<string, unknown>;
  error?: { message?: string } | string;
  finishReason?: string;
  [key: string]: unknown;
};

export type AiTranscriptionRequest = {
  audioData: ArrayBuffer | Uint8Array | Buffer;
  filename: string;
  language?: string;
  userId: string;
};

export type AiTranscriptionResponse = Record<string, unknown>;

export type CrateRewardResult = {
  type: string;
  coins: number;
  seasonXp: number;
  discount: number;
};

export type HubContracts = {
  constants: {
    crateTypes: Record<string, CrateTypeConfig>;
    upgrades: Record<string, UpgradeConfig>;
    crateRewards: Record<string, CrateRewardConfig>;
  };
};
