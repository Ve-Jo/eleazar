import { logger } from "../utils/logger.js";
import { initializeProviderClients } from "../utils/providers.js";
import { EnhancedModelService } from "./modelService.js";
import { AIProcessingService } from "./aiProcessingService.js";
import { StreamingService } from "./streamingService.js";
import { RateLimitService } from "./rateLimitService.js";
import { CacheService } from "./cacheService.js";
import { ResponseNormalizer } from "./responseNormalizer.js";

// Global service instances
let providerClients = {};
let modelService = null;
let aiProcessingService = null;
let streamingService = null;
let rateLimitService = null;
let cacheService = null;
let responseNormalizer = null;

// Initialize all services
async function initializeServices() {
  logger.info("Initializing services...");

  try {
    // Initialize provider clients
    logger.info("Initializing provider clients...");
    providerClients = initializeProviderClients();
    logger.info(
      `Initialized ${Object.keys(providerClients).length} provider clients`
    );

    // Initialize cache service
    logger.info("Initializing cache service...");
    cacheService = new CacheService();
    await cacheService.initialize();
    logger.info("Cache service initialized");

    // Initialize enhanced model service
    logger.info("Initializing enhanced model service...");
    modelService = new EnhancedModelService(providerClients, cacheService);
    await modelService.initialize();
    logger.info("Enhanced model service initialized");

    // Initialize rate limit service
    logger.info("Initializing rate limit service...");
    rateLimitService = new RateLimitService();
    await rateLimitService.initialize();
    logger.info("Rate limit service initialized");

    // Initialize streaming service
    logger.info("Initializing streaming service...");
    streamingService = new StreamingService();
    await streamingService.initialize();
    logger.info("Streaming service initialized");

    // Initialize response normalizer
    logger.info("Initializing response normalizer...");
    responseNormalizer = new ResponseNormalizer();
    await responseNormalizer.initialize();
    logger.info("Response normalizer initialized");

    // Initialize AI processing service
    logger.info("Initializing AI processing service...");
    aiProcessingService = new AIProcessingService(
      providerClients,
      modelService,
      rateLimitService,
      cacheService,
      streamingService,
      responseNormalizer
    );
    await aiProcessingService.initialize();
    logger.info("AI processing service initialized");

    // Wire StreamingService events to AIProcessingService
    streamingService.on("ai_request", async (payload) => {
      const { sessionId, requestId } = payload;
      try {
        await aiProcessingService.processRequest(payload);
      } catch (error) {
        logger.error("Failed to process AI request from stream", {
          requestId,
          error: error.message,
        });
        // Notify client of error
        streamingService.sendError(sessionId, error, requestId);
      }
    });

    // Handle stream stop: cancel active streaming request
    streamingService.on("stream_stop", ({ sessionId, requestId }) => {
      logger.info("Stream stop requested", { sessionId, requestId });
      try {
        const cancelled = aiProcessingService.cancelStreamingRequest(requestId);
        if (cancelled) {
          logger.info("Stream cancellation initiated", { requestId });
          // processStreamingResponse will send stream_complete with 'cancelled'
        } else {
          logger.warn("No active stream to cancel", { requestId });
          // Inform client that cancellation could not be performed
          streamingService.sendError(
            sessionId,
            new Error("Cancellation requested but no active stream"),
            requestId
          );
        }
      } catch (error) {
        logger.error("Failed to cancel streaming request", {
          requestId,
          error: error.message,
        });
        streamingService.sendError(sessionId, error, requestId);
      }
    });

    streamingService.on("stream_pause", ({ sessionId, requestId }) => {
      logger.info("Stream pause requested", { sessionId, requestId });
      // Future: implement pause
    });

    streamingService.on("stream_resume", ({ sessionId, requestId }) => {
      logger.info("Stream resume requested", { sessionId, requestId });
      // Future: implement resume
    });

    logger.info("All services initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize services", { error: error.message });
    throw error;
  }
}

// Get service instances
function getProviderClients() {
  return providerClients;
}

function getModelService() {
  return modelService;
}

function getAIProcessingService() {
  return aiProcessingService;
}

function getStreamingService() {
  return streamingService;
}

function getRateLimitService() {
  return rateLimitService;
}

function getCacheService() {
  return cacheService;
}

function getResponseNormalizer() {
  return responseNormalizer;
}

// Graceful shutdown
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
  } catch (error) {
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
