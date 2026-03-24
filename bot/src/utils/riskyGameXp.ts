type RiskyDifficulty = "easy" | "medium" | "hard";

type RiskyGameXpInput = {
  riskedAmount: number;
  netChange: number;
  difficulty?: RiskyDifficulty | null;
  floorsCleared?: number;
};

const MIN_RISK_FOR_XP = 10;
const MAX_XP_PER_EVENT = 60;

const DIFFICULTY_MULTIPLIER: Record<RiskyDifficulty, number> = {
  easy: 1,
  medium: 1.15,
  hard: 1.3,
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateRiskyGameXp(input: RiskyGameXpInput): number {
  const riskedAmount = Math.max(0, Number(input.riskedAmount) || 0);
  if (riskedAmount < MIN_RISK_FOR_XP) {
    return 0;
  }

  const netChangeAbs = Math.abs(Number(input.netChange) || 0);
  const floorsCleared = Math.max(0, Math.floor(Number(input.floorsCleared) || 0));
  const difficultyMultiplier = input.difficulty
    ? DIFFICULTY_MULTIPLIER[input.difficulty]
    : 1;

  // Blended progression: risk exposure, result volatility, and optional tower floor progression.
  const rawXp = (riskedAmount * 0.03 + netChangeAbs * 0.015 + floorsCleared * 2) * difficultyMultiplier;
  const roundedXp = Math.floor(rawXp);
  if (roundedXp <= 0) {
    return 0;
  }

  return clamp(1, roundedXp, MAX_XP_PER_EVENT);
}

export { calculateRiskyGameXp };
