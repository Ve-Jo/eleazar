import { COOLDOWNS, CRATE_TYPES, UPGRADES } from "../hub/shared/src/domain.ts";
import { getEconomyTuningConfig } from "../hub/shared/src/economyTuning.ts";

type CoinsProfile = {
  name: string;
  coinsPerDay: number;
};

type CliArgs = Record<string, string>;

type MonteCarloSummary = {
  mean: number;
  median: number;
  p10: number;
  p90: number;
  min: number;
  max: number;
  negativeRate: number;
  zeroRate: number;
};

type TowerDifficulty = "easy" | "medium" | "hard";

type CoinflipRoundResult = {
  net: number;
  xp: number;
};

type TowerRunResult = {
  net: number;
  xp: number;
  won: boolean;
  floorsCleared: number;
};

const GAME_DAILY_CAPS: Record<string, number> = {
  "2048": 180,
  snake: 160,
  tower: 250,
  coinflip: 300,
  rpg_clicker2: 140,
};

const TOWER_TILE_COUNTS: Record<TowerDifficulty, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

const TOWER_BOMB_COUNTS: Record<TowerDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 4,
};

const TOWER_BASE_MULTIPLIERS: Record<TowerDifficulty, number[]> = {
  easy: [1.46, 2.18, 3.28, 4.91, 7.37, 11.06, 16.59, 24.88, 37.32, 55.98],
  medium: [
    1.92, 3.84, 7.68, 15.36, 30.72, 61.44, 122.88, 245.76, 491.52, 983.04,
  ],
  hard: [
    4.75, 22.56, 107.17, 509.06, 2418.05, 11485.74, 54557.26, 259146.99,
    1230948.2, 5847003.95,
  ],
};

const MAX_TOWER_PAYOUT_ABSOLUTE = 50_000;
const MAX_TOWER_PAYOUT_MULTIPLIER = 50;
const COINFLIP_HOUSE_EDGE_FACTOR = 0.95;

function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (const token of argv) {
    if (!token.startsWith("--")) {
      continue;
    }

    const trimmed = token.slice(2);
    const [key, rawValue] = trimmed.split("=");
    if (!key) {
      continue;
    }

    args[key] = rawValue ?? "true";
  }
  return args;
}

function getNumberArg(
  args: CliArgs,
  key: string,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  const raw = Number(args[key]);
  const value = Number.isFinite(raw) ? raw : fallback;
  const min = options.min ?? -Infinity;
  const max = options.max ?? Infinity;
  return Math.max(min, Math.min(max, value));
}

function getIntegerArg(
  args: CliArgs,
  key: string,
  fallback: number,
  options: { min?: number; max?: number } = {}
): number {
  return Math.floor(getNumberArg(args, key, fallback, options));
}

function getBooleanArg(args: CliArgs, key: string, fallback: boolean): boolean {
  const raw = args[key];
  if (raw === undefined) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function getStringArg(args: CliArgs, key: string, fallback: string): string {
  const raw = args[key];
  return raw && raw.length > 0 ? raw : fallback;
}

function normalizeTowerDifficulty(raw: string): TowerDifficulty {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "medium" || normalized === "hard") {
    return normalized;
  }
  return "easy";
}

function getProfiles(): CoinsProfile[] {
  const tuning = getEconomyTuningConfig();
  return [
    { name: "early", coinsPerDay: tuning.targets.early.coinsPerDay.target },
    { name: "mid", coinsPerDay: tuning.targets.mid.coinsPerDay.target },
    { name: "high", coinsPerDay: tuning.targets.high.coinsPerDay.target },
  ];
}

function getGamesEarningMultiplier(level: number): number {
  return 1 + Math.max(0, level - 1) * Number(UPGRADES.games_earning.effectMultiplier || 0);
}

