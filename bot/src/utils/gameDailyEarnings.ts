import hubClient from "../api/hubClient.ts";

type GameAwardResult = {
  awardedAmount?: number;
  blockedAmount?: number;
  cap?: number;
  remainingToday?: number;
  earnedToday?: number;
};

async function awardGameCoins(
  guildId: string,
  userId: string,
  gameId: string,
  amount: number
): Promise<GameAwardResult> {
  const safeAmount = Math.max(0, Number(amount) || 0);

  if (!guildId || !userId || !gameId || safeAmount <= 0) {
    return {
      awardedAmount: 0,
      blockedAmount: safeAmount,
      cap: 0,
      remainingToday: 0,
      earnedToday: 0,
    };
  }

  const result = (await hubClient.awardGameDailyEarnings(
    guildId,
    userId,
    gameId,
    safeAmount
  )) as GameAwardResult;

  return {
    awardedAmount: Number(result?.awardedAmount || 0),
    blockedAmount: Number(result?.blockedAmount || 0),
    cap: Number(result?.cap || 0),
    remainingToday: Number(result?.remainingToday || 0),
    earnedToday: Number(result?.earnedToday || 0),
  };
}

function formatAwardedCoinsText(awardedAmount: number, blockedAmount: number): string {
  const awarded = Math.max(0, Number(awardedAmount || 0));
  const blocked = Math.max(0, Number(blockedAmount || 0));
  if (awarded <= 0 && blocked <= 0) {
    return "";
  }

  if (blocked <= 0) {
    return `+${awarded.toFixed(1)} 💵`;
  }

  return `+${awarded.toFixed(1)} 💵 (${blocked.toFixed(1)} capped today)`;
}

function formatGameRewardSummary(
  awardedAmount: number,
  blockedAmount: number,
  gameXpAmount: number
): string {
  const parts: string[] = [];
  const coinsText = formatAwardedCoinsText(awardedAmount, blockedAmount);
  const xp = Math.max(0, Number(gameXpAmount || 0));

  if (coinsText) {
    parts.push(coinsText);
  }

  if (xp > 0) {
    parts.push(`+${xp} Game XP`);
  }

  return parts.join(", ");
}

export { awardGameCoins, formatAwardedCoinsText, formatGameRewardSummary };
