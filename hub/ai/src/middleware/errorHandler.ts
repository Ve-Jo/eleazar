import { logger } from "../utils/logger.ts";
import { recordProviderError } from "./metrics.ts";

type RequestLike = {
  id?: string;
  method: string;
  url: string;
};

type ResponseLike = {
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
  set: (header: string, value: string) => void;
};

type NextFunctionLike = (error?: unknown) => void;

type ErrorWithContext = Error & {
  statusCode?: number;
  errorCode?: string;
  provider?: string;
  details?: unknown;
  status?: number;
  code?: string;
};

// Custom error classes
class AIHubError extends Error {
  statusCode: number;
  errorCode: string;
  details: unknown;
  timestamp: string;
  provider?: string;
  retryAfter?: number | string | null;
  timeout?: number | null;
  resource?: string;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = "INTERNAL_ERROR",
    details: unknown = null
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
  constructor(message: string, details: unknown = null) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

class ProviderError extends AIHubError {
  provider: string;

  constructor(
    provider: string,
    message: string,
    statusCode = 500,
    errorCode = "PROVIDER_ERROR",
    details: unknown = null
  ) {
    super(message, statusCode, errorCode, details);
    this.name = "ProviderError";
    this.provider = provider;
  }
}

class RateLimitError extends AIHubError {
  retryAfter: number | string | null;

  constructor(message: string, retryAfter: number | string | null = null, details: unknown = null) {
    super(message, 429, "RATE_LIMIT_ERROR", details);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

class AuthenticationError extends AIHubError {
  constructor(message: string, details: unknown = null) {
    super(message, 401, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

class AuthorizationError extends AIHubError {
  constructor(message: string, details: unknown = null) {
    super(message, 403, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

class NotFoundError extends AIHubError {
  resource: string;

  constructor(resource: string, details: unknown = null) {
    super(`${resource} not found`, 404, "NOT_FOUND_ERROR", details);
    this.name = "NotFoundError";
    this.resource = resource;
  }
}

class ServiceUnavailableError extends AIHubError {
  constructor(message: string, details: unknown = null) {
    super(message, 503, "SERVICE_UNAVAILABLE_ERROR", details);
    this.name = "ServiceUnavailableError";
  }
}

class TimeoutError extends AIHubError {
  timeout: number | null;

  constructor(message: string, timeout: number | null = null, details: unknown = null) {
    super(message, 408, "TIMEOUT_ERROR", details);
    this.name = "TimeoutError";
    this.timeout = timeout;
  }
}

// Error handler middleware
function errorHandler(
  err: ErrorWithContext,
  req: RequestLike,
  res: ResponseLike,
  _next: NextFunctionLike
) {
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
  let errorResponse: Record<string, unknown> = {
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
function asyncErrorHandler<
  Req = RequestLike,
  Res = ResponseLike,
>(fn: (req: Req, res: Res, next: NextFunctionLike) => unknown | Promise<unknown>) {
  return (req: Req, res: Res, next: NextFunctionLike) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Setup error handling for the app
function setupErrorHandling(app: { use: (...args: unknown[]) => void }) {
  // 404 handler
  app.use((req: RequestLike, res: ResponseLike) => {
    logger.warn("Route not found", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      category: "http_request",
    });

    res.status(404).json({
      error: "Not Found",
      message: "The requested resource does not exist",
      requestId: req.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Error handler
  app.use(errorHandler);
}

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
};
