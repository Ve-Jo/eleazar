import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.ts";
import {
  validateAIRequest,
  validateModelRequest,
} from "../utils/validators.ts";

// Request ID middleware
function requestIdMiddleware(req: any, res: any, next: any) {
  req.id = req.get("X-Request-ID") || uuidv4();
  res.set("X-Request-ID", req.id);
  next();
}

// Request logging middleware
function requestLoggingMiddleware(req: any, res: any, next: any) {
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
function securityMiddleware(req: any, res: any, next: any) {
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
function apiKeyMiddleware(req: any, res: any, next: any) {
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
function requestSizeLimitMiddleware(req: any, res: any, next: any) {
  const maxSize =
    parseInt(process.env.MAX_REQUEST_SIZE_MB || "10") * 1024 * 1024;

  let size = 0;

  req.on("data", (chunk: Buffer) => {
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
    handler: (req: any, res: any) => {
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
function validateAIRequestMiddleware(req: any, res: any, next: any) {
  try {
    req.body = validateAIRequest(req.body);
    next();
  } catch (error: any) {
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

function validateModelRequestMiddleware(req: any, res: any, next: any) {
  try {
    req.query = validateModelRequest(req.query);
    next();
  } catch (error: any) {
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
    origin: function (origin: any, callback: any) {
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
  };

  return cors(corsOptions);
}

// Configure middleware
function setupMiddleware(app: any) {
  // Setup CORS
  app.use(setupCORS());

  // Request ID middleware
  app.use(requestIdMiddleware);

  // Request logging
  app.use(requestLoggingMiddleware);

  // Security middleware
  app.use(securityMiddleware);

  // API key middleware
  app.use(apiKeyMiddleware);

  // JSON parser with strict limit
  app.use(
    express.json({
      limit: `${process.env.MAX_REQUEST_SIZE_MB || "10"}mb`,
      verify: (req: any, res: any, buf: Buffer) => {
        // Store raw body for debugging/verification if needed
        req.rawBody = buf;
      },
    })
  );

  // Request size limit (additional safety)
  app.use(requestSizeLimitMiddleware);

  // Rate limiting (global)
  app.use(
    createRateLimitMiddleware(
      parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"),
      parseInt(process.env.RATE_LIMIT_MAX || "100")
    )
  );
}

export {
  setupMiddleware,
  createRateLimitMiddleware,
  requestIdMiddleware,
  requestLoggingMiddleware,
  securityMiddleware,
  apiKeyMiddleware,
  requestSizeLimitMiddleware,
  validateAIRequestMiddleware,
  validateModelRequestMiddleware,
};
