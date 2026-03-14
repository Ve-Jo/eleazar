import { logger } from "../utils/logger.ts";
import { getStreamingService as getSharedStreamingService } from "../services/index.ts";
import {
  updateWebSocketConnections,
  recordWebSocketMessage,
} from "../middleware/metrics.ts";
import { validateWebSocketMessage } from "../utils/validators.ts";

let streamingService: any = null;

function initializeWebSocket(wss: any) {
  streamingService = getSharedStreamingService();

  if (!streamingService) {
    logger.error(
      "Streaming service not initialized. Ensure initializeServices() was called before WebSocket setup."
    );
    return;
  }

  wss.on("connection", (ws: any, req: any) => {
    handleConnection(ws, req);
  });

  logger.info("WebSocket service initialized");
}

function handleConnection(ws: any, req: any) {
  const clientIp = req.socket.remoteAddress;
  const userAgent = req.headers["user-agent"];

  logger.info("New WebSocket connection", {
    clientIp,
    userAgent,
    url: req.url,
  });

  if (!streamingService.checkConnectionLimit()) {
    logger.warn("Connection limit reached", { clientIp });
    ws.close(1013, "Connection limit reached");
    return;
  }

  const sessionId = streamingService.createSession(ws, {
    clientIp,
    userAgent,
    connectedAt: Date.now(),
  });

  updateWebSocketConnections(1);
  recordWebSocketMessage("connection", "success");

  streamingService.sendMessage(sessionId, {
    type: "connected",
    sessionId,
    timestamp: Date.now(),
    message: "Connected to AI Hub streaming service",
  });

  logger.info("WebSocket session created", { sessionId, clientIp });
}

async function handleWebSocketMessage(sessionId: string, message: Record<string, any>) {
  try {
    validateWebSocketMessage(message);
    await streamingService.handleMessage(sessionId, message);
  } catch (error: any) {
    logger.error("WebSocket message handling error", {
      sessionId,
      error: error.message,
      category: "websocket_error",
    });

    streamingService.sendError(sessionId, error.message);
  }
}

function broadcastToSessions(sessionIds: string[], message: Record<string, any>) {
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

function broadcastToAll(message: Record<string, any>) {
  const sessionIds = Array.from(streamingService.sessions.keys()) as string[];
  return broadcastToSessions(sessionIds, message);
}

function getSessionInfo(sessionId: string) {
  return streamingService.getSession(sessionId);
}

function getActiveSessions() {
  return streamingService.getActiveSessions();
}

function closeSession(sessionId: string, reason = "Unknown") {
  return streamingService.closeSession(sessionId, reason);
}

function sendToSession(sessionId: string, message: Record<string, any>) {
  return streamingService.sendMessage(sessionId, message);
}

function sendStreamChunk(
  sessionId: string,
  requestId: string,
  chunk: Record<string, any>
) {
  return streamingService.sendStreamChunk(sessionId, requestId, chunk);
}

function sendStreamComplete(
  sessionId: string,
  requestId: string,
  finishReason = "stop"
) {
  return streamingService.sendStreamComplete(sessionId, requestId, finishReason);
}

function sendToolCall(
  sessionId: string,
  requestId: string,
  toolCall: Record<string, any>
) {
  return streamingService.sendToolCall(sessionId, requestId, toolCall);
}

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

function getWebSocketHealth() {
  if (!streamingService) {
    return {
      status: "unhealthy",
      message: "Streaming service not initialized",
    };
  }

  return streamingService.getHealth();
}

const WebSocketMessageTypes = {
  AI_REQUEST: "ai_request",
  STREAM_CONTROL: "stream_control",
  PING: "ping",
  PONG: "pong",
  CONNECTED: "connected",
  REQUEST_ACKNOWLEDGED: "request_acknowledged",
  STREAM_CHUNK: "stream_chunk",
  STREAM_COMPLETE: "stream_complete",
  TOOL_CALL: "tool_call",
  ERROR: "error",
  SESSION_CLOSED: "session_closed",
} as const;

function createMessage(type: string, data: Record<string, any>, requestId: string | null = null) {
  return {
    type,
    requestId,
    data,
    timestamp: Date.now(),
  };
}

function createAIRequest(
  requestId: string,
  model: string,
  messages: any[],
  parameters: Record<string, any> = {},
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

function createStreamControl(requestId: string, action: string) {
  return createMessage(
    WebSocketMessageTypes.STREAM_CONTROL,
    {
      requestId,
      action,
    },
    requestId
  );
}

function createPing() {
  return createMessage(WebSocketMessageTypes.PING, {
    timestamp: Date.now(),
  });
}

function createPong(originalTimestamp: number) {
  return createMessage(WebSocketMessageTypes.PONG, {
    timestamp: Date.now(),
    originalTimestamp,
  });
}

function createError(error: any, requestId: string | null = null) {
  return createMessage(
    WebSocketMessageTypes.ERROR,
    {
      message: error.message || error,
      timestamp: Date.now(),
    },
    requestId
  );
}

function createStreamChunk(requestId: string, chunk: Record<string, any>) {
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

function createStreamComplete(requestId: string, finishReason = "stop") {
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

function createToolCall(requestId: string, toolCall: Record<string, any>) {
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

function isWebSocketOpen(ws: any) {
  return ws && ws.readyState === WebSocket.OPEN;
}

function safeSend(ws: any, data: unknown) {
  try {
    if (isWebSocketOpen(ws)) {
      ws.send(typeof data === "string" ? data : JSON.stringify(data));
      return true;
    }
  } catch (error: any) {
    logger.error("WebSocket send error", {
      error: error.message,
      category: "websocket_error",
    });
  }
  return false;
}

function validateWebSocketData(data: Record<string, any>) {
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
  isWebSocketOpen,
  safeSend,
  validateWebSocketData,
};
