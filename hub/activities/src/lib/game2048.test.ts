import { describe, expect, test } from "bun:test";
import { applyMove, hasMovesAvailable } from "./game2048.ts";

describe("2048 move logic", () => {
  test("merges matching tiles once per move when moving left", () => {
    const start = [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];

    const result = applyMove(start, "left");
    expect(result.moved).toBe(true);
    expect(result.scoreGained).toBe(8);
    expect(result.board[0]).toEqual([4, 4, 0, 0]);
  });

  test("detects no available moves on a blocked board", () => {
    const blocked = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];

    expect(hasMovesAvailable(blocked)).toBe(false);
  });
});