function getTotalGameDailyCap(level: number): number {
  const tuning = getEconomyTuningConfig();
  const faucetScale = Math.max(0.2, Number(tuning.faucets.gameDailyCapMultiplier || 1));
  const gamesEarningMultiplier = getGamesEarningMultiplier(level);

  return Object.values(GAME_DAILY_CAPS).reduce((total, rawCap) => {
    const baseCap = Math.max(1, Math.floor(rawCap * faucetScale));
    const effectiveCap = Math.max(baseCap, Math.floor(baseCap * gamesEarningMultiplier));
    return total + effectiveCap;
  }, 0);
}

function getCrateExpectedCoinsPerDay(dailyBonusLevel: number, streak: number): number {
  const tuning = getEconomyTuningConfig();
  const dailyConfig = CRATE_TYPES.daily.rewards;
  const weeklyConfig = CRATE_TYPES.weekly.rewards;
  const streakMultiplier = 1 + Math.min(Math.max(0, streak - 1) * 0.05, 0.5);
  const dailyBonusMultiplier =
    1 + Math.max(0, dailyBonusLevel - 1) * Number(UPGRADES.daily_bonus.effectMultiplier || 0);
  const coinMultiplier =
    streakMultiplier *
    dailyBonusMultiplier *
    Math.max(0.05, Number(tuning.faucets.crateCoinMultiplier || 1));

  const dailyMin = Math.max(1, Math.floor(dailyConfig.min_coins * coinMultiplier));
  const dailyMax = Math.max(dailyMin, Math.floor(dailyConfig.max_coins * coinMultiplier));
  const weeklyMin = Math.max(1, Math.floor(weeklyConfig.min_coins * coinMultiplier));
  const weeklyMax = Math.max(weeklyMin, Math.floor(weeklyConfig.max_coins * coinMultiplier));
  const dailyExpected = (dailyMin + dailyMax) / 2;
  const weeklyExpected = (weeklyMin + weeklyMax) / 2;

  return dailyExpected + weeklyExpected / 7;
}

function upgradeTierPrice(
  upgradeKey: keyof typeof UPGRADES,
  purchaseTierLevel: number
): number {
  const tuning = getEconomyTuningConfig();
  const upgrade = UPGRADES[upgradeKey];
  const basePrice = Math.floor(
    upgrade.basePrice * Math.pow(upgrade.priceMultiplier, purchaseTierLevel - 1)
  );
  return Math.max(
    1,
    Math.floor(basePrice * Math.max(0.5, Number(tuning.sinks.upgradePriceMultiplier || 1)))
  );
}

function totalUpgradeCostToLevel(
  upgradeKey: keyof typeof UPGRADES,
  targetLevel: number
): number {
  let total = 0;
  for (let purchaseTierLevel = 1; purchaseTierLevel <= targetLevel - 1; purchaseTierLevel += 1) {
    total += upgradeTierPrice(upgradeKey, purchaseTierLevel);
  }
  return total;
}

