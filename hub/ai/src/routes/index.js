import express from "express";
import { setupModelRoutes } from "./models.js";
import { setupProcessRoutes } from "./process.js";
import { setupStreamingRoutes } from "./streaming.js";
import {
  validateAIRequestMiddleware,
  validateModelRequestMiddleware,
} from "../middleware/index.js";
import { asyncErrorHandler } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

function setupRoutes(app) {
  logger.info("Setting up routes...");

  // API routes
  const apiRouter = express.Router();

  // Model management routes
  const modelRouter = express.Router();
  setupModelRoutes(modelRouter);
  apiRouter.use("/models", validateModelRequestMiddleware, modelRouter);

  // AI processing routes
  const processRouter = express.Router();
  setupProcessRoutes(processRouter);
  apiRouter.use("/process", validateAIRequestMiddleware, processRouter);

  // Streaming routes
  const streamingRouter = express.Router();
  setupStreamingRoutes(streamingRouter);
  apiRouter.use("/stream", streamingRouter);

  // Health and status routes
  apiRouter.get(
    "/health",
    asyncErrorHandler(async (req, res) => {
      const health = await getHealthStatus();
      res.json(health);
    })
  );

  apiRouter.get(
    "/status",
    asyncErrorHandler(async (req, res) => {
      const status = await getServiceStatus();
      res.json(status);
    })
  );

  apiRouter.get(
    "/stats",
    asyncErrorHandler(async (req, res) => {
      const stats = await getServiceStats();
      res.json(stats);
    })
  );

  // Mount API routes
  app.use("/ai", apiRouter);

  // Root API info
  app.get("/api", (req, res) => {
    res.json({
      service: "AI Hub Service API",
      version: "1.0.0",
      endpoints: {
        health: "/ai/health",
        status: "/ai/status",
        stats: "/ai/stats",
        models: "/ai/models",
        process: "/ai/process",
        stream: "/ai/stream",
      },
      websocket: "ws://" + req.get("host") + "/ws",
    });
  });

  logger.info("Routes setup complete");
}

// Get health status
async function getHealthStatus() {
  const {
    getModelService,
    getCacheService,
    getRateLimitService,
    getStreamingService,
  } = await import("../services/index.js");

  const modelService = getModelService();
  const cacheService = getCacheService();
  const rateLimitService = getRateLimitService();
  const streamingService = getStreamingService();

  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      models: modelService
        ? modelService.getHealth()
        : { status: "unavailable" },
      cache: cacheService ? cacheService.health() : { status: "unavailable" },
      rateLimit: rateLimitService
        ? rateLimitService.getHealth()
        : { status: "unavailable" },
      streaming: streamingService
        ? streamingService.getHealth()
        : { status: "unavailable" },
    },
  };

  // Determine overall health
  const serviceStatuses = Object.values(health.services).map((s) => s.status);
  if (serviceStatuses.includes("unhealthy")) {
    health.status = "degraded";
  } else if (serviceStatuses.includes("unavailable")) {
    health.status = "limited";
  }

  return health;
}

// Get service status
async function getServiceStatus() {
  const { getModelService, getRateLimitService, getStreamingService } =
    await import("../services/index.js");

  const modelService = getModelService();
  const rateLimitService = getRateLimitService();
  const streamingService = getStreamingService();

  const status = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    models: modelService ? modelService.getModelStats() : null,
    rateLimits: rateLimitService ? rateLimitService.getAllLimits() : null,
    streaming: streamingService ? streamingService.getStats() : null,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
    },
  };

  return status;
}

// Get service statistics
async function getServiceStats() {
  const { getModelService, getRateLimitService, getStreamingService } =
    await import("../services/index.js");

  const modelService = getModelService();
  const rateLimitService = getRateLimitService();
  const streamingService = getStreamingService();

  const stats = {
    timestamp: new Date().toISOString(),
    period: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      end: new Date().toISOString(),
    },
    models: {
      total: 0,
      byProvider: {},
      byCapability: {},
    },
    requests: {
      total: 0,
      byProvider: {},
      byStatus: {},
      averageDuration: 0,
    },
    streaming: {
      activeSessions: 0,
      totalSessions: 0,
      averageSessionDuration: 0,
    },
    rateLimits: {
      totalLimits: 0,
      hits: 0,
      byType: {},
    },
  };

  if (modelService) {
    const modelStats = modelService.getModelStats();
    stats.models = {
      total: modelStats.total,
      byProvider: modelStats.byProvider,
      byCapability: modelStats.byCapability,
    };
  }

  if (rateLimitService) {
    const allLimits = rateLimitService.getAllLimits();
    stats.rateLimits = {
      totalLimits: Object.keys(allLimits).length,
      hits: 0, // This would need to be tracked
      byType: {
        provider: Object.keys(rateLimitService.getProviderLimits()).length,
        user: Object.keys(rateLimitService.getUserLimits()).length,
        model: Object.keys(rateLimitService.getModelLimits()).length,
      },
    };
  }

  if (streamingService) {
    const wsStats = streamingService.getStats();
    stats.streaming = {
      activeSessions: wsStats.activeSessions,
      totalSessions: wsStats.activeSessions, // This would need historical tracking
      averageSessionDuration: 0, // This would need historical tracking
    };
  }

  return stats;
}

export { setupRoutes };
