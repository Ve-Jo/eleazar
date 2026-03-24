const SOFT_LIMIT_PAYOUT_FACTOR = 0.5;

const SOFT_LIMIT_HALF_RATE_GAMES = new Set(["2048", "snake"]);
const RISKY_HARD_LIMIT_GAMES = new Set(["coinflip", "tower"]);
const NO_DAILY_LIMIT_GAMES = new Set(["crypto2"]);

function normalizeGameId(gameId: string): string {
  return String(gameId || "")
    .trim()
    .toLowerCase();
}

function isSoftLimitHalfRateGame(gameId: string): boolean {
  return SOFT_LIMIT_HALF_RATE_GAMES.has(normalizeGameId(gameId));
}

function getSoftLimitPayoutFactor(gameId: string): number {
  return isSoftLimitHalfRateGame(gameId) ? SOFT_LIMIT_PAYOUT_FACTOR : 0;
}

function isRiskyHardLimitGame(gameId: string): boolean {
  return RISKY_HARD_LIMIT_GAMES.has(normalizeGameId(gameId));
}

function isNoDailyLimitGame(gameId: string): boolean {
  return NO_DAILY_LIMIT_GAMES.has(normalizeGameId(gameId));
}

export {
  SOFT_LIMIT_PAYOUT_FACTOR,
  normalizeGameId,
  isSoftLimitHalfRateGame,
  getSoftLimitPayoutFactor,
  isRiskyHardLimitGame,
  isNoDailyLimitGame,
};
