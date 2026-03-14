import { logger } from "../utils/logger.ts";
import { initializeProviderClients } from "../utils/providers.ts";
import { EnhancedModelService } from "./modelService.ts";
import { AIProcessingService } from "./aiProcessingService.ts";
import { StreamingService } from "./streamingService.ts";
import { RateLimitService } from "./rateLimitService.ts";
import { CacheService } from "./cacheService.ts";
import { ResponseNormalizer } from "./responseNormalizer.ts";
import type { ProviderClient } from "./aiProcessingService.ts";

type StreamingRequestPayload = {
  sessionId?: string;
  requestId?: string;
  model?: unknown;
  messages?: unknown;
  [key: string]: unknown;
};

type ProcessableStreamingRequest = StreamingRequestPayload & {
  model: string;
  messages: unknown[];
};

function isProcessableStreamingRequest(
  payload: StreamingRequestPayload
): payload is ProcessableStreamingRequest {
  return typeof payload.model === "string" && Array.isArray(payload.messages);
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

let providerClients: Record<string, ProviderClient> = {};
let modelService: EnhancedModelService | null = null;
let aiProcessingService: AIProcessingService | null = null;
let streamingService: StreamingService | null = null;
let rateLimitService: RateLimitService | null = null;
let cacheService: CacheService | null = null;
let responseNormalizer: ResponseNormalizer | null = null;
type ProcessRequestPayload = Parameters<AIProcessingService["processRequest"]>[0];

function requireService<T>(service: T | null, name: string): T {
  if (!service) {
    throw new Error(`${name} has not been initialized`);
  }

  return service;
}

async function initializeServices() {
  logger.info("Initializing services...");

  try {
    logger.info("Initializing provider clients...");
    providerClients = initializeProviderClients() as Record<string, ProviderClient>;
    logger.info(
      `Initialized ${Object.keys(providerClients).length} provider clients`
    );

    logger.info("Initializing cache service...");
    cacheService = new CacheService();
    await cacheService.initialize();
    logger.info("Cache service initialized");

    logger.info("Initializing enhanced model service...");
    modelService = new EnhancedModelService(providerClients, cacheService);
    await modelService.initialize();
    logger.info("Enhanced model service initialized");

    logger.info("Initializing rate limit service...");
    rateLimitService = new RateLimitService();
    await rateLimitService.initialize();
    logger.info("Rate limit service initialized");

    logger.info("Initializing streaming service...");
    streamingService = new StreamingService();
    await streamingService.initialize();
    logger.info("Streaming service initialized");

    logger.info("Initializing response normalizer...");
    responseNormalizer = new ResponseNormalizer();
    await responseNormalizer.initialize();
    logger.info("Response normalizer initialized");

    logger.info("Initializing AI processing service...");
    const initializedModelService = requireService(
      modelService,
      "Enhanced model service"
    );
    const initializedRateLimitService = requireService(
      rateLimitService,
      "Rate limit service"
    );
    const initializedCacheService = requireService(cacheService, "Cache service");
    const initializedStreamingService = requireService(
      streamingService,
      "Streaming service"
    );
    const initializedResponseNormalizer = requireService(
      responseNormalizer,
      "Response normalizer"
    );

    aiProcessingService = new AIProcessingService(
      providerClients,
      initializedModelService,
      initializedRateLimitService,
      initializedCacheService,
      initializedStreamingService,
      initializedResponseNormalizer
    );
    await aiProcessingService.initialize();
    logger.info("AI processing service initialized");

    initializedStreamingService.on("ai_request", async (payload: StreamingRequestPayload) => {
      const { sessionId, requestId } = payload;
      try {
        if (!isProcessableStreamingRequest(payload)) {
          throw new Error("Invalid AI request payload: model and messages are required");
        }
        const normalizedPayload: ProcessRequestPayload = {
          ...(payload as Record<string, unknown>),
          requestId: requestId ?? `stream-${Date.now()}`,
          model: payload.model,
          messages: payload.messages as ProcessRequestPayload["messages"],
        };
        await requireService(
          aiProcessingService,
          "AI processing service"
        ).processRequest(normalizedPayload);
      } catch (error: unknown) {
        logger.error("Failed to process AI request from stream", {
          requestId,
          error: asErrorMessage(error),
        });
        initializedStreamingService.sendError(
          sessionId ?? "unknown-session",
          error instanceof Error ? error : new Error(asErrorMessage(error)),
          requestId ?? "unknown-request"
        );
      }
    });

    initializedStreamingService.on("stream_stop", ({ sessionId, requestId }: StreamingRequestPayload) => {
      logger.info("Stream stop requested", { sessionId, requestId });
      try {
        const cancelled = requireService(
          aiProcessingService,
          "AI processing service"
        ).cancelStreamingRequest(requestId ?? "");
        if (cancelled) {
          logger.info("Stream cancellation initiated", { requestId });
        } else {
          logger.warn("No active stream to cancel", { requestId });
          initializedStreamingService.sendError(
            sessionId ?? "unknown-session",
            new Error("Cancellation requested but no active stream"),
            requestId ?? "unknown-request"
          );
        }
      } catch (error: unknown) {
        logger.error("Failed to cancel streaming request", {
          requestId,
          error: asErrorMessage(error),
        });
        initializedStreamingService.sendError(
          sessionId ?? "unknown-session",
          error instanceof Error ? error : new Error(asErrorMessage(error)),
          requestId ?? "unknown-request"
        );
      }
    });

    initializedStreamingService.on("stream_pause", ({ sessionId, requestId }: StreamingRequestPayload) => {
      logger.info("Stream pause requested", { sessionId, requestId });
    });

    initializedStreamingService.on("stream_resume", ({ sessionId, requestId }: StreamingRequestPayload) => {
      logger.info("Stream resume requested", { sessionId, requestId });
    });

    logger.info("All services initialized successfully");
  } catch (error: unknown) {
    logger.error("Failed to initialize services", {
      error: asErrorMessage(error),
    });
    throw error;
  }
}

function getProviderClients() {
  return providerClients;
}

function getModelService() {
  return requireService(modelService, "Enhanced model service");
}

function getAIProcessingService() {
  return requireService(aiProcessingService, "AI processing service");
}

function getStreamingService() {
  return requireService(streamingService, "Streaming service");
}

function getRateLimitService() {
  return requireService(rateLimitService, "Rate limit service");
}

function getCacheService() {
  return requireService(cacheService, "Cache service");
}

function getResponseNormalizer() {
  return requireService(responseNormalizer, "Response normalizer");
}

async function shutdownServices() {
  logger.info("Shutting down services...");

  try {
    if (streamingService) {
      logger.info("Shutting down streaming service...");
      await streamingService.shutdown();
    }

    if (rateLimitService) {
      logger.info("Shutting down rate limit service...");
      await rateLimitService.shutdown();
    }

    if (cacheService) {
      logger.info("Shutting down cache service...");
      await cacheService.shutdown();
    }

    if (modelService) {
      logger.info("Shutting down model service...");
      await modelService.shutdown();
    }

    logger.info("All services shut down successfully");
  } catch (error: unknown) {
    logger.error("Error during service shutdown", {
      error: asErrorMessage(error),
    });
    throw error;
  }
}

export {
  initializeServices,
  shutdownServices,
  getProviderClients,
  getModelService,
  getAIProcessingService,
  getStreamingService,
  getRateLimitService,
  getCacheService,
  getResponseNormalizer,
};
