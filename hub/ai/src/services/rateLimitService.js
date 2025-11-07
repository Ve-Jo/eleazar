import { logger } from "../utils/logger.js";
import { recordRateLimitHit } from "../middleware/metrics.js";

class RateLimitService {
  constructor() {
    this.limits = new Map(); // Store rate limits in memory for now
    this.requests = new Map(); // Track requests per key
    this.windows = new Map(); // Track time windows
    this.cleanupInterval = null;
    this.defaultWindowMs = parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || "60000"
    );
    this.defaultMaxRequests = parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || "10"
    );
    this.cleanupIntervalMs = 300000; // 5 minutes
  }

  async initialize() {
    logger.info("Initializing rate limit service...");

    // Start cleanup interval
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

  // Set rate limit for a specific key
  setLimit(
    key,
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

  // Check if request is allowed
  async checkLimit(key, route = "unknown") {
    const now = Date.now();
    const limit = this.limits.get(key);

    if (!limit) {
      // No limit set, allow request
      return {
        allowed: true,
        remaining: this.defaultMaxRequests,
        reset: now + this.defaultWindowMs,
      };
    }

    const { windowMs, maxRequests, windowStart } = limit;
    const windowEnd = windowStart + windowMs;

    // Check if we're in a new window
    if (now >= windowEnd) {
      // Reset window
      limit.windowStart = now;
      limit.requests = 0;
      this.requests.set(key, 0);
    }

    // Get current request count
    const currentRequests = this.requests.get(key) || 0;

    if (currentRequests >= maxRequests) {
      // Rate limit exceeded
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

    // Allow request
    this.requests.set(key, currentRequests + 1);

    return {
      allowed: true,
      remaining: maxRequests - currentRequests - 1,
      reset: limit.windowStart + windowMs,
    };
  }

  // Consume one request from the limit
  async consume(key, route = "unknown") {
    const result = await this.checkLimit(key, route);

    if (!result.allowed) {
      return result;
    }

    // Increment counter
    const currentRequests = this.requests.get(key) || 0;
    this.requests.set(key, currentRequests + 1);

    return {
      ...result,
      remaining: result.remaining - 1,
    };
  }

  // Get current usage for a key
  async getUsage(key) {
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

    // Check if window has expired
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

  // Reset limit for a key
  async resetLimit(key) {
    this.requests.delete(key);

    const limit = this.limits.get(key);
    if (limit) {
      limit.windowStart = Date.now();
    }

    logger.info("Rate limit reset", { key });
  }

  // Remove limit for a key
  removeLimit(key) {
    this.limits.delete(key);
    this.requests.delete(key);
    this.windows.delete(key);

    logger.debug("Rate limit removed", { key });
  }

  // Set provider-specific limits
  setProviderLimit(
    provider,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `provider:${provider}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  // Set user-specific limits
  setUserLimit(
    userId,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `user:${userId}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  // Set model-specific limits
  setModelLimit(
    model,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const key = `model:${model}`;
    this.setLimit(key, windowMs, maxRequests);
  }

  // Check provider limit
  async checkProviderLimit(provider, route = "unknown") {
    const key = `provider:${provider}`;
    return await this.checkLimit(key, route);
  }

  // Check user limit
  async checkUserLimit(userId, route = "unknown") {
    const key = `user:${userId}`;
    return await this.checkLimit(key, route);
  }

  // Check model limit
  async checkModelLimit(model, route = "unknown") {
    const key = `model:${model}`;
    return await this.checkLimit(key, route);
  }

  // Consume provider limit
  async consumeProviderLimit(provider, route = "unknown") {
    const key = `provider:${provider}`;
    return await this.consume(key, route);
  }

  // Consume user limit
  async consumeUserLimit(userId, route = "unknown") {
    const key = `user:${userId}`;
    return await this.consume(key, route);
  }

  // Consume model limit
  async consumeModelLimit(model, route = "unknown") {
    const key = `model:${model}`;
    return await this.consume(key, route);
  }

  // Get all limits
  getAllLimits() {
    const limits = {};

    for (const [key, config] of this.limits.entries()) {
      const usage = this.getUsage(key);
      limits[key] = {
        ...config,
        current: usage.current,
        remaining: config.maxRequests - usage.current,
      };
    }

    return limits;
  }

  // Get limits by type
  getLimitsByType(type) {
    const limits = {};
    const prefix = `${type}:`;

    for (const [key, config] of this.limits.entries()) {
      if (key.startsWith(prefix)) {
        const id = key.substring(prefix.length);
        const usage = this.getUsage(key);
        limits[id] = {
          ...config,
          current: usage.current,
          remaining: config.maxRequests - usage.current,
        };
      }
    }

    return limits;
  }

  // Get provider limits
  getProviderLimits() {
    return this.getLimitsByType("provider");
  }

  // Get user limits
  getUserLimits() {
    return this.getLimitsByType("user");
  }

  // Get model limits
  getModelLimits() {
    return this.getLimitsByType("model");
  }

  // Cleanup old entries
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, limit] of this.limits.entries()) {
      const windowEnd = limit.windowStart + limit.windowMs;

      // Remove expired windows
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

  // Get service health
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

  // Advanced rate limiting with sliding window
  async checkSlidingWindow(
    key,
    windowMs = this.defaultWindowMs,
    maxRequests = this.defaultMaxRequests
  ) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing window data
    let windowData = this.windows.get(key);

    if (!windowData) {
      windowData = {
        requests: [],
        windowStart: now,
      };
      this.windows.set(key, windowData);
    }

    // Remove old requests outside the window
    windowData.requests = windowData.requests.filter(
      (timestamp) => timestamp >= windowStart
    );

    // Check if limit exceeded
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

    // Add current request
    windowData.requests.push(now);

    return {
      allowed: true,
      current: windowData.requests.length,
      limit: maxRequests,
      remaining: maxRequests - windowData.requests.length,
    };
  }

  // Token bucket algorithm
  async checkTokenBucket(key, capacity, refillRate, refillPeriod = 1000) {
    const now = Date.now();

    let bucket = this.windows.get(key);

    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
      };
      this.windows.set(key, bucket);
    }

    // Calculate tokens to add
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / refillPeriod) * refillRate);

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have tokens
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
