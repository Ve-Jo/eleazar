import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger.ts";
import {
  updateStreamingConnections,
  recordWebSocketMessage,
} from "../middleware/metrics.ts";

type StreamSession = {
  id: string;
  ws: any;
  metadata: Record<string, any>;
  createdAt: number;
  lastActivity: number;
  isStreaming: boolean;
  model: string | null;
  provider: string | null;
  requestId: string | null;
};

class StreamingService extends EventEmitter {
  sessions: Map<string, StreamSession>;
  clients: Map<string, any>;
  heartbeats: Map<string, number>;
  requestSessions: Map<string, string>;
  cleanupInterval: ReturnType<typeof setInterval> | null;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  sessionTimeout: number;
  heartbeatIntervalMs: number;
  maxConnections: number;

  constructor() {
    super();
    this.sessions = new Map();
    this.clients = new Map();
    this.heartbeats = new Map();
    this.requestSessions = new Map();
    this.cleanupInterval = null;
    this.heartbeatInterval = null;
    this.sessionTimeout = parseInt(process.env.WS_CONNECTION_TIMEOUT || "120000");
    this.heartbeatIntervalMs = parseInt(
      process.env.WS_HEARTBEAT_INTERVAL || "30000"
    );
    this.maxConnections = parseInt(process.env.WS_MAX_CONNECTIONS || "1000");
  }

  async initialize() {
    logger.info("Initializing streaming service...");

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000);

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

    for (const [sessionId] of this.sessions.entries()) {
      await this.closeSession(sessionId, "Service shutdown");
    }

