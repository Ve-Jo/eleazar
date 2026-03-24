import hubClient from "../api/hubClient.ts";
import { normalizeGameId } from "../../../hub/shared/src/gameDailyLimitPolicy.ts";

type GameAwardResult = {
  requestedAmount?: number;
  effectiveRequestedAmount?: number;
  awardedAmount?: number;
  grossAwardedAmount?: number;
  blockedAmount?: number;
  capBlockedAmount?: number;
  visualAwardedAmount?: number;
  cap?: number;
  remainingToday?: number;
  earnedToday?: number;
  softLimitPayoutFactor?: number;
  softLimitAwardAmount?: number;
};

async function awardGameCoins(
  guildId: string,
  userId: string,
  gameId: string,
  amount: number
): Promise<GameAwardResult> {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const normalizedGameId = normalizeGameId(gameId);

  if (!guildId || !userId || !normalizedGameId || safeAmount <= 0) {
    return {
      awardedAmount: 0,
      grossAwardedAmount: 0,
      blockedAmount: safeAmount,
      capBlockedAmount: safeAmount,
      cap: 0,
      remainingToday: 0,
      earnedToday: 0,
    };
  }

  const result = (await hubClient.awardGameDailyEarnings(
    guildId,
    userId,
    normalizedGameId,
    safeAmount
  )) as GameAwardResult;

  const totalBlockedAmount = Math.max(0, Number(result?.blockedAmount || 0));
  const capBlockedAmount = Math.max(
    0,
    Number(
      result?.capBlockedAmount !== undefined
        ? result?.capBlockedAmount
        : totalBlockedAmount
    )
  );
  const effectiveRequestedAmount = Math.max(
    0,
    Number(
      result?.effectiveRequestedAmount !== undefined
        ? result?.effectiveRequestedAmount
        : result?.requestedAmount !== undefined
          ? result?.requestedAmount
          : safeAmount
    )
  );
  const visualAwardedAmount = Math.max(
    0,
    effectiveRequestedAmount - capBlockedAmount
  );

  return {
    requestedAmount: Number(result?.requestedAmount || safeAmount),
    effectiveRequestedAmount,
    awardedAmount: Number(result?.awardedAmount || 0),
    visualAwardedAmount,
    grossAwardedAmount: Number(result?.grossAwardedAmount || 0),
    blockedAmount: capBlockedAmount,
    capBlockedAmount,
    cap: Number(result?.cap || 0),
    remainingToday: Number(result?.remainingToday || 0),
    earnedToday: Number(result?.earnedToday || 0),
    softLimitPayoutFactor: Number(result?.softLimitPayoutFactor || 0),
    softLimitAwardAmount: Number(result?.softLimitAwardAmount || 0),
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
  gameXpAmount: number,
  options: {
    softLimitAwardAmount?: number;
    softLimitPayoutFactor?: number;
  } = {}
): string {
  const parts: string[] = [];
  const coinsText = formatAwardedCoinsText(awardedAmount, blockedAmount);
  const xp = Math.max(0, Number(gameXpAmount || 0));
  const softLimitAwardAmount = Math.max(
    0,
    Number(options.softLimitAwardAmount || 0)
  );
  const softLimitPayoutFactor = Math.max(
    0,
    Math.min(1, Number(options.softLimitPayoutFactor || 0))
  );

  if (coinsText) {
    parts.push(coinsText);
  }

  if (softLimitAwardAmount > 0 && softLimitPayoutFactor > 0) {
    parts.push(
      `daily cap reached: overflow paid at ${(softLimitPayoutFactor * 100).toFixed(0)}%`
    );
  }

  if (xp > 0) {
    parts.push(`+${xp} Game XP`);
  }

  return parts.join(", ");
}

export { awardGameCoins, formatAwardedCoinsText, formatGameRewardSummary };
