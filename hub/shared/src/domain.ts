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
  // Economy - unchanged
  daily_bonus: {
    emoji: "🎁",
    basePrice: 20,
    priceMultiplier: 1.5,
    effectMultiplier: 0.15, // +15% daily rewards per level
    category: "economy",
  },
  games_earning: {
    emoji: "🎮",
    basePrice: 75,
    priceMultiplier: 1.3,
    effectMultiplier: 0.1, // +10% game payouts per level
    category: "economy",
  },
  // Activity - merges crime + fraud_protection
  crime_mastery: {
    emoji: "🦹",
    basePrice: 60,
    priceMultiplier: 1.25,
    effectMultiplier: 0.06, // -6% crime fines per level
    effectValue: 20 * 60 * 1000, // -20min crime cooldown per level
    effectSuccess: 0.04, // +4% crime success chance per level
    category: "activity",
  },
  // Cooldowns - reduces daily/weekly cooldowns by percentage
  time_wizard: {
    emoji: "⏳",
    basePrice: 100,
    priceMultiplier: 1.35,
    effectMultiplier: 0.01, // -1% daily/weekly cooldowns per level
    category: "cooldowns",
  },
  // Defense - merges wallet_shield + vault_insurance + tax_optimization
  vault_guard: {
    emoji: "🛡️",
    basePrice: 120,
    priceMultiplier: 1.4,
    effectMultiplier: 0.07, // -7% theft vulnerability per level
    effectRisk: 0.08, // -8% risk game losses per level
    effectFees: 0.01, // -1% bank operation fees per level
    category: "defense",
  },
  // Banking - NEW upgrade for max inactive time
  bank_vault: {
    emoji: "🏦",
    basePrice: 80,
    priceMultiplier: 1.3,
    effectValue: 60 * 60 * 1000, // +1 hour max bank accumulation per level
    category: "banking",
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
    games_earning: { level: 1 },
    crime_mastery: { level: 1 },
    time_wizard: { level: 1 },
    vault_guard: { level: 1 },
    bank_vault: { level: 1 },
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
