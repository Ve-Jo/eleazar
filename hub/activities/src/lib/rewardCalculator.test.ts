import { describe, expect, test } from "bun:test";
import { compute2048SessionReward, MAX_2048_SESSION_EARNING } from "./rewardCalculator.ts";

describe("compute2048SessionReward", () => {
  test("computes reward with expected baseline multipliers", () => {
    const result = compute2048SessionReward({
      score: 1000,
      moves: 100,
      durationMs: 5 * 60 * 1000,
      gamesEarningLevel: 1,
    });

    expect(result.score).toBe(1000);
    expect(result.moves).toBe(100);
    expect(result.requestedEarning).toBe(20);
  });

  test("caps reward at MAX_2048_SESSION_EARNING", () => {
    const result = compute2048SessionReward({
      score: 1_000_000,
      moves: 10,
      durationMs: 10 * 60 * 1000,
      gamesEarningLevel: 20,
    });

    expect(result.requestedEarning).toBe(MAX_2048_SESSION_EARNING);
  });
});
