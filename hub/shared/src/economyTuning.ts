type RangeTarget = {
  min: number;
  target: number;
  max: number;
};

export type GameEconomyEnvelope = {
  coinsPerHour: RangeTarget;
  xpPerHour: RangeTarget;
  maxCoinAward: number;
  maxXpAward: number;
};

type ActivityBandTargets = {
  coinsPerDay: RangeTarget;
  xpPerHour: RangeTarget;
};

export type EconomyTuningConfig = {
  version: string;
  targets: {
    early: ActivityBandTargets;
    mid: ActivityBandTargets;
    high: ActivityBandTargets;
  };
  faucets: {
    crateCoinMultiplier: number;
    gameCoinMultiplier: number;
    gameDailyCapMultiplier: number;
    gameXpMultiplier: number;
    crimeStealMultiplier: number;
    bankInterestRateMultiplier: number;
  };
  sinks: {
    upgradePriceMultiplier: number;
    bankFeeMultiplier: number;
    riskyLossMultiplier: number;
    crimeFineMultiplier: number;
    optionalPrestigeSinkRate: number;
    seasonXpPerSunkCoin: number;
  };
  bank: {
    maxAnnualRatePercent: number;
    maxCycleDurationMs: number;
  };
  enforcement: {
    awardEnvelopeClamps: boolean;
    longTermSinks: boolean;
  };
  guardrails: {
    maxTimeWizardReductionPercent: number;
    minCrimeCooldownMs: number;
    maxCrimeSuccessChance: number;
    maxCrimeStealPercent: number;
    maxCrimeFineReduction: number;
    towerVaultRefundPerLevel: number;
    towerMaxVaultRefundReduction: number;
  };
  perGameEnvelopes: Record<string, GameEconomyEnvelope>;
  fallbackGameEnvelope: GameEconomyEnvelope;
};

const STABLE_ECONOMY_TUNING_CONFIG: EconomyTuningConfig = Object.freeze({
  version: "stable-2026-03-24-r6",
  targets: {
    early: {
      coinsPerDay: { min: 90, target: 180, max: 320 },
      xpPerHour: { min: 35, target: 70, max: 120 },
    },
    mid: {
      coinsPerDay: { min: 220, target: 480, max: 900 },
      xpPerHour: { min: 70, target: 130, max: 210 },
    },
    high: {
      coinsPerDay: { min: 500, target: 900, max: 1700 },
      xpPerHour: { min: 120, target: 220, max: 340 },
    },
  },
  faucets: {
    crateCoinMultiplier: 1,
    gameCoinMultiplier: 0.9,
    gameDailyCapMultiplier: 0.5,
    gameXpMultiplier: 1,
    crimeStealMultiplier: 0.83,
    bankInterestRateMultiplier: 1,
  },
  sinks: {
    upgradePriceMultiplier: 2.8,
    bankFeeMultiplier: 0.35,
    riskyLossMultiplier: 1,
    crimeFineMultiplier: 1.22,
    optionalPrestigeSinkRate: 0.1,
    seasonXpPerSunkCoin: 1,
  },
  bank: {
    maxAnnualRatePercent: 40,
    maxCycleDurationMs: 72 * 60 * 60 * 1000,
  },
  enforcement: {
    awardEnvelopeClamps: true,
    longTermSinks: true,
  },
  guardrails: {
    maxTimeWizardReductionPercent: 0.45,
    minCrimeCooldownMs: 60 * 60 * 1000,
    maxCrimeSuccessChance: 0.49,
    maxCrimeStealPercent: 0.11,
    maxCrimeFineReduction: 0.22,
    towerVaultRefundPerLevel: 0.04,
    towerMaxVaultRefundReduction: 0.2,
  },
  perGameEnvelopes: {
    "2048": {
      coinsPerHour: { min: 45, target: 90, max: 160 },
      xpPerHour: { min: 70, target: 120, max: 220 },
      maxCoinAward: 80,
      maxXpAward: 140,
    },
    snake: {
      coinsPerHour: { min: 55, target: 105, max: 190 },
      xpPerHour: { min: 80, target: 130, max: 230 },
      maxCoinAward: 85,
      maxXpAward: 150,
    },
    coinflip: {
      coinsPerHour: { min: 60, target: 120, max: 210 },
      xpPerHour: { min: 60, target: 100, max: 190 },
      maxCoinAward: 90,
      maxXpAward: 100,
    },
    tower: {
      coinsPerHour: { min: 65, target: 130, max: 230 },
      xpPerHour: { min: 65, target: 115, max: 200 },
      maxCoinAward: 100,
      maxXpAward: 120,
    },
    rpg_clicker2: {
      coinsPerHour: { min: 40, target: 80, max: 140 },
      xpPerHour: { min: 55, target: 95, max: 180 },
      maxCoinAward: 75,
      maxXpAward: 100,
    },
  },
  fallbackGameEnvelope: {
    coinsPerHour: { min: 60, target: 120, max: 220 },
    xpPerHour: { min: 55, target: 100, max: 180 },
    maxCoinAward: 100,
    maxXpAward: 100,
  },
});

function normalizeGameId(gameId: string): string {
  return String(gameId || "")
    .trim()
    .toLowerCase();
}

export function getEconomyTuningConfig(): EconomyTuningConfig {
  return STABLE_ECONOMY_TUNING_CONFIG;
}

export function getGameEconomyEnvelope(gameId: string): GameEconomyEnvelope {
  const tuning = getEconomyTuningConfig();
  const normalizedGameId = normalizeGameId(gameId);

  return (
    tuning.perGameEnvelopes[gameId] ||
    tuning.perGameEnvelopes[normalizedGameId] ||
    tuning.fallbackGameEnvelope
  );
}