    logger.info("Streaming service shut down");
  }

  createSession(ws: any, metadata: Record<string, any> = {}) {
    const sessionId = uuidv4();
    const session: StreamSession = {
      id: sessionId,
      ws,
      metadata,
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

    this.setupWebSocketHandlers(sessionId, ws);

    logger.info("Streaming session created", { sessionId, metadata });
    recordWebSocketMessage("session_create", "success");

    return sessionId;
  }

  setupWebSocketHandlers(sessionId: string, ws: any) {
    ws.on("message", async (data: any) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionId, message);
      } catch (error: any) {
        logger.error("WebSocket message error", {
          sessionId,
          error: error.message,
          category: "websocket_error",
        });

        this.sendError(sessionId, "Invalid message format");
      }
    });

    ws.on("close", (code: number, reason: any) => {
      logger.info("WebSocket connection closed", {
        sessionId,
        code,
        reason: reason.toString(),
      });

      void this.closeSession(sessionId, "WebSocket closed");
    });

    ws.on("error", (error: any) => {
      logger.error("WebSocket error", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });

      void this.closeSession(sessionId, "WebSocket error");
    });

    ws.on("pong", () => {
      this.heartbeats.set(sessionId, Date.now());
      logger.debug("WebSocket pong received", { sessionId });
    });
  }

  async handleMessage(sessionId: string, message: Record<string, any>) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn("Message received for unknown session", { sessionId });
      return;
    }

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
    } catch (error: any) {
      logger.error("Error handling WebSocket message", {
        sessionId,
        type: message.type,
        error: error.message,
        category: "websocket_error",
      });

      this.sendError(sessionId, error.message);
    }
  }

  async handleAIRequest(sessionId: string, message: Record<string, any>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const {
      requestId,
      model,
      provider,
      messages,
      parameters,
      stream = true,
    } = message.data || {};

    if (!requestId || !model || !messages) {
      this.sendError(
        sessionId,
        "Missing required fields: requestId, model, messages"
      );
      return;
    }

    session.requestId = requestId;
    session.model = model;
    session.provider = provider;
    session.isStreaming = stream;

    this.requestSessions.set(requestId, sessionId);

    logger.info("AI request received via WebSocket", {
      sessionId,
      requestId,
      model,
      provider,
      stream,
    });

    this.sendMessage(sessionId, {
      type: "request_acknowledged",
      requestId,
      timestamp: Date.now(),
    });

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

  async handleStreamControl(sessionId: string, message: Record<string, any>) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { requestId, action } = message.data || {};

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

  handlePing(sessionId: string, message: Record<string, any>) {
    this.sendMessage(sessionId, {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp,
    });
  }

  handlePong(sessionId: string, message: Record<string, any>) {
    const latency = Date.now() - message.originalTimestamp;
    logger.debug("Pong received", { sessionId, latency });
  }

  sendMessage(sessionId: string, message: Record<string, any>) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.ws) {
      logger.warn("Cannot send message: session not found", { sessionId });
      return false;
    }

    try {
      if (session.ws.readyState === 1) {
        session.ws.send(JSON.stringify(message));
        recordWebSocketMessage(message.type || "unknown", "sent");
        return true;
      }

      logger.warn("WebSocket not open", {
        sessionId,
        readyState: session.ws.readyState,
      });
      return false;
    } catch (error: any) {
      logger.error("Error sending WebSocket message", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });
      return false;
    }
  }

  sendError(sessionId: string, error: any, requestId: string | null = null) {
    this.sendMessage(sessionId, {
      type: "error",
      requestId,
      error: {
        message: error.message || error,
        timestamp: Date.now(),
      },
    });
  }

  sendStreamChunk(sessionId: string, requestId: string, chunk: Record<string, any>) {
    return this.sendMessage(sessionId, {
      type: "stream_chunk",
      requestId,
      chunk: {
        ...chunk,
        timestamp: Date.now(),
      },
    });
  }

  sendStreamComplete(
    sessionId: string,
    requestId: string,
    completionData: Record<string, any>
  ) {
    return this.sendMessage(sessionId, {
      type: "stream_complete",
      requestId,
      completion: completionData,
      timestamp: Date.now(),
    });
  }

  sendToolCall(sessionId: string, requestId: string, toolCall: Record<string, any>) {
    return this.sendMessage(sessionId, {
      type: "tool_call",
      requestId,
      toolCall,
      timestamp: Date.now(),
    });
  }

  sendHeartbeat(sessionId: string) {
    this.sendMessage(sessionId, {
      type: "ping",
      timestamp: Date.now(),
    });
  }

  sendHeartbeats() {
    const now = Date.now();

    for (const [sessionId, lastHeartbeat] of this.heartbeats.entries()) {
      if (now - lastHeartbeat > this.heartbeatIntervalMs * 2) {
        logger.warn("Client not responding to heartbeats", { sessionId });
        void this.closeSession(sessionId, "Heartbeat timeout");
        continue;
      }

      this.sendHeartbeat(sessionId);
    }
  }

  async closeSession(sessionId: string, reason = "Unknown") {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.info("Closing streaming session", { sessionId, reason });

    try {
      this.sendMessage(sessionId, {
        type: "session_closed",
        reason,
        timestamp: Date.now(),
      });

      if (session.ws && session.ws.readyState === 1) {
        session.ws.close(1000, reason);
      }
    } catch (error: any) {
      logger.error("Error closing session", {
        sessionId,
        error: error.message,
        category: "websocket_error",
      });
    } finally {
      if (session.requestId) {
        this.requestSessions.delete(session.requestId);
      }
      this.sessions.delete(sessionId);
      this.clients.delete(sessionId);
      this.heartbeats.delete(sessionId);

      if (session.provider && session.model) {
        updateStreamingConnections(session.provider, session.model, -1);
      }

      recordWebSocketMessage("session_close", "success");
    }
  }

  cleanupInactiveSessions() {
    const now = Date.now();
    const sessionsToClose: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        sessionsToClose.push(sessionId);
        continue;
      }

      const lastHeartbeat = this.heartbeats.get(sessionId);
      if (lastHeartbeat && now - lastHeartbeat > this.heartbeatIntervalMs * 3) {
        sessionsToClose.push(sessionId);
      }
    }

    for (const sessionId of sessionsToClose) {
      void this.closeSession(sessionId, "Inactive session cleanup");
    }

    if (sessionsToClose.length > 0) {
      logger.info("Cleaned up inactive sessions", {
        count: sessionsToClose.length,
      });
    }
  }

  getSession(sessionId: string) {
    return this.sessions.get(sessionId) || null;
  }

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

  getStats() {
    const activeSessions = this.sessions.size;
    const totalConnections = this.clients.size;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};

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

  hasSession(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  getClient(sessionId: string) {
    return this.clients.get(sessionId) || null;
  }

  emit(event: string | symbol, data?: any) {
    logger.debug("Event emitted", { event });
    return super.emit(event, data);
  }

  getSessionIdForRequest(requestId: string) {
    return this.requestSessions.get(requestId) || null;
  }

  checkConnectionLimit() {
    return this.sessions.size < this.maxConnections;
  }

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
