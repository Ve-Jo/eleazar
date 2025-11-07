import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import winston from "winston";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

// Import custom modules
import { setupRoutes } from "./routes/index.js";
import { initializeWebSocket } from "./websocket/index.js";
import { setupMiddleware } from "./middleware/index.js";
import { setupMetrics } from "./middleware/metrics.js";
import { setupErrorHandling } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";
import { validateEnvironment } from "./utils/validators.js";
import { initializeServices } from "./services/index.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate environment
validateEnvironment();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 1024 * 1024 * 10, // 10MB max payload
});

// Configuration
const PORT = process.env.AI_SERVICE_PORT || 8080;
const HOST = process.env.AI_SERVICE_HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

// Initialize services
await initializeServices();

// Setup middleware
setupMiddleware(app);

// Setup metrics
setupMetrics(app);

// Setup routes
setupRoutes(app);

// Setup WebSocket
initializeWebSocket(wss);

// Setup error handling
setupErrorHandling(app);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "AI Hub Service",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      metrics: "/metrics",
      models: "/ai/models",
      process: "/ai/process",
      stream: "/ai/process/stream",
    },
    websocket: "ws://" + req.get("host") + "/ws",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

// Start server
server.listen(PORT, HOST, () => {
  logger.info(`AI Hub Service running on ${HOST}:${PORT}`);
  logger.info(`Environment: ${NODE_ENV}`);
  logger.info(`WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  logger.info(`Health check: http://${HOST}:${PORT}/health`);
  logger.info(`Metrics: http://${HOST}:${PORT}/metrics`);
});

export { app, server, wss };