function getCrimeAttemptExpectation(
  crimeMasteryLevel: number,
  robberBalance = 1000,
  targetBalance = 1000,
  targetVaultGuardLevel = 1
): {
  successChance: number;
  cooldownMs: number;
  expectedSteal: number;
  expectedFine: number;
  expectedNetPerAttempt: number;
  expectedNetPerDay: number;
} {
  const tuning = getEconomyTuningConfig();

  const successChance = Math.min(
    tuning.guardrails.maxCrimeSuccessChance,
    0.3 + Math.max(0, crimeMasteryLevel - 1) * Number(UPGRADES.crime_mastery.effectSuccess || 0)
  );
  const targetShieldReduction = Math.min(
    0.35,
    Math.max(0, targetVaultGuardLevel - 1) * Number(UPGRADES.vault_guard.effectMultiplier || 0)
  );
  const baseMaxStealPercent = Math.min(
    tuning.guardrails.maxCrimeStealPercent,
    0.08 + Math.max(0, crimeMasteryLevel - 1) * 0.01
  );
  const maxStealPercent = Math.max(0.02, baseMaxStealPercent * (1 - targetShieldReduction));

  const expectedSteal =
    targetBalance *
    ((0.01 + maxStealPercent) / 2) *
    Math.max(0.1, Number(tuning.faucets.crimeStealMultiplier || 1));

  const fineReduction = Math.min(
    tuning.guardrails.maxCrimeFineReduction,
    Math.max(0, crimeMasteryLevel - 1) * Number(UPGRADES.crime_mastery.effectMultiplier || 0)
  );
  const expectedFine =
    robberBalance *
    (0.04 * (1 - fineReduction) * Math.max(0.5, Number(tuning.sinks.crimeFineMultiplier || 1)));

  const expectedNetPerAttempt =
    successChance * expectedSteal - (1 - successChance) * expectedFine;

  const baseCrimeCooldown = Number(COOLDOWNS.crime || 2 * 60 * 60 * 1000);
  const minCrimeCooldown = Math.max(
    5 * 60 * 1000,
    Number(tuning.guardrails.minCrimeCooldownMs || 60 * 60 * 1000)
  );
  const maxReduction = Math.max(0, baseCrimeCooldown - minCrimeCooldown);
  const reduction = Math.min(
    maxReduction,
    Math.max(0, crimeMasteryLevel - 1) * Number(UPGRADES.crime_mastery.effectValue || 0)
  );
  const cooldownMs = Math.max(minCrimeCooldown, baseCrimeCooldown - reduction);

  const attemptsPerDay = Math.max(1, Math.floor((24 * 60 * 60 * 1000) / cooldownMs));
  const expectedNetPerDay = expectedNetPerAttempt * attemptsPerDay;

  return {
    successChance,
    cooldownMs,
    expectedSteal,
    expectedFine,
    expectedNetPerAttempt,
    expectedNetPerDay,
  };
}

function getBankRateAnnualPercent(level: number): number {
  const tuning = getEconomyTuningConfig();
  const rawRate =
    0.01 +
    Math.max(0, level - 1) * 0.01 +
    Math.max(0, level - 1) * 0.01 +
    Math.max(0, level - 1) * 0.005;
  const scaledRate = rawRate * Math.max(0.1, Number(tuning.faucets.bankInterestRateMultiplier || 1));
  const maxAnnual = Math.max(0.01, Number(tuning.bank.maxAnnualRatePercent || 50) / 100);
  return Math.min(0.5, maxAnnual, scaledRate) * 100;
}

function getBankOperationFeePercent(vaultGuardLevel: number): number {
  const tuning = getEconomyTuningConfig();
  const feeReduction = Math.min(
    0.5,
    Math.max(0, vaultGuardLevel - 1) * Number(UPGRADES.vault_guard.effectFees || 0)
  );
  const baseFeeRate = Math.min(
    0.3,
    Math.max(0.005, 0.05 * Number(tuning.sinks.bankFeeMultiplier || 1))
  );
  return baseFeeRate * (1 - feeReduction) * 100;
}

function getGameEnvelope(gameId: string): { maxCoinAward: number; maxXpAward: number } {
  const tuning = getEconomyTuningConfig();
  const normalizedGameId = gameId.toLowerCase();
  return (
    tuning.perGameEnvelopes[gameId] ||
    tuning.perGameEnvelopes[normalizedGameId] ||
    tuning.fallbackGameEnvelope
  );
}

function applyGameCoinAward(gameId: string, requestedAmount: number): number {
  const tuning = getEconomyTuningConfig();
  const envelope = getGameEnvelope(gameId);
  const requested = Math.max(0, Number(requestedAmount || 0));
  const clampedRequest = tuning.enforcement.awardEnvelopeClamps
    ? Math.min(requested, envelope.maxCoinAward)
    : requested;
  const tunedAward = clampedRequest * Math.max(0, Number(tuning.faucets.gameCoinMultiplier || 1));
  const seasonalSinkRate =
    tuning.enforcement.longTermSinks === true
      ? Math.max(0, Number(tuning.sinks.optionalPrestigeSinkRate || 0))
      : 0;
  const walletAward = tunedAward * (1 - seasonalSinkRate);
  return Math.max(0, walletAward);
}

