import { IdempotencyStore } from "../../lib/idempotencyStore.ts";
import { compute2048SessionReward } from "../../lib/rewardCalculator.ts";
import { asArray, asObject, clamp, getUpgradeLevel, toNumber } from "../lib/primitives.ts";
import { ensureGuildUser, fetchDatabase } from "./databaseGateway.ts";

const completionStore = new IdempotencyStore<Record<string, unknown>>();
setInterval(() => completionStore.cleanup(), 5 * 60 * 1000);

type CompleteActivity2048Options = {
  guildId: string;
  requestedDurationMs: number;
  requestedMoves: number;
  requestedScore: number;
  submissionId: string;
  userId: string;
};

export async function completeActivity2048Session({
  guildId,
  requestedDurationMs,
  requestedMoves,
  requestedScore,
  submissionId,
  userId,
}: CompleteActivity2048Options) {
  const score = clamp(0, requestedScore, 2_000_000);
  const moves = clamp(0, requestedMoves, 200_000);
  const durationMs = clamp(0, requestedDurationMs, 12 * 60 * 60 * 1000);

  const idempotencyKey = `2048:${guildId}:${userId}:${submissionId}`;
  const existing = completionStore.get(idempotencyKey);
  if (existing) {
    return {
      ...existing,
      idempotent: true,
    };
  }

  await ensureGuildUser(guildId, userId);
  const userResult = await fetchDatabase(`/users/${guildId}/${userId}`);
  const userData = asObject(userResult.data);
  const upgrades = asArray(userData.upgrades);
  const gamesEarningLevel = getUpgradeLevel(upgrades, "games_earning");

  const reward = compute2048SessionReward({
    score,
    moves,
    durationMs,
    gamesEarningLevel,
  });

  const gameXp = Math.max(0, Math.floor(score * 5));

  const highScoreResult = await fetchDatabase(`/games/records/update`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      guildId,
      gameId: "2048",
      score,
    }),
  });

  const xpResult =
    gameXp > 0
      ? await fetchDatabase(`/games/xp/add`, {
          method: "POST",
          body: JSON.stringify({
            userId,
            guildId,
            gameType: "2048",
            xp: gameXp,
          }),
        })
      : { ok: true, status: 200, data: null };

  const payoutResult =
    reward.requestedEarning > 0
      ? await fetchDatabase(`/games/earnings/award`, {
          method: "POST",
          body: JSON.stringify({
            userId,
            guildId,
            gameId: "2048",
            amount: reward.requestedEarning,
          }),
        })
      : { ok: true, status: 200, data: null };

  const dailyStatusResult = await fetchDatabase(`/games/earnings/${guildId}/${userId}/2048`);
  const balanceResult = await fetchDatabase(`/economy/balance/${guildId}/${userId}`);

  const payout = asObject(payoutResult.data);
  const highScoreData = asObject(highScoreResult.data);
  const xpData = asObject(xpResult.data);
  const balanceData = asObject(balanceResult.data);
  const totalBlockedAmount = Math.max(0, toNumber(payout?.blockedAmount));
  const capBlockedAmount = Math.max(0, toNumber(payout?.capBlockedAmount, totalBlockedAmount));
  const effectiveRequestedAmount = Math.max(
    0,
    toNumber(
      payout?.effectiveRequestedAmount,
      toNumber(payout?.requestedAmount, reward.requestedEarning)
    )
  );
  const visualAwardedAmount = Math.max(0, effectiveRequestedAmount - capBlockedAmount);

  const responsePayload = {
    idempotent: false,
    success: true,
    submissionId,
    gameId: "2048",
    userId,
    guildId,
    session: {
      score,
      moves,
      durationMs,
    },
    reward: {
      requestedEarning: Number(reward.requestedEarning.toFixed(4)),
      awardedAmount: toNumber(payout?.awardedAmount, 0),
      visualAwardedAmount,
      blockedAmount: capBlockedAmount,
      softLimitAwardAmount: toNumber(payout?.softLimitAwardAmount, 0),
      softLimitPayoutFactor: toNumber(payout?.softLimitPayoutFactor, 0),
      gameXp,
    },
    progression: {
      highScore: toNumber(highScoreData.highScore, score) || score,
      isNewRecord: Boolean(highScoreData.isNewRecord),
      levelUp: xpData.levelUp || null,
      type: xpData.type || null,
    },
    dailyStatus: dailyStatusResult.data || null,
    economy: {
      balance: toNumber(balanceData.balance, 0),
      totalBankBalance: toNumber(balanceData.totalBankBalance, 0),
    },
  };

  completionStore.set(idempotencyKey, responsePayload);
  return responsePayload;
}
