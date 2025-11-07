import express from "express";
import { logger } from "../utils/logger.js";
import { asyncErrorHandler } from "../middleware/errorHandler.js";
import { getModelService, getCacheService } from "../services/index.js";

function setupModelRoutes(router) {
  // Specific endpoints that should take precedence over generic provider route
  // GET /ai/models/search - Search models
  router.get(
    "/search",
    asyncErrorHandler(async (req, res) => {
      const { q: query, provider, capability, active, preferred } = req.query;

      if (!query) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: 'Query parameter "q" is required',
        });
      }

      logger.info("Searching models", {
        query,
        provider,
        capability,
        active,
        preferred,
      });

      const modelService = getModelService();
      const filters = {};

      if (provider) filters.provider = provider;
      if (capability) filters.capability = capability;
      if (active !== undefined) filters.active = active === "true";
      if (preferred !== undefined) filters.preferred = preferred === "true";

      const results = modelService.searchModels(query, filters);

      res.json({
        query,
        results,
        count: results.length,
        filters,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/by-price - Get models by price range
  router.get(
    "/by-price",
    asyncErrorHandler(async (req, res) => {
      const { min = 0, max, capability, provider, limit = 50 } = req.query;

      logger.info("Getting models by price range", {
        min,
        max,
        capability,
        provider,
        limit,
      });

      const modelService = getModelService();

      const minPrice = parseFloat(min) || 0;
      const maxPrice = max ? parseFloat(max) : Infinity;
      const modelLimit = parseInt(limit) || 50;

      let models = modelService.getModelsByPriceRange(minPrice, maxPrice);

      // Apply additional filters
      if (capability) {
        models = models.filter(
          (model) => model.capabilities[capability] === true
        );
      }

      if (provider) {
        models = models.filter((model) => model.provider === provider);
      }

      // Limit results
      models = models.slice(0, modelLimit);

      res.json({
        models,
        count: models.length,
        priceRange: { min: minPrice, max: maxPrice },
        filters: { capability, provider, limit: modelLimit },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/cheapest - Get cheapest models
  router.get(
    "/cheapest",
    asyncErrorHandler(async (req, res) => {
      const { limit = 10, capability } = req.query;

      logger.info("Getting cheapest models", {
        limit,
        capability,
      });

      const modelService = getModelService();
      const modelLimit = parseInt(limit) || 10;

      const models = modelService.getCheapestModels(modelLimit, capability);

      res.json({
        models,
        count: models.length,
        filters: { limit: modelLimit, capability },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/most-expensive - Get most expensive models
  router.get(
    "/most-expensive",
    asyncErrorHandler(async (req, res) => {
      const { limit = 10, capability } = req.query;

      logger.info("Getting most expensive models", {
        limit,
        capability,
      });

      const modelService = getModelService();
      const modelLimit = parseInt(limit) || 10;

      const models = modelService.getMostExpensiveModels(
        modelLimit,
        capability
      );

      res.json({
        models,
        count: models.length,
        filters: { limit: modelLimit, capability },
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/pricing-summary - Get pricing summary
  router.get(
    "/pricing-summary",
    asyncErrorHandler(async (req, res) => {
      logger.info("Getting pricing summary");

      const modelService = getModelService();
      const stats = modelService.getModelStats();

      // Calculate pricing statistics
      const allModels = await modelService.getAvailableModels();
      const models = allModels.filter((model) => model.pricing);

      const prices = models.map((model) => {
        const prompt = model.pricing.prompt || 0;
        const completion = model.pricing.completion || 0;
        return prompt + completion;
      });

      const pricingStats = {
        totalModelsWithPricing: models.length,
        averagePrice:
          prices.length > 0
            ? prices.reduce((a, b) => a + b, 0) / prices.length
            : 0,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        medianPrice: prices.length > 0 ? calculateMedian(prices) : 0,
        byCostCategory: stats.byCostCategory,
      };

      res.json({
        pricingStats,
        totalModels: stats.total,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models - Get all available models
  router.get(
    "/",
    asyncErrorHandler(async (req, res) => {
      const {
        capability,
        provider,
        refresh = false,
        maxPricePerMillion,
        minContextLength,
        costCategory,
        sortBy,
        sortOrder = "asc",
      } = req.query;

      logger.info("Getting available models", {
        capability,
        provider,
        refresh,
        maxPricePerMillion,
        minContextLength,
        costCategory,
        sortBy,
        sortOrder,
      });

      const modelService = getModelService();

      // Build filters object
      const filters = {};
      if (maxPricePerMillion !== undefined) {
        filters.maxPricePerMillion = parseFloat(maxPricePerMillion);
      }
      if (minContextLength !== undefined) {
        filters.minContextLength = parseInt(minContextLength);
      }
      if (costCategory !== undefined) {
        filters.costCategory = costCategory;
      }
      if (sortBy !== undefined) {
        filters.sortBy = sortBy;
        filters.sortOrder = sortOrder;
      }

      const models = await modelService.getAvailableModels(
        capability,
        provider,
        filters
      );

      res.json({
        models,
        count: models.length,
        filters: { capability, provider, ...filters },
        cached: !refresh,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/:provider - Get models by provider
  router.get(
    "/:provider",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;
      const { capability, refresh = false } = req.query;

      logger.info("Getting models by provider", {
        provider,
        capability,
        refresh,
      });

      const modelService = getModelService();
      const models = await modelService.getAvailableModels(
        capability,
        provider
      );

      if (models.length === 0) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `No models found for provider: ${provider}`,
          provider,
          capability,
        });
      }

      res.json({
        models,
        count: models.length,
        provider,
        capability,
        cached: !refresh,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/details/:modelId - Get model details
  router.get(
    "/details/:modelId",
    asyncErrorHandler(async (req, res) => {
      const { modelId } = req.params;

      logger.info("Getting model details", { modelId });

      const modelService = getModelService();
      const model = modelService.getModelDetails(modelId);

      if (!model) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Model not found: ${modelId}`,
          modelId,
        });
      }

      res.json({
        model,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/capabilities/:modelId - Get model capabilities
  router.get(
    "/capabilities/:modelId",
    asyncErrorHandler(async (req, res) => {
      const { modelId } = req.params;

      logger.info("Getting model capabilities", { modelId });

      const modelService = getModelService();
      const capabilities = modelService.getModelCapabilities(modelId);

      res.json({
        modelId,
        capabilities,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/models/refresh - Refresh model cache
  router.post(
    "/refresh",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.body;

      logger.info("Refreshing model cache", { provider });

      const modelService = getModelService();

      if (provider) {
        // Refresh specific provider
        await modelService.refreshProviderModels(provider);
      } else {
        // Refresh all providers
        await modelService.refreshModels();
      }

      const stats = modelService.getModelStats();

      res.json({
        message: "Model cache refreshed successfully",
        stats,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/stats - Get model statistics
  router.get(
    "/stats",
    asyncErrorHandler(async (req, res) => {
      logger.info("Getting model statistics");

      const modelService = getModelService();
      const stats = modelService.getModelStats();

      res.json({
        stats,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/health - Get model service health
  router.get(
    "/health",
    asyncErrorHandler(async (req, res) => {
      logger.debug("Getting model service health");

      const modelService = getModelService();
      const health = modelService.getHealth();

      res.json({
        service: "model_service",
        ...health,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/cache/:provider - Get cached models for provider
  router.get(
    "/cache/:provider",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;

      logger.debug("Getting cached models for provider", { provider });

      const cacheService = getCacheService();
      const cacheKey = `models:${provider}`;
      const cached = await cacheService.get(cacheKey);

      if (!cached) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `No cached models found for provider: ${provider}`,
          provider,
        });
      }

      res.json({
        provider,
        models: cached.models,
        cachedAt: cached.timestamp,
        age: Date.now() - cached.timestamp,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // DELETE /ai/models/cache/:provider - Clear cached models for provider
  router.delete(
    "/cache/:provider",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;

      logger.info("Clearing cached models for provider", { provider });

      const cacheService = getCacheService();
      const cacheKey = `models:${provider}`;
      const deleted = await cacheService.del(cacheKey);

      res.json({
        message: deleted ? "Cache cleared successfully" : "Cache not found",
        provider,
        deleted,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // POST /ai/models/validate - Validate model configuration
  router.post(
    "/validate",
    asyncErrorHandler(async (req, res) => {
      const { model, capability } = req.body;

      if (!model) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Model is required",
        });
      }

      logger.info("Validating model configuration", { model, capability });

      const modelService = getModelService();
      const modelDetails = modelService.getModelDetails(model);

      if (!modelDetails) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Model not found: ${model}`,
          model,
          valid: false,
        });
      }

      const validation = {
        model,
        exists: true,
        valid: true,
        capabilities: modelDetails.capabilities,
        provider: modelDetails.provider,
      };

      if (capability) {
        validation.supportsCapability = modelService.modelSupportsCapability(
          model,
          capability
        );
        validation.valid = validation.supportsCapability;
      }

      res.json({
        validation,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/providers - Get available providers
  router.get(
    "/providers",
    asyncErrorHandler(async (req, res) => {
      logger.info("Getting available providers");

      const { getAvailableProviders } = await import("../utils/providers.js");
      const providers = getAvailableProviders();

      res.json({
        providers,
        count: providers.length,
        timestamp: new Date().toISOString(),
      });
    })
  );

  // GET /ai/models/providers/:provider - Get provider details
  router.get(
    "/providers/:provider",
    asyncErrorHandler(async (req, res) => {
      const { provider } = req.params;

      logger.info("Getting provider details", { provider });

      const { getProviderConfig } = await import("../utils/providers.js");
      const config = getProviderConfig(provider);

      if (!config) {
        return res.status(404).json({
          error: "NOT_FOUND_ERROR",
          message: `Provider not found: ${provider}`,
          provider,
        });
      }

      // Return public provider info (without API keys)
      const publicConfig = {
        name: config.name,
        displayName: config.displayName,
        capabilities: config.capabilities,
        models: config.models,
        parameters: config.parameters,
        rateLimit: config.rateLimit,
      };

      res.json({
        provider: publicConfig,
        timestamp: new Date().toISOString(),
      });
    })
  );
}

// Helper function to calculate median
function calculateMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export { setupModelRoutes };
