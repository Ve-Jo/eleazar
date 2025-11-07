import { logger } from "../utils/logger.js";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import {
  updateStreamingConnections,
  recordWebSocketMessage,
} from "../middleware/metrics.js";

class StreamingService extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // Active streaming sessions
    this.clients = new Map(); // WebSocket clients by session ID
    this.heartbeats = new Map(); // Heartbeat tracking
    this.requestSessions = new Map(); // Map requestId -> sessionId
    this.cleanupInterval = null;
    this.heartbeatInterval = null;
    this.sessionTimeout = parseInt(
      process.env.WS_CONNECTION_TIMEOUT || "120000"
    );
    this.heartbeatIntervalMs = parseInt(
      process.env.WS_HEARTBEAT_INTERVAL || "30000"
    );
    this.maxConnections = parseInt(process.env.WS_MAX_CONNECTIONS || "1000");
  }

  async initialize() {
    logger.info("Initializing streaming service...");

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Every minute

    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeats();
    }, this.heartbeatIntervalMs);

    logger.info("Streaming service initialized", {
      sessionTimeout: this.sessionTimeout,
      heartbeatInterval: this.heartbeatIntervalMs,
      maxConnections: this.maxConnections,
    });
  }

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all active sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      await this.closeSession(sessionId, "Service shutdown");
    }

    logger.info("Streaming service shut down");
  }

  // Create new streaming session
  createSession(ws, metadata = {}) {
    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      ws: ws,
      metadata: metadata,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isStreaming: false,
      model: null,
      provider: null,
      requestId: null,
    };

    this.sessions.set(sessionId, session);
    this.clients.set(sessionId, ws);
    this.heartbeats.set(sessionId, Date.now());

    // Set up WebSocket event handlers
    this.setupWebSocketHandlers(sessionId, ws);

    logger.info("Streaming session created", { sessionId, metadata });
    recordWebSocketMessage("session_create", "success");

    return sessionId;
  }

  // Set up WebSocket event handlers
  setupWebSocketHandlers(sessionId, ws) {
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message);
      } catch (error) {
        logger.error("WebSocket message error", {
          sessionId,
          error: error.message,
          category: "websocket_error",
        });

        this.sendError(sessionId, "Invalid message format");
      }
    });

    ws.on("close", (code, reason) => {
      logger.info("WebSocket connection closed", {
        sessionId,
        code,
        reason: reason.toString(),
      });

      this.closeSession(sessionId, "WebSocket closed");
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });

      this.closeSession(sessionId, "WebSocket error");
    });

    ws.on("pong", () => {
      this.heartbeats.set(sessionId, Date.now());
      logger.debug("WebSocket pong received", { sessionId });
    });
  }

  // Handle incoming WebSocket messages
  async handleMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn("Message received for unknown session", { sessionId });
      return;
    }

    // Update activity
    session.lastActivity = Date.now();

    logger.debug("WebSocket message received", {
      sessionId,
      type: message.type,
      requestId: message.requestId,
    });

    recordWebSocketMessage(message.type || "unknown", "received");

    try {
      switch (message.type) {
        case "ai_request":
          await this.handleAIRequest(sessionId, message);
          break;

        case "stream_control":
          await this.handleStreamControl(sessionId, message);
          break;

        case "ping":
          this.handlePing(sessionId, message);
          break;

        case "pong":
          this.handlePong(sessionId, message);
          break;

        default:
          logger.warn("Unknown message type", {
            sessionId,
            type: message.type,
          });
          this.sendError(sessionId, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error("Error handling WebSocket message", {
        sessionId,
        type: message.type,
        error: error.message,
        category: "websocket_error",
      });

      this.sendError(sessionId, error.message);
    }
  }

  // Handle AI request
  async handleAIRequest(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const {
      requestId,
      model,
      provider,
      messages,
      parameters,
      stream = true,
    } = message.data;

    if (!requestId || !model || !messages) {
      this.sendError(
        sessionId,
        "Missing required fields: requestId, model, messages"
      );
      return;
    }

    // Update session info
    session.requestId = requestId;
    session.model = model;
    session.provider = provider;
    session.isStreaming = stream;

    // Map this request to the current session for downstream processing
    this.requestSessions.set(requestId, sessionId);

    logger.info("AI request received via WebSocket", {
      sessionId,
      requestId,
      model,
      provider,
      stream,
    });

    // Send acknowledgment
    this.sendMessage(sessionId, {
      type: "request_acknowledged",
      requestId,
      timestamp: Date.now(),
    });

    // Process the request (handled by AIProcessingService via event wiring)
    this.emit("ai_request", {
      sessionId,
      requestId,
      model,
      provider,
      messages,
      parameters,
      stream,
    });
  }

  // Handle stream control
  async handleStreamControl(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { requestId, action } = message.data;

    if (!requestId || !action) {
      this.sendError(sessionId, "Missing required fields: requestId, action");
      return;
    }

    logger.info("Stream control received", {
      sessionId,
      requestId,
      action,
    });

    switch (action) {
      case "stop":
        this.emit("stream_stop", { sessionId, requestId });
        break;

      case "pause":
        this.emit("stream_pause", { sessionId, requestId });
        break;

      case "resume":
        this.emit("stream_resume", { sessionId, requestId });
        break;

      default:
        this.sendError(sessionId, `Unknown stream action: ${action}`);
    }
  }

  // Handle ping
  handlePing(sessionId, message) {
    this.sendMessage(sessionId, {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp,
    });
  }

  // Handle pong
  handlePong(sessionId, message) {
    const latency = Date.now() - message.originalTimestamp;
    logger.debug("Pong received", { sessionId, latency });
  }

  // Send message to client
  sendMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.ws) {
      logger.warn("Cannot send message: session not found", { sessionId });
      return false;
    }

    try {
      if (session.ws.readyState === 1) {
        // OPEN
        session.ws.send(JSON.stringify(message));
        recordWebSocketMessage(message.type || "unknown", "sent");
        return true;
      } else {
        logger.warn("WebSocket not open", {
          sessionId,
          readyState: session.ws.readyState,
        });
        return false;
      }
    } catch (error) {
      logger.error("Error sending WebSocket message", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });
      return false;
    }
  }

  // Send error message
  sendError(sessionId, error, requestId = null) {
    this.sendMessage(sessionId, {
      type: "error",
      requestId,
      error: {
        message: error.message || error,
        timestamp: Date.now(),
      },
    });
  }

  // Send streaming chunk
  sendStreamChunk(sessionId, requestId, chunk) {
    const message = {
      type: "stream_chunk",
      requestId,
      chunk: {
        ...chunk,
        timestamp: Date.now(),
      },
    };

    return this.sendMessage(sessionId, message);
  }

  // Send stream completion with unified format
  sendStreamComplete(sessionId, requestId, completionData) {
    const message = {
      type: "stream_complete",
      requestId,
      completion: completionData,
      timestamp: Date.now(),
    };

    return this.sendMessage(sessionId, message);
  }

  // Send tool call
  sendToolCall(sessionId, requestId, toolCall) {
    const message = {
      type: "tool_call",
      requestId,
      toolCall,
      timestamp: Date.now(),
    };

    return this.sendMessage(sessionId, message);
  }

  // Send heartbeat
  sendHeartbeat(sessionId) {
    this.sendMessage(sessionId, {
      type: "ping",
      timestamp: Date.now(),
    });
  }

  // Send heartbeats to all clients
  sendHeartbeats() {
    const now = Date.now();

    for (const [sessionId, lastHeartbeat] of this.heartbeats.entries()) {
      if (now - lastHeartbeat > this.heartbeatIntervalMs * 2) {
        // Client hasn't responded to recent heartbeats, close connection
        logger.warn("Client not responding to heartbeats", { sessionId });
        this.closeSession(sessionId, "Heartbeat timeout");
        continue;
      }

      this.sendHeartbeat(sessionId);
    }
  }

  // Close streaming session
  async closeSession(sessionId, reason = "Unknown") {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.info("Closing streaming session", { sessionId, reason });

    try {
      // Send close message
      this.sendMessage(sessionId, {
        type: "session_closed",
        reason,
        timestamp: Date.now(),
      });

      // Close WebSocket connection
      if (session.ws && session.ws.readyState === 1) {
        session.ws.close(1000, reason);
      }
    } catch (error) {
      logger.error("Error closing session", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });
    } finally {
      // Clean up
      // Remove request-to-session mapping if present
      if (session.requestId) {
        this.requestSessions.delete(session.requestId);
      }
      this.sessions.delete(sessionId);
      this.clients.delete(sessionId);
      this.heartbeats.delete(sessionId);

      // Update metrics
      if (session.provider && session.model) {
        updateStreamingConnections(session.provider, session.model, -1);
      }

      recordWebSocketMessage("session_close", "success");
    }
  }

  // Cleanup inactive sessions
  cleanupInactiveSessions() {
    const now = Date.now();
    const sessionsToClose = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      // Check session timeout
      if (now - session.lastActivity > this.sessionTimeout) {
        sessionsToClose.push(sessionId);
        continue;
      }

      // Check heartbeat timeout
      const lastHeartbeat = this.heartbeats.get(sessionId);
      if (lastHeartbeat && now - lastHeartbeat > this.heartbeatIntervalMs * 3) {
        sessionsToClose.push(sessionId);
      }
    }

    // Close inactive sessions
    for (const sessionId of sessionsToClose) {
      this.closeSession(sessionId, "Inactive session cleanup");
    }

    if (sessionsToClose.length > 0) {
      logger.info("Cleaned up inactive sessions", {
        count: sessionsToClose.length,
      });
    }
  }

  // Get session info
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  // Get all active sessions
  getActiveSessions() {
    return Array.from(this.sessions.values()).map((session) => ({
      id: session.id,
      metadata: session.metadata,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      isStreaming: session.isStreaming,
      model: session.model,
      provider: session.provider,
      requestId: session.requestId,
    }));
  }

  // Get session statistics
  getStats() {
    const activeSessions = this.sessions.size;
    const totalConnections = this.clients.size;

    const byProvider = {};
    const byModel = {};

    for (const session of this.sessions.values()) {
      if (session.provider) {
        byProvider[session.provider] = (byProvider[session.provider] || 0) + 1;
      }

      if (session.model) {
        byModel[session.model] = (byModel[session.model] || 0) + 1;
      }
    }

    return {
      activeSessions,
      totalConnections,
      byProvider,
      byModel,
      heartbeats: this.heartbeats.size,
    };
  }

  // Check if session exists
  hasSession(sessionId) {
    return this.sessions.has(sessionId);
  }

  // Get WebSocket client for session
  getClient(sessionId) {
    return this.clients.get(sessionId) || null;
  }

  // Event emitter functionality
  emit(event, data) {
    logger.debug("Event emitted", { event });
    return super.emit(event, data);
  }

  // Resolve sessionId for a given requestId
  getSessionIdForRequest(requestId) {
    return this.requestSessions.get(requestId) || null;
  }

  // Check connection limit
  checkConnectionLimit() {
    return this.sessions.size < this.maxConnections;
  }

  // Get service health
  getHealth() {
    return {
      status: "healthy",
      activeSessions: this.sessions.size,
      totalConnections: this.clients.size,
      heartbeats: this.heartbeats.size,
      maxConnections: this.maxConnections,
      connectionLimitReached: this.sessions.size >= this.maxConnections,
    };
  }
}

export { StreamingService };
