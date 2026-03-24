export class IdempotencyStore<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs = 24 * 60 * 60 * 1000) {}

  get(key: string): T | null {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }

    if (item.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.store.entries()) {
      if (item.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  size(): number {
    return this.store.size;
  }
}