function applyGameXpAward(gameId: string, requestedXp: number): number {
  const tuning = getEconomyTuningConfig();
  const envelope = getGameEnvelope(gameId);
  const tuned = Math.max(0, Math.floor(requestedXp * Math.max(0, Number(tuning.faucets.gameXpMultiplier || 1))));
  return tuning.enforcement.awardEnvelopeClamps ? Math.min(tuned, envelope.maxXpAward) : tuned;
}

function getCoinflipVaultReduction(vaultGuardLevel: number): number {
  return Math.min(0.4, Math.max(0, vaultGuardLevel - 1) * 0.08);
}

function getTowerVaultRefundReduction(vaultGuardLevel: number): number {
  const tuning = getEconomyTuningConfig();
  return Math.min(
    Math.max(0, Number(tuning.guardrails.towerMaxVaultRefundReduction || 0.2)),
    Math.max(0, vaultGuardLevel - 1) * Math.max(0, Number(tuning.guardrails.towerVaultRefundPerLevel || 0.04))
  );
}

function calculateRiskyGameXp(
  riskedAmount: number,
  netChange: number,
  difficulty: TowerDifficulty | null = null,
  floorsCleared = 0
): number {
  if (riskedAmount < 10) {
    return 0;
  }

  const difficultyMultiplier =
    difficulty === "medium" ? 1.15 : difficulty === "hard" ? 1.3 : 1;
  const rawXp = (riskedAmount * 0.03 + Math.abs(netChange) * 0.015 + Math.max(0, floorsCleared) * 2) * difficultyMultiplier;
  const roundedXp = Math.floor(rawXp);
  const bounded = Math.max(0, Math.min(60, roundedXp));
  return bounded > 0 ? bounded : 0;
}

function summarize(values: number[]): MonteCarloSummary {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      p10: 0,
      p90: 0,
      min: 0,
      max: 0,
      negativeRate: 0,
      zeroRate: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const pick = (percentile: number): number => {
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(percentile * (sorted.length - 1))));
    return sorted[idx] || 0;
  };
  const sum = values.reduce((acc, value) => acc + value, 0);
  const negatives = values.filter((value) => value < 0).length;
  const zeros = values.filter((value) => value === 0).length;

  return {
    mean: sum / values.length,
    median: pick(0.5),
    p10: pick(0.1),
    p90: pick(0.9),
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    negativeRate: negatives / values.length,
    zeroRate: zeros / values.length,
  };
}

function simulateCoinflipRound(
  bet: number,
  winProbability: number,
  vaultGuardLevel: number
): CoinflipRoundResult {
  const tuning = getEconomyTuningConfig();
  const vaultReduction = getCoinflipVaultReduction(vaultGuardLevel);
  const win = Math.random() < winProbability;

  let net = 0;
  if (win) {
    const profitMultiplier = Math.max(0, (1 / winProbability) * COINFLIP_HOUSE_EDGE_FACTOR - 1);
    const gross = bet * profitMultiplier;
    net = applyGameCoinAward("coinflip", gross);
  } else {
    const riskyLossMultiplier = Math.max(0.5, Number(tuning.sinks.riskyLossMultiplier || 1));
    const loss = bet * (1 - vaultReduction) * riskyLossMultiplier;
    net = -loss;
  }

  const requestedXp = calculateRiskyGameXp(bet, net, null, 0);
  const awardedXp = applyGameXpAward("coinflip", requestedXp);

  return { net, xp: awardedXp };
}

