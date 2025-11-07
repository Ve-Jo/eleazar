import { logger } from "../utils/logger.js";
import { recordProviderError } from "./metrics.js";

// Custom error classes
class AIHubError extends Error {
  constructor(
    message,
    statusCode = 500,
    errorCode = "INTERNAL_ERROR",
    details = null
  ) {
    super(message);
    this.name = "AIHubError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

class ValidationError extends AIHubError {
  constructor(message, details = null) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

class ProviderError extends AIHubError {
  constructor(
    provider,
    message,
    statusCode = 500,
    errorCode = "PROVIDER_ERROR",
    details = null
  ) {
    super(message, statusCode, errorCode, details);
    this.name = "ProviderError";
    this.provider = provider;
  }
}

class RateLimitError extends AIHubError {
  constructor(message, retryAfter = null, details = null) {
    super(message, 429, "RATE_LIMIT_ERROR", details);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

class AuthenticationError extends AIHubError {
  constructor(message, details = null) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends AIHubError {
  constructor(message, details = null) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

class NotFoundError extends AIHubError {
  constructor(resource, details = null) {
    super(`${resource} not found`, 404, "NOT_FOUND_ERROR", details);
    this.name = "NotFoundError";
    this.resource = resource;
  }
}

class ServiceUnavailableError extends AIHubError {
  constructor(message, details = null) {
    super(message, 503, "SERVICE_UNAVAILABLE_ERROR", details);
    this.name = "ServiceUnavailableError";
  }
}

class TimeoutError extends AIHubError {
  constructor(message, timeout = null, details = null) {
    super(message, 408, "TIMEOUT_ERROR", details);
    this.name = "TimeoutError";
    this.timeout = timeout;
  }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error("Request error", {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    name: err.name,
    statusCode: err.statusCode || 500,
    errorCode: err.errorCode || "INTERNAL_ERROR",
    provider: err.provider,
    details: err.details,
    category: "error",
  });

  // Record metrics for provider errors
  if (err instanceof ProviderError) {
    recordProviderError(
      err.provider,
      err.errorCode || "PROVIDER_ERROR",
      err.statusCode || 500
    );
  }

  // Determine status code and error response
  let statusCode = 500;
  let errorResponse = {
    error: "Internal Server Error",
    message: "An unexpected error occurred",
    requestId: req.id,
    timestamp: new Date().toISOString(),
  };

  // Handle different error types
  if (err instanceof AIHubError) {
    statusCode = err.statusCode;
    errorResponse = {
      error: err.errorCode,
      message: err.message,
      requestId: req.id,
      timestamp: err.timestamp,
    };

    // Add specific fields for certain error types
    if (err instanceof RateLimitError && err.retryAfter) {
      errorResponse.retryAfter = err.retryAfter;
      res.set("Retry-After", err.retryAfter.toString());
    }

    if (err instanceof TimeoutError && err.timeout) {
      errorResponse.timeout = err.timeout;
    }

    if (err instanceof NotFoundError) {
      errorResponse.resource = err.resource;
    }

    if (err.details && process.env.NODE_ENV !== "production") {
      errorResponse.details = err.details;
    }
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    errorResponse = {
      error: "VALIDATION_ERROR",
      message: err.message,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };

    if (err.details) {
      errorResponse.details = err.details;
    }
  } else if (err.name === "SyntaxError" && err.status === 400) {
    statusCode = 400;
    errorResponse = {
      error: "JSON_PARSE_ERROR",
      message: "Invalid JSON in request body",
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };
  } else if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED") {
    statusCode = 503;
    errorResponse = {
      error: "SERVICE_UNAVAILABLE_ERROR",
      message: "External service unavailable",
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };
  } else if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
    statusCode = 408;
    errorResponse = {
      error: "TIMEOUT_ERROR",
      message: "Request timeout",
      requestId: req.id,
      timestamp: new Date().toISOString(),
    };
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Setup error handling for the app
function setupErrorHandling(app) {
  // 404 handler
  app.use((req, res) => {
    logger.warn("Route not found", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      category: "routing",
    });

    res.status(404).json({
      error: "NOT_FOUND_ERROR",
      message: `Route ${req.method} ${req.url} not found`,
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught Exception", {
      error: err.message,
      stack: err.stack,
      category: "uncaught_exception",
    });

    // Attempt graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection", {
      reason: reason,
      promise: promise,
      category: "unhandled_rejection",
    });

    // Attempt graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  logger.info("Error handling setup complete");
}

// Retry logic with exponential backoff
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 30000,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      // Don't retry on certain errors
      if (
        error.statusCode >= 400 &&
        error.statusCode < 500 &&
        error.statusCode !== 429
      ) {
        throw error;
      }

      const delay = Math.min(
        retryDelay * Math.pow(backoffMultiplier, attempt),
        maxDelay
      );

      logger.warn(`Retry attempt ${attempt + 1}/${maxRetries}`, {
        error: error.message,
        delay: delay,
        category: "retry",
      });

      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Circuit breaker pattern
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  async call(...args) {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttemptTime) {
        throw new ServiceUnavailableError("Circuit breaker is OPEN");
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await this.fn(...args);

      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
        this.nextAttemptTime = Date.now() + this.resetTimeout;
      }

      throw error;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

// Error recovery strategies
const errorRecoveryStrategies = {
  // Fallback to different provider
  async fallbackToProvider(primaryProvider, fallbackProvider, request) {
    try {
      return await primaryProvider(request);
    } catch (error) {
      logger.warn(
        `Primary provider failed, falling back to ${fallbackProvider.name}`,
        {
          primaryError: error.message,
          category: "fallback",
        }
      );

      return await fallbackProvider(request);
    }
  },

  // Retry with different model
  async retryWithModel(provider, primaryModel, fallbackModels, request) {
    const models = [primaryModel, ...fallbackModels];

    for (const model of models) {
      try {
        const requestWithModel = { ...request, model };
        return await provider(requestWithModel);
      } catch (error) {
        logger.warn(`Model ${model} failed, trying next model`, {
          error: error.message,
          category: "retry",
        });
      }
    }

    throw new Error("All models failed");
  },

  // Cache fallback
  async fallbackToCache(cache, key, provider, request) {
    // Try cache first
    const cached = await cache.get(key);
    if (cached) {
      logger.info("Returning cached response", { key, category: "cache" });
      return cached;
    }

    // If not in cache, fetch from provider and cache
    const result = await provider(request);
    await cache.set(key, result);
    return result;
  },
};

export {
  AIHubError,
  ValidationError,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ServiceUnavailableError,
  TimeoutError,
  errorHandler,
  asyncErrorHandler,
  setupErrorHandling,
  retryWithBackoff,
  CircuitBreaker,
  errorRecoveryStrategies,
};
