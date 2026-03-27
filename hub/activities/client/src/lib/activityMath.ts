import type { ActivityBalanceSnapshot } from "../../../../shared/src/contracts/hub.ts";

export type MoneyMoveDirection = "deposit" | "withdraw";
export type MoneyMoveMode = "fixed" | "percent";

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

export function clampNumber(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parsePositiveAmount(input: string): number {
  const normalized = input.replace(/,/g, ".").trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  return Number(numeric.toFixed(5));
}

export function getMoveSourceAvailable(
  balance: ActivityBalanceSnapshot,
  direction: MoneyMoveDirection
): number {
  return direction === "deposit" ? balance.walletBalance : balance.totalBankBalance;
}

export function resolveMoveAmount(
  balance: ActivityBalanceSnapshot,
  direction: MoneyMoveDirection,
  mode: MoneyMoveMode,
  rawAmount: number
): number {
  const sourceAvailable = getMoveSourceAvailable(balance, direction);

  if (mode === "percent") {
    return Number(
      (sourceAvailable * (clampNumber(0, rawAmount, 100) / 100)).toFixed(5)
    );
  }

  return Number(clampNumber(0, rawAmount, sourceAvailable).toFixed(5));
}

export function projectBankSnapshot(
  balance: ActivityBalanceSnapshot,
  now = Date.now()
): {
  projectedBankBalance: number;
  projectedTotalBankBalance: number;
  timeIntoCycleMs: number;
  cycleProgress: number;
  cycleComplete: boolean;
} {
  const start = Number(balance.cycleStartTime || 0);
  const annualRate = Number(balance.annualRate || 0);
  const maxInactiveMs = Math.max(0, Number(balance.maxInactiveMs || 0));

  if (!start || annualRate <= 0 || maxInactiveMs <= 0 || balance.bankBalance <= 0) {
    return {
      projectedBankBalance: balance.projectedBankBalance || balance.bankBalance,
      projectedTotalBankBalance:
        balance.projectedTotalBankBalance || balance.totalBankBalance,
      timeIntoCycleMs: Math.max(0, Number(balance.timeIntoCycleMs || 0)),
      cycleProgress: clampNumber(0, Number(balance.cycleProgress || 0), 1),
      cycleComplete: Boolean(balance.cycleComplete),
    };
  }

  const elapsedMs = Math.max(0, now - start);
  const boundedElapsedMs = Math.min(elapsedMs, maxInactiveMs);
  const projectedBankBalance =
    balance.bankBalance * (1 + annualRate * (boundedElapsedMs / MS_PER_YEAR));

  return {
    projectedBankBalance: Number(projectedBankBalance.toFixed(5)),
    projectedTotalBankBalance: Number(
      (projectedBankBalance + balance.bankDistributed).toFixed(5)
    ),
    timeIntoCycleMs: boundedElapsedMs,
    cycleProgress: maxInactiveMs > 0 ? clampNumber(0, boundedElapsedMs / maxInactiveMs, 1) : 0,
    cycleComplete: elapsedMs >= maxInactiveMs,
  };
}
