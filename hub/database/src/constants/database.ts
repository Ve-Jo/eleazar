export const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  work: 3 * 60 * 60 * 1000,
  crime: 2 * 60 * 60 * 1000,
  message: 60 * 1000,
  upgraderevert: 10 * 60 * 1000,
} as const;

export const CRATE_TYPES = {
  daily: {
    cooldown: 24 * 60 * 60 * 1000,
    emoji: "🎁",
    rewards: {
      min_coins: 10,
      max_coins: 100,
      seasonXp_chance: 0.5,
      seasonXp_amount: 50,
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
      seasonXp_chance: 0.5,
      seasonXp_amount: 100,
      discount_chance: 0.3,
      discount_amount: 5,
      cooldown_reducer_chance: 0,
      cooldown_reducer_amount: 0,
    },
  },
} as const;

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
} as const;

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
} as const;

export const COLLECTION_INTERVAL = 60000;
export const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;
export const DEFAULT_RETENTION_DAYS = 1;

export const BANK_MAX_INACTIVE_DAYS = 2;
export const BANK_MAX_INACTIVE_MS = BANK_MAX_INACTIVE_DAYS * 24 * 60 * 60 * 1000;

export const MAX_RETRIES = 5;
export const INITIAL_DELAY_MS = 1000;
export const MAX_DELAY_MS = 10000;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
