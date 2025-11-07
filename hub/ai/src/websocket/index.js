import { WebSocket } from "ws";
import { logger } from "../utils/logger.js";
// Use the shared StreamingService instance created in services/index.js
import { getStreamingService as getSharedStreamingService } from "../services/index.js";
import {
  updateWebSocketConnections,
  recordWebSocketMessage,
} from "../middleware/metrics.js";
import { validateWebSocketMessage } from "../utils/validators.js";

let streamingService = null;

// Initialize WebSocket service
function initializeWebSocket(wss) {
  // Obtain the shared streaming service instance
  streamingService = getSharedStreamingService();

  if (!streamingService) {
    logger.error("Streaming service not initialized. Ensure initializeServices() was called before WebSocket setup.");
    return;
  }

  wss.on("connection", (ws, req) => {
    handleConnection(ws, req);
  });

  logger.info("WebSocket service initialized");
}

// Handle new WebSocket connection
function handleConnection(ws, req) {
  const clientIp = req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  logger.info("New WebSocket connection", {
    clientIp,
    userAgent,
    url: req.url,
  });

  // Check connection limit
  if (!streamingService.checkConnectionLimit()) {
    logger.warn("Connection limit reached", { clientIp });

    ws.close(1013, "Connection limit reached");
    return;
  }

  // Create streaming session
  const sessionId = streamingService.createSession(ws, {
    clientIp,
    userAgent,
    connectedAt: Date.now(),
  });

  updateWebSocketConnections(1);
  recordWebSocketMessage("connection", "success");

  // Send welcome message
  streamingService.sendMessage(sessionId, {
    type: "connected",
    sessionId,
    timestamp: Date.now(),
    message: "Connected to AI Hub streaming service",
  });

  logger.info("WebSocket session created", { sessionId, clientIp });
}

// Handle WebSocket message
async function handleWebSocketMessage(sessionId, message) {
  try {
    // Validate message format
    validateWebSocketMessage(message);

    // Process message through streaming service
    await streamingService.handleMessage(sessionId, message);
  } catch (error) {
    logger.error("WebSocket message handling error", {
      sessionId,
      error: error.message,
      category: "websocket_error",
    });

    // Send error back to client
    streamingService.sendError(sessionId, error.message);
  }
}

// Broadcast message to multiple sessions
function broadcastToSessions(sessionIds, message) {
  let sent = 0;
  let failed = 0;

  for (const sessionId of sessionIds) {
    if (streamingService.sendMessage(sessionId, message)) {
      sent++;
    } else {
      failed++;
    }
  }

  logger.debug("Broadcast completed", {
    total: sessionIds.length,
    sent,
    failed,
  });

  return { sent, failed };
}

// Broadcast message to all active sessions
function broadcastToAll(message) {
  const sessionIds = Array.from(streamingService.sessions.keys());
  return broadcastToSessions(sessionIds, message);
}

// Note: streamingService is obtained from services/index.js and stored locally.
// We do not re-export a local getter to avoid naming conflicts with the shared one.

// Get session info
function getSessionInfo(sessionId) {
  return streamingService.getSession(sessionId);
}

// Get all active sessions
function getActiveSessions() {
  return streamingService.getActiveSessions();
}

// Close specific session
function closeSession(sessionId, reason = "Unknown") {
  return streamingService.closeSession(sessionId, reason);
}

// Send message to specific session
function sendToSession(sessionId, message) {
  return streamingService.sendMessage(sessionId, message);
}

// Send streaming chunk to session
function sendStreamChunk(sessionId, requestId, chunk) {
  return streamingService.sendStreamChunk(sessionId, requestId, chunk);
}

// Send stream completion to session
function sendStreamComplete(sessionId, requestId, finishReason = "stop") {
  return streamingService.sendStreamComplete(
    sessionId,
    requestId,
    finishReason
  );
}

// Send tool call to session
function sendToolCall(sessionId, requestId, toolCall) {
  return streamingService.sendToolCall(sessionId, requestId, toolCall);
}

// Get WebSocket statistics
function getWebSocketStats() {
  if (!streamingService) {
    return {
      activeSessions: 0,
      totalConnections: 0,
      byProvider: {},
      byModel: {},
    };
  }

  return streamingService.getStats();
}

