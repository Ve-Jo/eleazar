import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.js";
import {
  validateAIRequest,
  validateModelRequest,
} from "../utils/validators.js";

// Request ID middleware
function requestIdMiddleware(req, res, next) {
  req.id = req.get("X-Request-ID") || uuidv4();
  res.set("X-Request-ID", req.id);
  next();
}

// Request logging middleware
function requestLoggingMiddleware(req, res, next) {
  const start = Date.now();

  // Log request
  logger.info("Incoming request", {
    requestId: req.id,
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip || req.connection.remoteAddress,
    category: "http_request",
  });

  // Log response
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request completed", {
      requestId: req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      category: "http_request",
    });
  });

  next();
}

// Security middleware
function securityMiddleware(req, res, next) {
  // Remove sensitive headers
  res.removeHeader("X-Powered-By");

  // Add security headers
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });

  next();
}

// API key validation middleware
function apiKeyMiddleware(req, res, next) {
  if (process.env.API_KEY_REQUIRED === "true") {
    const apiKey = req.get("X-API-Key") || req.query.apiKey;

    if (!apiKey || apiKey !== process.env.API_KEY) {
      logger.warn("Invalid API key", {
        requestId: req.id,
        providedKey: apiKey ? "present" : "missing",
        category: "security",
      });

      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or missing API key",
      });
    }
  }

  next();
}

// Request size limit middleware
function requestSizeLimitMiddleware(req, res, next) {
  const maxSize =
    parseInt(process.env.MAX_REQUEST_SIZE_MB || "10") * 1024 * 1024;

  let size = 0;

  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxSize) {
      logger.warn("Request size limit exceeded", {
        requestId: req.id,
        size: size,
        maxSize: maxSize,
        category: "security",
      });

      req.destroy();
      res.status(413).json({
        error: "Payload Too Large",
        message: `Request size exceeds limit of ${process.env.MAX_REQUEST_SIZE_MB}MB`,
      });
    }
  });

  next();
}

// Rate limiting middleware
function createRateLimitMiddleware(windowMs = 60000, max = 10) {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Maximum ${max} requests per ${
        windowMs / 1000
      } seconds.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn("Rate limit exceeded", {
        requestId: req.id,
        ip: req.ip,
        category: "rate_limit",
      });

      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Maximum ${max} requests per ${
          windowMs / 1000
        } seconds.`,
        retryAfter: res.getHeader("Retry-After"),
      });
    },
  });
}

// Request validation middleware
function validateAIRequestMiddleware(req, res, next) {
  try {
    req.body = validateAIRequest(req.body);
    next();
  } catch (error) {
    logger.warn("Invalid AI request", {
      requestId: req.id,
      error: error.message,
      category: "validation",
    });

    res.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
}

function validateModelRequestMiddleware(req, res, next) {
  try {
    req.query = validateModelRequest(req.query);
    next();
  } catch (error) {
    logger.warn("Invalid model request", {
      requestId: req.id,
      error: error.message,
      category: "validation",
    });

    res.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
}

// CORS configuration
function setupCORS() {
  const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || ["*"];

      if (allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn("CORS origin not allowed", {
          origin: origin,
          allowedOrigins: allowedOrigins,
          category: "security",
        });
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Key",
      "X-Request-ID",
    ],
  };

  return cors(corsOptions);
}

// Error handling middleware
function errorHandler(err, req, res, next) {
  logger.error("Request error", {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    category: "error",
  });

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production" ? "An error occurred" : message,
    requestId: req.id,
  });
}

// Not found middleware
function notFoundHandler(req, res) {
  logger.warn("Route not found", {
    requestId: req.id,
    method: req.method,
    url: req.url,
    category: "routing",
  });

  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.url} not found`,
  });
}

// Setup all middleware
function setupMiddleware(app) {
  // Security middleware
  app.use(helmet());
  app.use(securityMiddleware);

  // CORS
  app.use(setupCORS());

  // Request processing
  app.use(
    express.json({ limit: `${process.env.MAX_REQUEST_SIZE_MB || 10}mb` })
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: `${process.env.MAX_REQUEST_SIZE_MB || 10}mb`,
    })
  );
  app.use(requestSizeLimitMiddleware);

  // Request identification and logging
  app.use(requestIdMiddleware);
  app.use(requestLoggingMiddleware);

  // API key validation
  app.use(apiKeyMiddleware);

  // Rate limiting for general routes
  app.use(
    "/api",
    createRateLimitMiddleware(
      parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10")
    )
  );

  // Health check bypasses rate limiting
  app.use("/health", (req, res, next) => next());
  app.use("/metrics", (req, res, next) => next());
}

export {
  setupMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityMiddleware,
  apiKeyMiddleware,
  requestSizeLimitMiddleware,
  createRateLimitMiddleware,
  validateAIRequestMiddleware,
  validateModelRequestMiddleware,
  errorHandler,
  notFoundHandler,
  setupCORS,
};
