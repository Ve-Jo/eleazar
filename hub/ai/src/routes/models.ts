import express from "express";
import type { Request, Response, Router } from "express";
import { logger } from "../utils/logger.ts";
import { asyncErrorHandler } from "../middleware/errorHandler.ts";
import { getModelService, getCacheService } from "../services/index.ts";

type ModelSummary = {
  provider?: string;
  name?: string;
  pricing?: {
    prompt?: number;
    completion?: number;
  };
  capabilities?: Record<string, boolean>;
};

type ModelRouteQuery = Record<string, string | undefined>;

type ModelRouteRequest = Request<
  Record<string, string>,
  unknown,
  Record<string, unknown>,
  ModelRouteQuery
>;

type ModelRouteResponse = Response;

function setupModelRoutes(router: Router) {
  // Specific endpoints that should take precedence over generic provider route
  // GET /ai/models/search - Search models
  router.get(
    "/search",
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
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
      const filters: Record<string, any> = {};

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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { min, max, capability, provider, limit } = req.query;

      logger.info("Getting models by price range", {
        min,
        max,
        capability,
        provider,
        limit,
      });

      const modelService = getModelService();

      const minPrice = parseFloat(min ?? "0") || 0;
      const maxPrice = max ? parseFloat(max) : Infinity;
      const modelLimit = parseInt(limit ?? "50") || 50;

      let models = modelService.getModelsByPriceRange(
        minPrice,
        maxPrice
      ) as ModelSummary[];

      // Apply additional filters
      if (capability) {
        models = models.filter(
          (model) => model.capabilities?.[capability] === true
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { limit, capability } = req.query;

      logger.info("Getting cheapest models", {
        limit,
        capability,
      });

      const modelService = getModelService();
      const modelLimit = parseInt(limit ?? "10") || 10;

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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { limit, capability } = req.query;

      logger.info("Getting most expensive models", {
        limit,
        capability,
      });

      const modelService = getModelService();
      const modelLimit = parseInt(limit ?? "10") || 10;

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
    asyncErrorHandler(async (_req: ModelRouteRequest, res: ModelRouteResponse) => {
      logger.info("Getting pricing summary");

      const modelService = getModelService();
      const stats = modelService.getModelStats();

      // Calculate pricing statistics
      const allModels = await modelService.getAvailableModels();
      const models = (allModels as ModelSummary[]).filter(
        (model): model is ModelSummary & { pricing: NonNullable<ModelSummary["pricing"]> } =>
          !!model.pricing
      );

      const prices = models.map((model) => {
        const prompt = model.pricing.prompt || 0;
        const completion = model.pricing.completion || 0;
        return prompt + completion;
      });

      const pricingStats = {
        totalModelsWithPricing: models.length,
        averagePrice:
          prices.length > 0
            ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
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
      const filters: Record<string, any> = {};
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { modelId } = req.params;

      logger.info("Getting model details", { modelId });

      const modelService = getModelService();
      if (!modelId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Model ID is required",
        });
      }

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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { modelId } = req.params;

      logger.info("Getting model capabilities", { modelId });

      if (!modelId) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Model ID is required",
        });
      }

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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { provider } = req.body;

      logger.info("Refreshing model cache", { provider });

      const modelService = getModelService();

      if (typeof provider === "string" && provider.length > 0) {
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
    asyncErrorHandler(async (_req: ModelRouteRequest, res: ModelRouteResponse) => {
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
    asyncErrorHandler(async (_req: ModelRouteRequest, res: ModelRouteResponse) => {
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const model = typeof req.body.model === "string" ? req.body.model : "";
      const capability =
        typeof req.body.capability === "string" ? req.body.capability : undefined;

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

      const validation: Record<string, unknown> = {
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
    asyncErrorHandler(async (_req: ModelRouteRequest, res: ModelRouteResponse) => {
      logger.info("Getting available providers");

      const { getAvailableProviders } = await import("../utils/providers.ts");
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
    asyncErrorHandler(async (req: ModelRouteRequest, res: ModelRouteResponse) => {
      const { provider } = req.params;

      logger.info("Getting provider details", { provider });

      const { getProviderConfig } = await import("../utils/providers.ts");
      if (!provider) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Provider is required",
        });
      }

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
function calculateMedian(arr: number[]) {
  if (arr.length === 0) {
    return 0;
  }
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const midValue = sorted[mid] ?? 0;
  const lowerValue = sorted[mid - 1] ?? midValue;
  return sorted.length % 2 !== 0 ? midValue : (lowerValue + midValue) / 2;
}

export { setupModelRoutes };
