export const MAX_2048_SESSION_EARNING = 2500;

export type RewardInput = {
  score: number;
  moves: number;
  durationMs: number;
  gamesEarningLevel?: number;
};

export type RewardBreakdown = {
  score: number;
  moves: number;
  durationMs: number;
  timeInMinutes: number;
  moveEfficiency: number;
  gamesEarningLevel: number;
  earningMultiplier: number;
  baseEarning: number;
  requestedEarning: number;
};

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function compute2048SessionReward(input: RewardInput): RewardBreakdown {
  const score = clamp(0, Number(input.score) || 0, 2_000_000);
  const moves = clamp(0, Number(input.moves) || 0, 200_000);
  const durationMs = clamp(0, Number(input.durationMs) || 0, 12 * 60 * 60 * 1000);

  const gamesEarningLevel = Math.max(1, Number(input.gamesEarningLevel || 1) || 1);
  const earningMultiplier = 1 + (gamesEarningLevel - 1) * 0.1;

  const timeInMinutes = durationMs / 60000;
  const moveEfficiency = score / Math.max(1, moves);

  const baseEarning =
    score *
    0.005 *
    (1 + moveEfficiency / 10) *
    (1 + Math.min(timeInMinutes, 5) / 5);

  const requestedEarning = clamp(0, baseEarning * earningMultiplier, MAX_2048_SESSION_EARNING);

  return {
    score,
    moves,
    durationMs,
    timeInMinutes,
    moveEfficiency,
    gamesEarningLevel,
    earningMultiplier,
    baseEarning,
    requestedEarning,
  };
}
