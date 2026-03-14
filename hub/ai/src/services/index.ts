import { logger } from "../utils/logger.ts";
import { initializeProviderClients } from "../utils/providers.ts";
import { EnhancedModelService } from "./modelService.ts";
import { AIProcessingService } from "./aiProcessingService.ts";
import { StreamingService } from "./streamingService.ts";
import { RateLimitService } from "./rateLimitService.ts";
import { CacheService } from "./cacheService.ts";
import { ResponseNormalizer } from "./responseNormalizer.ts";
import type { ProviderClient } from "./aiProcessingService.ts";

let providerClients: Record<string, ProviderClient> = {};
let modelService: EnhancedModelService | null = null;
let aiProcessingService: AIProcessingService | null = null;
let streamingService: StreamingService | null = null;
let rateLimitService: RateLimitService | null = null;
let cacheService: CacheService | null = null;
let responseNormalizer: ResponseNormalizer | null = null;

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

    initializedStreamingService.on("ai_request", async (payload: any) => {
      const { sessionId, requestId } = payload;
      try {
        await requireService(
          aiProcessingService,
          "AI processing service"
        ).processRequest(payload);
      } catch (error: any) {
        logger.error("Failed to process AI request from stream", {
          requestId,
          error: error.message,
        });
        initializedStreamingService.sendError(sessionId, error, requestId);
      }
    });

    initializedStreamingService.on("stream_stop", ({ sessionId, requestId }: any) => {
      logger.info("Stream stop requested", { sessionId, requestId });
      try {
        const cancelled = requireService(
          aiProcessingService,
          "AI processing service"
        ).cancelStreamingRequest(requestId);
        if (cancelled) {
          logger.info("Stream cancellation initiated", { requestId });
        } else {
          logger.warn("No active stream to cancel", { requestId });
          initializedStreamingService.sendError(
            sessionId,
            new Error("Cancellation requested but no active stream"),
            requestId
          );
        }
      } catch (error: any) {
        logger.error("Failed to cancel streaming request", {
          requestId,
          error: error.message,
        });
        initializedStreamingService.sendError(sessionId, error, requestId);
      }
    });

    initializedStreamingService.on("stream_pause", ({ sessionId, requestId }: any) => {
      logger.info("Stream pause requested", { sessionId, requestId });
    });

    initializedStreamingService.on("stream_resume", ({ sessionId, requestId }: any) => {
      logger.info("Stream resume requested", { sessionId, requestId });
    });

    logger.info("All services initialized successfully");
  } catch (error: any) {
    logger.error("Failed to initialize services", { error: error.message });
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
  } catch (error: any) {
    logger.error("Error during service shutdown", { error: error.message });
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