function calculateTowerPrize(
  difficulty: TowerDifficulty,
  bet: number,
  completedFloorIndex: number
): number {
  const multipliers = TOWER_BASE_MULTIPLIERS[difficulty];
  const multiplier =
    multipliers[completedFloorIndex] ??
    multipliers[multipliers.length - 1] ??
    0;
  const rawPrize = bet * multiplier;
  const cappedPrize = Math.min(
    rawPrize,
    bet * MAX_TOWER_PAYOUT_MULTIPLIER,
    MAX_TOWER_PAYOUT_ABSOLUTE
  );
  return Number(cappedPrize.toFixed(2));
}

function simulateTowerRun(
  difficulty: TowerDifficulty,
  bet: number,
  cashoutFloor: number,
  vaultGuardLevel: number
): TowerRunResult {
  const tuning = getEconomyTuningConfig();
  const normalizedCashoutFloor = Math.max(1, Math.min(10, Math.floor(cashoutFloor)));
  const tileCount = TOWER_TILE_COUNTS[difficulty];
  const bombCount = TOWER_BOMB_COUNTS[difficulty];
  const safeProbability = Math.max(0, (tileCount - bombCount) / tileCount);

  let currentFloor = 0;
  while (currentFloor < normalizedCashoutFloor) {
    const safe = Math.random() < safeProbability;
    if (!safe) {
      const riskyLossMultiplier = Math.max(0.5, Number(tuning.sinks.riskyLossMultiplier || 1));
      const refund = bet * getTowerVaultRefundReduction(vaultGuardLevel) / riskyLossMultiplier;
      const net = -bet + refund;
      const requestedXp = calculateRiskyGameXp(bet, net, difficulty, currentFloor);
      const xp = applyGameXpAward("tower", requestedXp);
      return { net, xp, won: false, floorsCleared: currentFloor };
    }

    currentFloor += 1;
    if (currentFloor >= 10) {
      break;
    }
  }

  const prizeGross = calculateTowerPrize(difficulty, bet, currentFloor - 1);
  const payout = applyGameCoinAward("tower", prizeGross);
  const net = -bet + payout;
  const requestedXp = calculateRiskyGameXp(bet, net, difficulty, currentFloor);
  const xp = applyGameXpAward("tower", requestedXp);
  return { net, xp, won: true, floorsCleared: currentFloor };
}

function logUpgradeTimelines() {
  const profiles = getProfiles();
  const upgradeKeys = Object.keys(UPGRADES) as Array<keyof typeof UPGRADES>;

  console.log("=== Upgrade Cost Timelines ===");
  for (const upgradeKey of upgradeKeys) {
    const costToL5 = totalUpgradeCostToLevel(upgradeKey, 5);
    const costToL10 = totalUpgradeCostToLevel(upgradeKey, 10);
    const profileText = profiles
      .map((profile) => `${profile.name}: L5 ${round(costToL5 / profile.coinsPerDay, 1)}d, L10 ${round(costToL10 / profile.coinsPerDay, 1)}d`)
      .join(" | ");
    console.log(`${upgradeKey} -> toL5 ${costToL5} | toL10 ${costToL10} | ${profileText}`);
  }

  const totalToL10 = upgradeKeys.reduce(
    (sum, upgradeKey) => sum + totalUpgradeCostToLevel(upgradeKey, 10),
    0
  );
  console.log(`All upgrades to L10: ${totalToL10}`);
  for (const profile of profiles) {
    console.log(
      `  ${profile.name}: ${round(totalToL10 / profile.coinsPerDay, 1)} days at ${profile.coinsPerDay}/day`
    );
  }
}

