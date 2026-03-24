import { describe, expect, test } from "bun:test";
import { IdempotencyStore } from "./idempotencyStore.ts";

describe("IdempotencyStore", () => {
  test("returns stored value by key", () => {
    const store = new IdempotencyStore<string>(1000);
    store.set("abc", "done");

    expect(store.get("abc")).toBe("done");
  });

  test("expires value when TTL is exceeded", async () => {
    const store = new IdempotencyStore<string>(5);
    store.set("abc", "done");

    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(store.get("abc")).toBeNull();
  });
});
