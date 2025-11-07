import express from "express";
import { logger } from "../utils/logger.js";
import { asyncErrorHandler } from "../middleware/errorHandler.js";
import { getAIProcessingService } from "../services/index.js";
import { recordAIRequest } from "../middleware/metrics.js";
import { processReasoningConfig } from "../utils/reasoningConfig.js";
import { getProviderFromModel } from "../utils/validators.js";

function setupProcessRoutes(router) {
  // POST /ai/process - Process AI request (non-streaming)
  router.post(
    "/",
    asyncErrorHandler(async (req, res) => {
      const startTime = Date.now();
      const requestData = req.body;

      logger.info("Processing AI request", {
        requestId: requestData.requestId,
        model: requestData.model,
        stream: requestData.stream,
        userId: requestData.userId,
        guildId: requestData.guildId,
      });

      try {
        const aiService = getAIProcessingService();

        // Process reasoning configuration if provided
        let reasoningOptions = {};
        if (requestData.reasoning) {
          const provider = getProviderFromModel(requestData.model);
          const reasoningResult = processReasoningConfig(
            provider,
            requestData.reasoning
          );
          reasoningOptions = reasoningResult.responseOptions;

          // Apply provider-specific request parameters
          if (reasoningResult.requestParams) {
            requestData.parameters = {
              ...requestData.parameters,
              ...reasoningResult.requestParams,
            };
          }

          // Handle model suffix for NanoGPT
          if (reasoningResult.modelSuffix && provider === "nanogpt") {
            requestData.model = requestData.model + reasoningResult.modelSuffix;
          }
        }

        const result = await aiService.processRequest({
          ...requestData,
          reasoningOptions,
        });

        const duration = (Date.now() - startTime) / 1000;

        // Check if legacy format is requested
        const useLegacyFormat = requestData.legacyFormat || false;

        res.json({
          success: true,
          data: result,
          requestId: requestData.requestId,
          duration: `${duration}s`,
          timestamp: new Date().toISOString(),
          format: useLegacyFormat ? "legacy" : "unified",
        });
      } catch (error) {
        const duration = (Date.now() - startTime) / 1000;

        logger.error("AI request processing failed", {
          requestId: requestData.requestId,
          error: error.message,
          duration: `${duration}s`,
        });

        throw error;
      }
    })
  );

  // POST /ai/process/stream - Process AI request with streaming
  router.post(
    "/stream",
    asyncErrorHandler(async (req, res) => {
      const requestData = req.body;

      logger.info("Processing streaming AI request", {
        requestId: requestData.requestId,
        model: requestData.model,
        userId: requestData.userId,
        guildId: requestData.guildId,
      });

      // For streaming requests, we need to establish WebSocket connection
      // This endpoint will return connection info and session details

      const { getStreamingService } = await import("../services/index.js");
      const streamingService = getStreamingService();

      if (!streamingService) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE_ERROR",
          message: "Streaming service not available",
        });
      }

      // Generate session info for WebSocket connection
      const sessionInfo = {
        requestId: requestData.requestId,
        model: requestData.model,
        userId: requestData.userId,
        guildId: requestData.guildId,
        timestamp: Date.now(),
      };

      res.json({
        success: true,
        message: "Streaming session initiated",
        sessionInfo,
        websocketUrl: `ws://${req.get("host")}/ws`,
        requestId: requestData.requestId,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/process/batch - Process multiple AI requests
  router.post(
    "/batch",
    asyncErrorHandler(async (req, res) => {
      const { requests } = req.body;

      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Requests array is required and must not be empty",
        });
      }

      if (requests.length > 10) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Maximum 10 requests allowed per batch",
        });
      }

      logger.info("Processing batch AI requests", {
        count: requests.length,
      });

      const aiService = getAIProcessingService();
      const results = [];
      const errors = [];

      // Process requests in parallel with limited concurrency
      const promises = requests.map(async (requestData, index) => {
        try {
          const result = await aiService.processRequest(requestData);
          results.push({
            index,
            requestId: requestData.requestId,
            success: true,
            data: result,
          });
        } catch (error) {
          errors.push({
            index,
            requestId: requestData.requestId,
            success: false,
            error: {
              message: error.message,
              code: error.errorCode || "PROCESSING_ERROR",
            },
          });
        }
      });

      await Promise.all(promises);

      res.json({
        success: true,
        results,
        errors,
        total: requests.length,
        successful: results.length,
        failed: errors.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/process/status/:requestId - Get request status
  router.get(
    "/status/:requestId",
    asyncErrorHandler(async (req, res) => {
      const { requestId } = req.params;

      logger.debug("Getting request status", { requestId });

      const aiService = getAIProcessingService();
      const activeRequests = aiService.getActiveRequests();
      const request = activeRequests.find((req) => req.requestId === requestId);

      if (!request) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Active request not found: ${requestId}`,
          requestId,
        });
      }

      res.json({
        requestId,
        status: "active",
        provider: request.provider,
        model: request.model,
        userId: request.userId,
        guildId: request.guildId,
        duration: `${request.duration}ms`,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/process/active - Get all active requests
  router.get(
    "/active",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting active requests");

      const aiService = getAIProcessingService();
      const activeRequests = aiService.getActiveRequests();

      res.json({
        requests: activeRequests,
        count: activeRequests.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/process/cancel/:requestId - Cancel active request
  router.post(
    "/cancel/:requestId",
    asyncErrorHandler(async (req, res) => {
      const { requestId } = req.params;
      const { reason = "User cancelled" } = req.body;

      logger.info("Cancelling request", { requestId, reason });

      const aiService = getAIProcessingService();
      const activeRequests = aiService.getActiveRequests();
      const request = activeRequests.find((req) => req.requestId === requestId);

      if (!request) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Active request not found: ${requestId}`,
          requestId,
        });
      }

      // Cancel the request (implementation depends on provider)
      // For now, we'll just log it
      logger.info("Request cancellation requested", { requestId, reason });

      res.json({
        success: true,
        message: "Request cancellation initiated",
        requestId,
        reason,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/process/health - Get processing service health
  router.get(
    "/health",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting processing service health");

      const aiService = getAIProcessingService();
      const health = aiService.getHealth();

      res.json({
        service: "ai_processing_service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/process/validate - Validate request before processing
  router.post(
    "/validate",
    asyncErrorHandler(async (req, res) => {
      const requestData = req.body;

      logger.info("Validating AI request", {
        requestId: requestData.requestId,
        model: requestData.model,
      });

      try {
        const aiService = getAIProcessingService();
        const modelService = aiService.modelService;

        // Validate model exists
        const modelDetails = modelService.getModelDetails(requestData.model);
        if (!modelDetails) {
          return res.status(404).json({
            error: "NOT_FOUND_ERROR",
            message: `Model not found: ${requestData.model}`,
            model: requestData.model,
            valid: false,
          });
        }

        // Validate capabilities
        const capabilities = requestData.capabilities || {};
        const validation = {
          model: requestData.model,
          exists: true,
          valid: true,
          capabilities: modelDetails.capabilities,
          provider: modelDetails.provider,
        };

        // Check specific capabilities if requested
        if (capabilities.vision && !modelDetails.capabilities.vision) {
          validation.valid = false;
          validation.errors = validation.errors || [];
          validation.errors.push("Model does not support vision capabilities");
        }

        if (capabilities.tools && !modelDetails.capabilities.tools) {
          validation.valid = false;
          validation.errors = validation.errors || [];
          validation.errors.push("Model does not support tool capabilities");
        }

        if (capabilities.reasoning && !modelDetails.capabilities.reasoning) {
          validation.valid = false;
          validation.errors = validation.errors || [];
          validation.errors.push(
            "Model does not support reasoning capabilities"
          );
        }

        // Check rate limits
        const provider = modelService.getModelProvider(requestData.model);
        const rateLimitService = aiService.rateLimitService;

        const providerLimit = await rateLimitService.checkProviderLimit(
          provider
        );
        if (!providerLimit.allowed) {
          validation.valid = false;
          validation.errors = validation.errors || [];
          validation.errors.push(
            `Rate limit exceeded for provider: ${provider}`
          );
        }

        if (requestData.userId) {
          const userLimit = await rateLimitService.checkUserLimit(
            requestData.userId
          );
          if (!userLimit.allowed) {
            validation.valid = false;
            validation.errors = validation.errors || [];
            validation.errors.push(
              `Rate limit exceeded for user: ${requestData.userId}`
            );
          }
        }

        res.json({
          validation,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Request validation failed", {
          requestId: requestData.requestId,
          error: error.message,
        });

        throw error;
      }
    })
  );

  // GET /ai/process/providers - Get supported providers
  router.get(
    "/providers",
    asyncErrorHandler(async (req, res) => {
      logger.info("Getting supported providers");

      const { getAvailableProviders } = await import("../utils/providers.js");
      const providers = getAvailableProviders();

      res.json({
        providers,
        count: providers.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/process/providers/:provider/models - Get models for provider
  router.get(
    "/providers/:provider/models",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;
      const { capability } = req.query;

      logger.info("Getting models for provider", { provider, capability });

      const { getProviderModels } = await import("../utils/providers.js");
      const models = getProviderModels(provider, capability);

      res.json({
        provider,
        models,
        count: models.length,
        capability,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/process/providers/:provider/capabilities - Get provider capabilities
  router.get(
    "/providers/:provider/capabilities",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;

      logger.info("Getting provider capabilities", { provider });

      const { getProviderConfig } = await import("../utils/providers.js");
      const config = getProviderConfig(provider);

      if (!config) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Provider not found: ${provider}`,
          provider,
        });
      }

      res.json({
        provider: provider,
        capabilities: config.capabilities,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/process/generate-image - Generate images
  router.post(
    "/generate-image",
    asyncErrorHandler(async (req, res) => {
      const {
        prompt,
        model,
        parameters = {},
        requestId,
        userId,
        guildId,
      } = req.body;

      if (!prompt) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Prompt is required for image generation",
        });
      }

      logger.info("Processing image generation request", {
        requestId,
        model,
        userId,
        guildId,
        promptLength: prompt.length,
      });

      const aiService = getAIProcessingService();

      // Check if the model supports image generation
      const modelService = aiService.modelService;
      const modelDetails = modelService.getModelDetails(model);

      if (!modelDetails || !modelDetails.capabilities.imageGeneration) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Model does not support image generation",
          model,
        });
      }

      try {
        const result = await aiService.processImageGeneration({
          requestId,
          model,
          prompt,
          parameters,
          userId,
          guildId,
        });

        res.json({
          success: true,
          data: result,
          requestId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Image generation failed", {
          requestId,
          error: error.message,
        });

        throw error;
      }
    })
  );

  // POST /ai/process/transcribe - Transcribe audio to text
  router.post(
    "/transcribe",
    asyncErrorHandler(async (req, res) => {
      const {
        audio,
        model,
        parameters = {},
        requestId,
        userId,
        guildId,
      } = req.body;

      if (!audio) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Audio data is required for transcription",
        });
      }

      logger.info("Processing speech transcription request", {
        requestId,
        model,
        userId,
        guildId,
      });

      const aiService = getAIProcessingService();

      // Check if the model supports speech recognition
      const modelService = aiService.modelService;
      const modelDetails = modelService.getModelDetails(model);

      if (!modelDetails || !modelDetails.capabilities.speechRecognition) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Model does not support speech recognition",
          model,
        });
      }

      try {
        const result = await aiService.processSpeechRecognition({
          requestId,
          model,
          audio,
          parameters,
          userId,
          guildId,
        });

        res.json({
          success: true,
          data: result,
          requestId,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Speech transcription failed", {
          requestId,
          error: error.message,
        });

        throw error;
      }
    })
  );

  // POST /ai/process/test - Test endpoint for development
  router.post(
    "/test",
    asyncErrorHandler(async (req, res) => {
      const { echo = false, delay = 0, error = false } = req.body;

      logger.info("Processing test request", { echo, delay, error });

      if (error) {
        throw new Error("Test error requested");
      }

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const response = {
        message: "Test request processed successfully",
        echo: echo ? req.body : undefined,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      };

      res.json(response);
    })
  );
}

export { setupProcessRoutes };