function logFaucetSnapshots(streakDays: number) {
  const tuning = getEconomyTuningConfig();
  const gameMultiplier = Math.max(0, Number(tuning.faucets.gameCoinMultiplier || 1));
  const sinkRate =
    tuning.enforcement.longTermSinks === true
      ? Math.max(0, Number(tuning.sinks.optionalPrestigeSinkRate || 0))
      : 0;
  console.log("\n=== Faucet Snapshots ===");
  for (const level of [1, 3, 5, 7, 10]) {
    const grossCap = getTotalGameDailyCap(level);
    const walletAfterTuningAndSink = grossCap * gameMultiplier * (1 - sinkRate);
    console.log(
      `games_earning L${level}: gross cap ${grossCap}/day | wallet after tuning+sinks ${round(
        walletAfterTuningAndSink,
        1
      )}/day`
    );
  }

  for (const dailyBonusLevel of [1, 3, 5, 10]) {
    const expected = getCrateExpectedCoinsPerDay(dailyBonusLevel, streakDays);
    console.log(
      `daily_bonus L${dailyBonusLevel} with ${streakDays}-day streak: crate EV ${round(expected, 1)} coins/day`
    );
  }
}

function logCrimeSnapshots(
  robberBalance: number,
  targetBalance: number,
  targetVaultGuardLevel: number
) {
  console.log("\n=== Crime EV Snapshots ===");
  console.log(
    `assumptions: robber=${robberBalance}, target=${targetBalance}, targetVaultGuard=${targetVaultGuardLevel}`
  );
  for (const level of [1, 2, 3, 4, 5, 6, 8, 10]) {
    const stats = getCrimeAttemptExpectation(
      level,
      robberBalance,
      targetBalance,
      targetVaultGuardLevel
    );
    console.log(
      `L${level}: p=${round(stats.successChance * 100, 1)}% | cd=${round(
        stats.cooldownMs / 60000,
        0
      )}m | EV/attempt=${round(stats.expectedNetPerAttempt, 2)} | EV/day=${round(
        stats.expectedNetPerDay,
        1
      )}`
    );
  }
}

function logBankSnapshots() {
  const principal = 10_000;
  console.log("\n=== Bank Snapshot ===");
  for (const level of [1, 5, 10, 15, 20]) {
    const annualPercent = getBankRateAnnualPercent(level);
    console.log(
      `activity level ${level}/${level}/${level}: annual ${round(
        annualPercent,
        3
      )}% | daily ${round(annualPercent / 365, 4)}%`
    );
  }

  for (const vaultGuardLevel of [1, 5, 10, 20]) {
    const opFeePercent = getBankOperationFeePercent(vaultGuardLevel);
    const roundTripFee = (opFeePercent * 2 * principal) / 100;
    const dailyYieldAtL10 = (principal * (getBankRateAnnualPercent(10) / 100)) / 365;
    const breakEvenDays = dailyYieldAtL10 > 0 ? roundTripFee / dailyYieldAtL10 : Infinity;
    console.log(
      `vault_guard L${vaultGuardLevel}: fee/op ${round(opFeePercent, 3)}% | round-trip ${round(
        opFeePercent * 2,
        3
      )}% | L10 break-even ${round(breakEvenDays, 1)}d`
    );
  }
}

function logCoinflipMonteCarlo(
  bet: number,
  winProbability: number,
  rounds: number,
  vaultGuardLevel: number
) {
  const nets: number[] = [];
  const xps: number[] = [];

  for (let i = 0; i < rounds; i += 1) {
    const result = simulateCoinflipRound(bet, winProbability, vaultGuardLevel);
    nets.push(result.net);
    xps.push(result.xp);
  }

  const netSummary = summarize(nets);
  const xpSummary = summarize(xps);

  console.log("\n=== Monte Carlo: Coinflip ===");
  console.log(
    `params: bet=${bet}, p=${winProbability}, rounds=${rounds}, vaultGuard=${vaultGuardLevel}`
  );
  console.log(
    `net: mean=${round(netSummary.mean, 3)} median=${round(
      netSummary.median,
      3
    )} p10=${round(netSummary.p10, 3)} p90=${round(netSummary.p90, 3)} negRate=${round(
      netSummary.negativeRate * 100,
      1
    )}%`
  );
  console.log(
    `xp: mean=${round(xpSummary.mean, 3)} median=${round(xpSummary.median, 3)}`
  );
}

