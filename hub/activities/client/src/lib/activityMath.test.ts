import { describe, expect, test } from "bun:test";

import {
  parsePositiveAmount,
  projectBankSnapshot,
  resolveMoveAmount,
} from "./activityMath.ts";

const baseBalance = {
  walletBalance: 200,
  bankBalance: 100,
  bankDistributed: 20,
  totalBankBalance: 120,
  projectedBankBalance: 100,
  projectedTotalBankBalance: 120,
  annualRate: 0.24,
  annualRatePercent: 24,
  cycleStartTime: 0,
  maxInactiveMs: 0,
  timeIntoCycleMs: 0,
  cycleProgress: 0,
  cycleComplete: false,
  upgradeDiscount: 0,
  updatedAt: 0,
};

describe("activity money helpers", () => {
  test("parses positive numeric input safely", () => {
    expect(parsePositiveAmount("12.5")).toBe(12.5);
    expect(parsePositiveAmount("0")).toBe(0);
    expect(parsePositiveAmount("abc")).toBe(0);
  });

  test("resolves percentage moves against the correct source balance", () => {
    expect(resolveMoveAmount(baseBalance, "deposit", "percent", 50)).toBe(100);
    expect(resolveMoveAmount(baseBalance, "withdraw", "percent", 50)).toBe(60);
  });

  test("projects bank growth using simple annual-rate math within the cycle cap", () => {
    const projection = projectBankSnapshot(
      {
        ...baseBalance,
        cycleStartTime: 1_000,
        maxInactiveMs: 60_000,
      },
      31_000
    );

    expect(projection.timeIntoCycleMs).toBe(30_000);
    expect(projection.cycleProgress).toBeCloseTo(0.5, 5);
    expect(projection.projectedBankBalance).toBeGreaterThan(100);
    expect(projection.projectedTotalBankBalance).toBeGreaterThan(120);
  });
});
