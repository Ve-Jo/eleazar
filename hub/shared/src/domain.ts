export const COOLDOWNS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  work: 3 * 60 * 60 * 1000,
  crime: 2 * 60 * 60 * 1000,
  message: 60 * 1000,
  upgraderevert: 10 * 60 * 1000,
} as const;

export type CooldownKey = keyof typeof COOLDOWNS;

export const CRATE_TYPES = {
  daily: {
    cooldown: 24 * 60 * 60 * 1000,
    emoji: "🎁",
    rewards: {
      min_coins: 10,
      max_coins: 60,
      seasonXp_chance: 0.5,
      seasonXp_amount: 50,
      discount_chance: 0.2,
      discount_amount: 3,
      cooldown_reducer_chance: 0,
      cooldown_reducer_amount: 0,
    },
  },
  weekly: {
    cooldown: 7 * 24 * 60 * 60 * 1000,
    emoji: "📦",
    rewards: {
      min_coins: 40,
      max_coins: 180,
      seasonXp_chance: 0.5,
      seasonXp_amount: 100,
      discount_chance: 0.25,
      discount_amount: 5,
      cooldown_reducer_chance: 0,
      cooldown_reducer_amount: 0,
    },
  },
} as const;

export type CrateTypeKey = keyof typeof CRATE_TYPES;
export type CrateTypeConfig = (typeof CRATE_TYPES)[CrateTypeKey];
export type CrateRewardConfig = CrateTypeConfig["rewards"];

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
  fraud_protection: {
    emoji: "🛡️",
    basePrice: 90,
    priceMultiplier: 1.35,
    effectMultiplier: 0.06,
    category: "economy",
  },
  wallet_shield: {
    emoji: "🔐",
    basePrice: 110,
    priceMultiplier: 1.4,
    effectMultiplier: 0.07,
    category: "economy",
  },
  vault_insurance: {
    emoji: "🏦",
    basePrice: 140,
    priceMultiplier: 1.45,
    effectMultiplier: 0.08,
    category: "economy",
  },
  cooldown_mastery: {
    emoji: "⌛",
    basePrice: 120,
    priceMultiplier: 1.3,
    effectValue: 5 * 60 * 1000,
    category: "cooldowns",
  },
  tax_optimization: {
    emoji: "📉",
    basePrice: 100,
    priceMultiplier: 1.33,
    effectMultiplier: 0.01,
    category: "economy",
  },
} as const;

export type UpgradeKey = keyof typeof UPGRADES;
export type UpgradeConfig = (typeof UPGRADES)[UpgradeKey];

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
    fraud_protection: { level: 1 },
    wallet_shield: { level: 1 },
    vault_insurance: { level: 1 },
    cooldown_mastery: { level: 1 },
    tax_optimization: { level: 1 },
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

export type DefaultValues = typeof DEFAULT_VALUES;
