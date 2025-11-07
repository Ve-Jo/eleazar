import express from "express";
import { logger } from "../utils/logger.js";
import { asyncErrorHandler } from "../middleware/errorHandler.js";
import { getStreamingService } from "../services/index.js";
import { v4 as uuidv4 } from "uuid";

function setupStreamingRoutes(router) {
  // POST /ai/stream/start - Start streaming session
  router.post(
    "/start",
    asyncErrorHandler(async (req, res) => {
      const { requestId, model, userId, guildId, metadata = {} } = req.body;

      if (!requestId || !model) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "requestId and model are required",
        });
      }

      logger.info("Starting streaming session", {
        requestId,
        model,
        userId,
        guildId,
      });

      const streamingService = getStreamingService();

      // Generate session info for WebSocket connection
      const sessionInfo = {
        requestId,
        model,
        userId,
        guildId,
        metadata,
        timestamp: Date.now(),
        clientIp: req.ip,
        userAgent: req.get("User-Agent"),
      };

      res.json({
        success: true,
        message: "Streaming session initiated",
        sessionInfo,
        websocketUrl: `ws://${req.get("host")}/ws`,
        requestId,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/stop - Stop streaming session
  router.post(
    "/stop",
    asyncErrorHandler(async (req, res) => {
      const { sessionId, requestId, reason = "User requested" } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "sessionId is required",
        });
      }

      logger.info("Stopping streaming session", {
        sessionId,
        requestId,
        reason,
      });

      const streamingService = getStreamingService();

      if (!streamingService.hasSession(sessionId)) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Streaming session not found: ${sessionId}`,
          sessionId,
        });
      }

      await streamingService.closeSession(sessionId, reason);

      res.json({
        success: true,
        message: "Streaming session stopped",
        sessionId,
        reason,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/stream/sessions - Get active streaming sessions
  router.get(
    "/sessions",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting active streaming sessions");

      const streamingService = getStreamingService();
      const sessions = streamingService.getActiveSessions();

      res.json({
        sessions,
        count: sessions.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/stream/sessions/:sessionId - Get specific session info
  router.get(
    "/sessions/:sessionId",
    asyncErrorHandler(async (req, res) => {
      const { sessionId } = req.params;

      logger.debug("Getting streaming session info", { sessionId });

      const streamingService = getStreamingService();
      const session = streamingService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Streaming session not found: ${sessionId}`,
          sessionId,
        });
      }

      res.json({
        session,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/stream/stats - Get streaming statistics
  router.get(
    "/stats",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting streaming statistics");

      const streamingService = getStreamingService();
      const stats = streamingService.getStats();

      res.json({
        stats,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/stream/health - Get streaming service health
  router.get(
    "/health",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting streaming service health");

      const streamingService = getStreamingService();
      const health = streamingService.getHealth();

      res.json({
        service: "streaming_service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/control - Send stream control command
  router.post(
    "/control",
    asyncErrorHandler(async (req, res) => {
      const { sessionId, requestId, action } = req.body;

      if (!sessionId || !requestId || !action) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "sessionId, requestId, and action are required",
        });
      }

      logger.info("Sending stream control command", {
        sessionId,
        requestId,
        action,
      });

      const streamingService = getStreamingService();

      if (!streamingService.hasSession(sessionId)) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Streaming session not found: ${sessionId}`,
          sessionId,
        });
      }

      // Send control message through WebSocket
      const controlMessage = {
        type: "stream_control",
        requestId,
        data: { requestId, action },
      };

      const sent = streamingService.sendMessage(sessionId, controlMessage);

      if (!sent) {
        return res.status(500).json({
          error: "INTERNAL_ERROR",
          message: "Failed to send control message",
          sessionId,
          requestId,
          action,
        });
      }

      res.json({
        success: true,
        message: "Control command sent",
        sessionId,
        requestId,
        action,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/broadcast - Broadcast message to multiple sessions
  router.post(
    "/broadcast",
    asyncErrorHandler(async (req, res) => {
      const { sessionIds, message } = req.body;

      if (!Array.isArray(sessionIds) || !message) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "sessionIds array and message are required",
        });
      }

      if (sessionIds.length > 100) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Maximum 100 sessions allowed per broadcast",
        });
      }

      logger.info("Broadcasting message to sessions", {
        count: sessionIds.length,
        messageType: message.type,
      });

      const streamingService = getStreamingService();
      const { sent, failed } = streamingService.broadcastToSessions(
        sessionIds,
        message
      );

      res.json({
        success: true,
        message: "Broadcast completed",
        sent,
        failed,
        total: sessionIds.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/broadcast/all - Broadcast to all active sessions
  router.post(
    "/broadcast/all",
    asyncErrorHandler(async (req, res) => {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "message is required",
        });
      }

      logger.info("Broadcasting message to all sessions", {
        messageType: message.type,
      });

      const streamingService = getStreamingService();
      const { sent, failed } = streamingService.broadcastToAll(message);

      res.json({
        success: true,
        message: "Broadcast completed",
        sent,
        failed,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // WebSocket upgrade handler
  router.get("/ws", (req, res) => {
    logger.info("WebSocket upgrade requested", {
      clientIp: req.ip,
      userAgent: req.get("User-Agent"),
    });

    // This will be handled by the WebSocket server setup
    // The actual upgrade happens in the main server file
    res.status(426).json({
      error: "UPGRADE_REQUIRED",
      message: "WebSocket upgrade required",
      websocketUrl: `ws://${req.get("host")}/ws`,
    });
  });

  // POST /ai/stream/ping - Send ping to specific session
  router.post(
    "/ping",
    asyncErrorHandler(async (req, res) => {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "sessionId is required",
        });
      }

      logger.debug("Sending ping to session", { sessionId });

      const streamingService = getStreamingService();

      if (!streamingService.hasSession(sessionId)) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Streaming session not found: ${sessionId}`,
          sessionId,
        });
      }

      const pingMessage = {
        type: "ping",
        timestamp: Date.now(),
      };

      const sent = streamingService.sendMessage(sessionId, pingMessage);

      if (!sent) {
        return res.status(500).json({
          error: "INTERNAL_ERROR",
          message: "Failed to send ping message",
          sessionId,
        });
      }

      res.json({
        success: true,
        message: "Ping sent",
        sessionId,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/ping/all - Send ping to all sessions
  router.post(
    "/ping/all",
    asyncErrorHandler(async (req, res) => {
      logger.info("Sending ping to all sessions");

      const streamingService = getStreamingService();
      const pingMessage = {
        type: "ping",
        timestamp: Date.now(),
      };

      const { sent, failed } = streamingService.broadcastToAll(pingMessage);

      res.json({
        success: true,
        message: "Ping broadcast completed",
        sent,
        failed,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/cleanup - Cleanup inactive sessions
  router.post(
    "/cleanup",
    asyncErrorHandler(async (req, res) => {
      const { maxAge = 300000 } = req.body; // Default 5 minutes

      logger.info("Running streaming session cleanup", { maxAge });

      const streamingService = getStreamingService();

      // Get current stats before cleanup
      const beforeStats = streamingService.getStats();

      // Run cleanup
      streamingService.cleanupInactiveSessions();

      // Get stats after cleanup
      const afterStats = streamingService.getStats();

      const cleaned = beforeStats.activeSessions - afterStats.activeSessions;

      res.json({
        success: true,
        message: "Cleanup completed",
        cleaned,
        before: beforeStats,
        after: afterStats,
        maxAge,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/stream/config - Get streaming configuration
  router.get(
    "/config",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting streaming configuration");

      const config = {
        sessionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || "120000"),
        heartbeatInterval: parseInt(
          process.env.WS_HEARTBEAT_INTERVAL || "30000"
        ),
        maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || "1000"),
        cleanupInterval: 60000,
        features: {
          streaming: true,
          heartbeats: true,
          cleanup: true,
          broadcast: true,
          control: true,
        },
      };

      res.json({
        config,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/stream/test - Test streaming endpoint
  router.post(
    "/test",
    asyncErrorHandler(async (req, res) => {
      const { sessionId, message = "Test message" } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "sessionId is required",
        });
      }

      logger.info("Sending test message to session", { sessionId });

      const streamingService = getStreamingService();

      if (!streamingService.hasSession(sessionId)) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Streaming session not found: ${sessionId}`,
          sessionId,
        });
      }

      const testMessage = {
        type: "test",
        message,
        timestamp: Date.now(),
      };

      const sent = streamingService.sendMessage(sessionId, testMessage);

      if (!sent) {
        return res.status(500).json({
          error: "INTERNAL_ERROR",
          message: "Failed to send test message",
          sessionId,
        });
      }

      res.json({
        success: true,
        message: "Test message sent",
        sessionId,
        timestamp: new Date().toISOString(),
      });
    })
  );
}

export { setupStreamingRoutes };
