import { logger } from "../utils/logger.ts";
import { recordRateLimitHit } from "../middleware/metrics.ts";

type LimitConfig = {
  windowMs: number;
  maxRequests: number;
  windowStart: number;
  requests?: number;
};

class RateLimitService {
  limits: Map<string, LimitConfig>;
  requests: Map<string, number>;
  windows: Map<string, any>;
  cleanupInterval: ReturnType<typeof setInterval> | null;
  defaultWindowMs: number;
  defaultMaxRequests: number;
  cleanupIntervalMs: number;

  constructor() {
    this.limits = new Map();
    this.requests = new Map();
    this.windows = new Map();
    this.cleanupInterval = null;
    this.defaultWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000");
    this.defaultMaxRequests = parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || "10"
    );
    this.cleanupIntervalMs = 300000;
  }

  async initialize() {
    logger.info("Initializing rate limit service...");
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
    logger.info("Rate limit service initialized");
  }

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.limits.clear();
    this.requests.clear();
    this.windows.clear();

    logger.info("Rate limit service shut down");
  }

  setLimit(
    key: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    this.limits.set(key, {
      windowMs,
      maxRequests,
      windowStart: Date.now(),
    });

    logger.debug("Rate limit set", { key, windowMs, maxRequests });
  }

  async checkLimit(key: string, route = "unknown") {
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit) {
      return {
        allowed: true,
        remaining: this.defaultMaxRequests,
        reset: now + this.defaultWindowMs,
      };
    }

    const { windowMs, maxRequests, windowStart } = limit;
    const windowEnd = windowStart + windowMs;

    if (now >= windowEnd) {
      limit.windowStart = now;
      limit.requests = 0;
      this.requests.set(key, 0);
    }

    const currentRequests = this.requests.get(key) || 0;

    if (currentRequests >= maxRequests) {
      const resetTime = limit.windowStart + windowMs;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      recordRateLimitHit(route, key);

      logger.warn("Rate limit exceeded", {
        key,
        currentRequests,
        maxRequests,
        retryAfter,
        category: "rate_limit",
      });

      return {
        allowed: false,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      };
    }

    this.requests.set(key, currentRequests + 1);

    return {
      allowed: true,
      remaining: maxRequests - currentRequests - 1,
      reset: limit.windowStart + windowMs,
    };
  }

  async consume(key: string, route = "unknown") {
    const result = await this.checkLimit(key, route);

    if (!result.allowed) {
      return result;
    }

    const currentRequests = this.requests.get(key) || 0;
    this.requests.set(key, currentRequests + 1);

    return {
      ...result,
      remaining: result.remaining - 1,
    };
  }

  async getUsage(key: string) {
    const limit = this.limits.get(key);

    if (!limit) {
      return {
        current: 0,
        limit: this.defaultMaxRequests,
        windowMs: this.defaultWindowMs,
        windowStart: Date.now(),
      };
    }

    const currentRequests = this.requests.get(key) || 0;
    const now = Date.now();
    const windowEnd = limit.windowStart + limit.windowMs;

    if (now >= windowEnd) {
      return {
        current: 0,
        limit: limit.maxRequests,
        windowMs: limit.windowMs,
        windowStart: now,
      };
    }

    return {
      current: currentRequests,
      limit: limit.maxRequests,
      windowMs: limit.windowMs,
      windowStart: limit.windowStart,
    };
  }

  async resetLimit(key: string) {
    this.requests.delete(key);

    const limit = this.limits.get(key);
    if (limit) {
      limit.windowStart = Date.now();
    }

    logger.info("Rate limit reset", { key });
  }

  removeLimit(key: string) {
    this.limits.delete(key);
    this.requests.delete(key);
    this.windows.delete(key);

    logger.debug("Rate limit removed", { key });
  }

  setProviderLimit(
    provider: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `provider:${provider}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  setUserLimit(
    userId: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `user:${userId}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  setModelLimit(
    model: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `model:${model}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  async checkProviderLimit(provider: string, route = "unknown") {
    const key = `provider:${provider}`;
    return await this.checkLimit(key, route);
  }

  async checkUserLimit(userId: string, route = "unknown") {
    const key = `user:${userId}`;
    return await this.checkLimit(key, route);
  }

  async checkModelLimit(model: string, route = "unknown") {
    const key = `model:${model}`;
    return await this.checkLimit(key, route);
  }

  async consumeProviderLimit(provider: string, route = "unknown") {
    const key = `provider:${provider}`;
    return await this.consume(key, route);
  }

  async consumeUserLimit(userId: string, route = "unknown") {
    const key = `user:${userId}`;
    return await this.consume(key, route);
  }

  async consumeModelLimit(model: string, route = "unknown") {
    const key = `model:${model}`;
    return await this.consume(key, route);
  }

  getAllLimits() {
    const limits: Record<string, any> = {};

    for (const [key, config] of this.limits.entries()) {
      const usage: any = this.getUsage(key);
      limits[key] = {
        ...config,
        current: usage.current,
        remaining: config.maxRequests - usage.current,
      };
    }

    return limits;
  }

  getLimitsByType(type: string) {
    const limits: Record<string, any> = {};
    const prefix = `${type}:`;

    for (const [key, config] of this.limits.entries()) {
      if (key.startsWith(prefix)) {
        const id = key.substring(prefix.length);
        const usage: any = this.getUsage(key);
        limits[id] = {
          ...config,
          current: usage.current,
          remaining: config.maxRequests - usage.current,
        };
      }
    }

    return limits;
  }

  getProviderLimits() {
    return this.getLimitsByType("provider");
  }

  getUserLimits() {
    return this.getLimitsByType("user");
  }

  getModelLimits() {
    return this.getLimitsByType("model");
  }

  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, limit] of this.limits.entries()) {
      const windowEnd = limit.windowStart + limit.windowMs;
      if (now >= windowEnd + this.cleanupIntervalMs) {
        this.limits.delete(key);
        this.requests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Rate limit cleanup completed", { cleaned });
    }
  }

  getHealth() {
    const totalLimits = this.limits.size;
    const totalRequests = this.requests.size;

    return {
      status: "healthy",
      totalLimits,
      totalRequests,
      memoryUsage: {
        limits: totalLimits,
        requests: totalRequests,
      },
    };
  }

  async checkSlidingWindow(
    key: string,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const now = Date.now();
    const windowStart = now - windowMs;

    let windowData = this.windows.get(key);

    if (!windowData) {
      windowData = {
        requests: [],
        windowStart: now,
      };
      this.windows.set(key, windowData);
    }

    windowData.requests = windowData.requests.filter(
      (timestamp: number) => timestamp >= windowStart
    );

    if (windowData.requests.length >= maxRequests) {
      const oldestRequest = Math.min(...windowData.requests);
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);

      return {
        allowed: false,
        current: windowData.requests.length,
        limit: maxRequests,
        retryAfter,
      };
    }

    windowData.requests.push(now);

    return {
      allowed: true,
      current: windowData.requests.length,
      limit: maxRequests,
      remaining: maxRequests - windowData.requests.length,
    };
  }

  async checkTokenBucket(
    key: string,
    capacity: number,
    refillRate: number,
    refillPeriod = 1000
  ) {
    const now = Date.now();

    let bucket = this.windows.get(key);

    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
      };
      this.windows.set(key, bucket);
    }

    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / refillPeriod) * refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens--;
      return {
        allowed: true,
        tokens: bucket.tokens,
        capacity,
      };
    }

    return {
      allowed: false,
      tokens: bucket.tokens,
      capacity,
    };
  }
}

export { RateLimitService };
