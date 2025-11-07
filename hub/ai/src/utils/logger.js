import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
import { promises as fs } from "fs";
const logsDir = path.join(__dirname, "../../logs");
try {
  await fs.mkdir(logsDir, { recursive: true });
} catch (error) {
  console.error("Failed to create logs directory:", error);
}

const logLevel = process.env.LOG_LEVEL || "info";
const logFormat = process.env.LOG_FORMAT || "json";
const logFile = process.env.LOG_FILE || "logs/ai-service.log";

// Define log formats
const formats = {
  json: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  simple: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.simple()
  ),
  pretty: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return `${timestamp} [${level}]: ${stack || message}`;
    })
  ),
};

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: formats[logFormat] || formats.json,
  defaultMeta: { service: "ai-hub-service" },
  transports: [
    // Console transport
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === "development" ? formats.pretty : formats.json,
    }),

    // File transport
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],

  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/exceptions.log"),
    }),
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/rejections.log"),
    }),
  ],
});

// Add custom log levels for AI-specific events
logger.levels = {
  ...winston.config.npm.levels,
  ai_request: 1,
  ai_response: 2,
  ai_error: 0,
  ai_stream: 1,
  ai_tool: 2,
};

// Custom logging methods
logger.aiRequest = (message, meta = {}) => {
  logger.log("ai_request", message, { ...meta, category: "ai_request" });
};

logger.aiResponse = (message, meta = {}) => {
  logger.log("ai_response", message, { ...meta, category: "ai_response" });
};

logger.aiError = (message, meta = {}) => {
  logger.log("ai_error", message, { ...meta, category: "ai_error" });
};

logger.aiStream = (message, meta = {}) => {
  logger.log("ai_stream", message, { ...meta, category: "ai_stream" });
};

logger.aiTool = (message, meta = {}) => {
  logger.log("ai_tool", message, { ...meta, category: "ai_tool" });
};

// Request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("HTTP Request", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get("User-Agent"),
      ip: req.ip || req.connection.remoteAddress,
      category: "http_request",
    });
  });

  next();
};

// WebSocket logging
logger.wsConnection = (clientId, action) => {
  logger.info("WebSocket Connection", {
    clientId,
    action,
    category: "websocket_connection",
  });
};

logger.wsMessage = (clientId, messageType, data) => {
  logger.debug("WebSocket Message", {
    clientId,
    messageType,
    dataSize: JSON.stringify(data).length,
    category: "websocket_message",
  });
};

logger.wsError = (clientId, error) => {
  logger.error("WebSocket Error", {
    clientId,
    error: error.message,
    stack: error.stack,
    category: "websocket_error",
  });
};

export { logger };