function logTowerMonteCarlo(
  difficulty: TowerDifficulty,
  bet: number,
  cashoutFloor: number,
  rounds: number,
  vaultGuardLevel: number
) {
  const nets: number[] = [];
  const xps: number[] = [];
  const floorTotals: number[] = [];
  let wins = 0;

  for (let i = 0; i < rounds; i += 1) {
    const result = simulateTowerRun(difficulty, bet, cashoutFloor, vaultGuardLevel);
    nets.push(result.net);
    xps.push(result.xp);
    floorTotals.push(result.floorsCleared);
    if (result.won) {
      wins += 1;
    }
  }

  const netSummary = summarize(nets);
  const xpSummary = summarize(xps);
  const floorSummary = summarize(floorTotals);

  console.log("\n=== Monte Carlo: Tower ===");
  console.log(
    `params: difficulty=${difficulty}, bet=${bet}, cashoutFloor=${cashoutFloor}, rounds=${rounds}, vaultGuard=${vaultGuardLevel}`
  );
  console.log(
    `net: mean=${round(netSummary.mean, 3)} median=${round(
      netSummary.median,
      3
    )} p10=${round(netSummary.p10, 3)} p90=${round(netSummary.p90, 3)} negRate=${round(
      netSummary.negativeRate * 100,
      1
    )}%`
  );
  console.log(
    `xp: mean=${round(xpSummary.mean, 3)} median=${round(xpSummary.median, 3)}`
  );
  console.log(
    `wins=${round((wins / rounds) * 100, 2)}% | average floors=${round(
      floorSummary.mean,
      2
    )}`
  );
}

function run() {
  const args = parseCliArgs(process.argv.slice(2));
  const tuning = getEconomyTuningConfig();

  const streakDays = getIntegerArg(args, "streak-days", 7, { min: 1, max: 14 });
  const robberBalance = getNumberArg(args, "crime-robber-balance", 1000, { min: 1 });
  const targetBalance = getNumberArg(args, "crime-target-balance", 1000, { min: 1 });
  const targetVaultGuardLevel = getIntegerArg(args, "crime-target-vault-guard", 1, {
    min: 1,
    max: 100,
  });

  const runMonteCarlo = !getBooleanArg(args, "skip-monte-carlo", false);
  const coinflipBet = getNumberArg(args, "coinflip-bet", 50, { min: 1 });
  const coinflipProb = getNumberArg(args, "coinflip-prob", 0.5, { min: 0.01, max: 0.99 });
  const coinflipRounds = getIntegerArg(args, "coinflip-rounds", 20_000, {
    min: 1_000,
    max: 200_000,
  });
  const coinflipVaultGuardLevel = getIntegerArg(args, "coinflip-vault-guard", 1, {
    min: 1,
    max: 100,
  });

  const towerBet = getNumberArg(args, "tower-bet", 50, { min: 1 });
  const towerDifficulty = normalizeTowerDifficulty(
    getStringArg(args, "tower-difficulty", "easy")
  );
  const towerCashoutFloor = getIntegerArg(args, "tower-cashout-floor", 1, {
    min: 1,
    max: 10,
  });
  const towerRounds = getIntegerArg(args, "tower-rounds", 20_000, {
    min: 1_000,
    max: 200_000,
  });
  const towerVaultGuardLevel = getIntegerArg(args, "tower-vault-guard", 1, {
    min: 1,
    max: 100,
  });

  console.log(`Economy simulator using tuning version: ${tuning.version}`);
  logUpgradeTimelines();
  logFaucetSnapshots(streakDays);
  logCrimeSnapshots(robberBalance, targetBalance, targetVaultGuardLevel);
  logBankSnapshots();

  if (runMonteCarlo) {
    logCoinflipMonteCarlo(
      coinflipBet,
      coinflipProb,
      coinflipRounds,
      coinflipVaultGuardLevel
    );
    logTowerMonteCarlo(
      towerDifficulty,
      towerBet,
      towerCashoutFloor,
      towerRounds,
      towerVaultGuardLevel
    );
  }
}

run();