// Health check for WebSocket service
function getWebSocketHealth() {
  if (!streamingService) {
    return {
      status: "unhealthy",
      message: "Streaming service not initialized",
    };
  }

  return streamingService.getHealth();
}

// WebSocket message types and utilities
const WebSocketMessageTypes = {
  // Client to Server
  AI_REQUEST: "ai_request",
  STREAM_CONTROL: "stream_control",
  PING: "ping",
  PONG: "pong",

  // Server to Client
  CONNECTED: "connected",
  REQUEST_ACKNOWLEDGED: "request_acknowledged",
  STREAM_CHUNK: "stream_chunk",
  STREAM_COMPLETE: "stream_complete",
  TOOL_CALL: "tool_call",
  ERROR: "error",
  SESSION_CLOSED: "session_closed",
  PING: "ping",
  PONG: "pong",
};

// Create WebSocket message
function createMessage(type, data, requestId = null) {
  return {
    type,
    requestId,
    data,
    timestamp: Date.now(),
  };
}

// Create AI request message
function createAIRequest(
  requestId,
  model,
  messages,
  parameters = {},
  stream = true
) {
  return createMessage(
    WebSocketMessageTypes.AI_REQUEST,
    {
      requestId,
      model,
      messages,
      parameters,
      stream,
    },
    requestId
  );
}

// Create stream control message
function createStreamControl(requestId, action) {
  return createMessage(
    WebSocketMessageTypes.STREAM_CONTROL,
    {
      requestId,
      action,
    },
    requestId
  );
}

// Create ping message
function createPing() {
  return createMessage(WebSocketMessageTypes.PING, {
    timestamp: Date.now(),
  });
}

// Create pong message
function createPong(originalTimestamp) {
  return createMessage(WebSocketMessageTypes.PONG, {
    timestamp: Date.now(),
    originalTimestamp,
  });
}

// Create error message
function createError(error, requestId = null) {
  return createMessage(
    WebSocketMessageTypes.ERROR,
    {
      message: error.message || error,
      timestamp: Date.now(),
    },
    requestId
  );
}

// Create stream chunk message
function createStreamChunk(requestId, chunk) {
  return createMessage(
    WebSocketMessageTypes.STREAM_CHUNK,
    {
      requestId,
      chunk: {
        ...chunk,
        timestamp: Date.now(),
      },
    },
    requestId
  );
}

// Create stream complete message
function createStreamComplete(requestId, finishReason = "stop") {
  return createMessage(
    WebSocketMessageTypes.STREAM_COMPLETE,
    {
      requestId,
      finishReason,
      timestamp: Date.now(),
    },
    requestId
  );
}

// Create tool call message
function createToolCall(requestId, toolCall) {
  return createMessage(
    WebSocketMessageTypes.TOOL_CALL,
    {
      requestId,
      toolCall,
      timestamp: Date.now(),
    },
    requestId
  );
}

// WebSocket connection utilities
function isWebSocketOpen(ws) {
  return ws && ws.readyState === WebSocket.OPEN;
}

function safeSend(ws, data) {
  try {
    if (isWebSocketOpen(ws)) {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    }
  } catch (error) {
    logger.error("WebSocket send error", {
      error: error.message,
      category: "websocket_error",
    });
  }
  return false;
}

// WebSocket message validation
function validateWebSocketData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid WebSocket data: must be an object");
  }

  if (!data.type || typeof data.type !== "string") {
    throw new Error("Invalid WebSocket data: missing or invalid type");
  }

  if (!data.requestId || typeof data.requestId !== "string") {
    throw new Error("Invalid WebSocket data: missing or invalid requestId");
  }

  return true;
}

export {
  initializeWebSocket,
  handleWebSocketMessage,
  broadcastToSessions,
  broadcastToAll,
  getSessionInfo,
  getActiveSessions,
  closeSession,
  sendToSession,
  sendStreamChunk,
  sendStreamComplete,
  sendToolCall,
  getWebSocketStats,
  getWebSocketHealth,

  // Message types and creators
  WebSocketMessageTypes,
  createMessage,
  createAIRequest,
  createStreamControl,
  createPing,
  createPong,
  createError,
  createStreamChunk,
  createStreamComplete,
  createToolCall,

  // Utilities
  isWebSocketOpen,
  safeSend,
  validateWebSocketData,
};
