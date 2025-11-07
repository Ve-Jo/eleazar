import { logger } from "../utils/logger.js";
import { ModelFetcher } from "./modelFetcher.js";
import { MultimediaModelsService } from "./multimediaModels.js";
import {
  getProviderModels,
  getProviderConfig,
  modelSupportsCapability,
  formatModelName,
  parseModelName,
} from "../utils/providers.js";
import {
  recordModelCacheHit,
  recordModelCacheMiss,
} from "../middleware/metrics.js";

/**
 * Enhanced Model Service with Dynamic Fetching and Price Filtering
 */
class EnhancedModelService {
  constructor(providerClients, cacheService) {
    this.providerClients = providerClients;
    this.cacheService = cacheService;
    this.modelFetcher = new ModelFetcher();
    this.multimediaService = new MultimediaModelsService();
    this.models = new Map(); // In-memory model cache
    this.modelCapabilities = new Map(); // Model capabilities cache
    this.lastFetchTime = 0;
    this.cacheDuration = parseInt(process.env.MODEL_CACHE_TTL || "600000"); // 10 minutes
    this.refreshInterval = parseInt(
      process.env.MODEL_REFRESH_INTERVAL || "3600000"
    ); // 1 hour
    this.refreshTimer = null;
    this.fallbackToStatic = true; // Use static configs as fallback
  }

  async initialize() {
    logger.info("Initializing enhanced model service...");

    try {
      // Initial model fetch
      await this.refreshModels();

      // Start refresh timer
      this.startRefreshTimer();

      logger.info("Enhanced model service initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize enhanced model service", {
        error: error.message,
      });
      throw error;
    }
  }

  async shutdown() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    logger.info("Enhanced model service shut down");
  }

  // Start automatic refresh timer
  startRefreshTimer() {
    this.refreshTimer = setInterval(async () => {
      try {
        logger.info("Auto-refreshing models...");
        await this.refreshModels();
      } catch (error) {
        logger.error("Auto-refresh failed", { error: error.message });
      }
    }, this.refreshInterval);

    logger.info(
      `Model refresh timer started (interval: ${this.refreshInterval}ms)`
    );
  }

  // Refresh models from all providers
  async refreshModels() {
    logger.info("Refreshing models from providers...");

    const startTime = Date.now();
    const allModels = [];
    const errors = [];

    // Try dynamic fetching first
    for (const [providerName, client] of Object.entries(this.providerClients)) {
      try {
        logger.debug(
          `Fetching models from ${providerName}... client: ${
            client ? "exists" : "null"
          }`
        );
        if (providerName === "nanogpt") {
          logger.debug(
            `NanoGPT provider detected - hasConfig: ${!!getProviderConfig(
              providerName
            )}, apiKey: ${!!getProviderConfig(providerName)?.apiKey}`
          );
        }

        // NanoGPT will be fetched via the standard dynamic fetcher

        const models = await this.fetchModelsFromProvider(providerName, client);
        allModels.push(...models);
        logger.debug(`Fetched ${models.length} models from ${providerName}`);
      } catch (error) {
        logger.error(`Failed to fetch models from ${providerName}`, {
          error: error.message,
        });
        errors.push({ provider: providerName, error: error.message });

        // Fallback to static models if enabled
        if (this.fallbackToStatic) {
          try {
            logger.info(`Falling back to static models for ${providerName}`);
            const staticModels = await this.getStaticModels(providerName);
            allModels.push(...staticModels);
          } catch (fallbackError) {
            logger.error(`Static fallback failed for ${providerName}`, {
              error: fallbackError.message,
            });
          }
        }
      }
    }

    // Update in-memory cache
    this.updateModelCache(allModels);

    const duration = Date.now() - startTime;
    logger.info(`Model refresh completed in ${duration}ms`, {
      totalModels: allModels.length,
      errors: errors.length,
    });

    if (errors.length > 0) {
      logger.warn("Some providers failed during model refresh", { errors });
    }

    this.lastFetchTime = Date.now();
  }

  // Fetch models from a specific provider
  async fetchModelsFromProvider(providerName, client) {
    const cacheKey = `models:${providerName}`;

    // Check cache first
    const cachedModels = await this.cacheService.get(cacheKey);
    if (
      cachedModels &&
      Date.now() - cachedModels.timestamp < this.cacheDuration
    ) {
      recordModelCacheHit(providerName);
      logger.debug(`Using cached models for ${providerName}`);
      return cachedModels.models;
    }

    recordModelCacheMiss(providerName);

    try {
      let models = [];
      const providerConfig = getProviderConfig(providerName);

      if (!providerConfig) {
        throw new Error(`Unknown provider: ${providerName}`);
      }

      // Try dynamic fetching first
      if (providerConfig.apiKey && this.supportsDynamicFetching(providerName)) {
        try {
          models = await this.fetchModelsDynamically(
            providerName,
            providerConfig.apiKey
          );
          logger.info(
            `Dynamically fetched ${models.length} models from ${providerName}`
          );
        } catch (error) {
          logger.warn(
            `Dynamic fetching failed for ${providerName}, trying API fallback`,
            {
              error: error.message,
            }
          );

          // Try API model listing as fallback
          if (client && providerConfig.capabilities.modelListing) {
            models = await this.fetchModelsFromAPI(providerName, client);
          } else {
            throw error;
          }
        }
      } else if (client && providerConfig.capabilities.modelListing) {
        // Use API model listing
        models = await this.fetchModelsFromAPI(providerName, client);
      } else {
        // Use configured models as fallback
        models = this.getConfiguredModels(providerName);
      }

      // Cache the results
      await this.cacheService.set(
        cacheKey,
        {
          models,
          timestamp: Date.now(),
        },
        this.cacheDuration
      );

      return models;
    } catch (error) {
      logger.error(`Failed to fetch models from ${providerName}`, {
        error: error.message,
      });

      // Final fallback to configured models
      return this.getConfiguredModels(providerName);
    }
  }

  // Check if provider supports dynamic fetching
  supportsDynamicFetching(providerName) {
    const dynamicProviders = ["nanogpt", "openrouter", "groq"];
    return dynamicProviders.includes(providerName);
  }

  // Fetch models dynamically using ModelFetcher
  async fetchModelsDynamically(providerName, apiKey) {
    switch (providerName) {
      case "nanogpt":
        logger.debug(
          "fetchModelsDynamically: Fetching NanoGPT models via ModelFetcher"
        );
        return await this.modelFetcher.fetchNanoGPTModels(apiKey);

      case "openrouter":
        return await this.modelFetcher.fetchOpenRouterModels(apiKey);

      case "groq":
        return await this.modelFetcher.fetchGroqModels(apiKey);

      default:
        throw new Error(`Dynamic fetching not supported for ${providerName}`);
    }
  }

  // Fetch models from provider API (existing method)
  async fetchModelsFromAPI(providerName, client) {
    try {
      const response = await client.models.list();
      const models = response.data || response;

      return models.map((model) => this.processAPIModel(providerName, model));
    } catch (error) {
      logger.warn(`API model listing not available for ${providerName}`, {
        error: error.message,
      });
      return this.getConfiguredModels(providerName);
    }
  }

  // Process model data from API
  processAPIModel(providerName, model) {
    const providerConfig = getProviderConfig(providerName);
    const modelId = model.id || model.name;

    // Determine capabilities
    const maxContext = this.detectMaxContext(providerName, modelId, model);
    logger.debug(
      `[processAPIModel] Processing ${providerName}/${modelId}, maxContext: ${maxContext}`,
      {
        modelId,
        providerName,
        context_window: model.context_window,
        context_length: model.context_length,
        max_context: model.max_context,
        maxContext: maxContext,
      }
    );

    const capabilities = {
      vision: this.detectVisionCapability(providerName, modelId, model),
      tools: this.detectToolsCapability(providerName, modelId, model),
      reasoning: this.detectReasoningCapability(providerName, modelId, model),
      imageGeneration: false, // Will be handled by multimedia service
      speechRecognition: false, // Will be handled by multimedia service
      maxContext: maxContext,
    };

    return {
      id: modelId,
      name: formatModelName(model, providerName),
      provider: providerName,
      capabilities,
      pricing: model.pricing || null,
      active: model.active !== false,
      isPreferred: this.isPreferredModel(providerName, modelId),
      isFeatured: model.isFeatured || false, // Include featured status from model fetcher
    };
  }

  // Get static models from configuration (fallback) - returns empty array
  getConfiguredModels(providerName) {
    // Return empty array to avoid hardcoded models
    // The system should rely entirely on dynamic fetching
    return [];
  }

  // Get static models as fallback
  async getStaticModels(providerName) {
    return this.getConfiguredModels(providerName);
  }

  // Capability detection methods (same as original)
  detectVisionCapability(providerName, modelId, model) {
    const providerConfig = getProviderConfig(providerName);

    // Check if explicitly in vision models list
    if (providerConfig.models.vision.includes(modelId)) {
      return true;
    }

    // Check model name patterns
    const visionPatterns = [
      "vision",
      "vl",
      "gpt-4o",
      "claude-3",
      "gemini-pro-vision",
    ];
    const lowerModelId = modelId.toLowerCase();

    return visionPatterns.some((pattern) => lowerModelId.includes(pattern));
  }

  detectToolsCapability(providerName, modelId, model) {
    const providerConfig = getProviderConfig(providerName);
    return providerConfig.capabilities.tools;
  }

  detectReasoningCapability(providerName, modelId, model) {
    // Check model name patterns for reasoning capabilities
    const reasoningPatterns = ["reason", "o1", "thinking"];
    const lowerModelId = modelId.toLowerCase();

    return reasoningPatterns.some((pattern) => lowerModelId.includes(pattern));
  }

  detectMaxContext(providerName, modelId, model) {
    // Try to get from model metadata - check multiple possible fields
    if (model.context_window) return model.context_window;
    if (model.context_length) return model.context_length;
    if (model.max_context) return model.max_context;
    if (model.maxContext) return model.maxContext;

    // Check nested fields
    if (model.architecture?.context_length)
      return model.architecture.context_length;
    if (model.architecture?.context_window)
      return model.architecture.context_window;
    if (model.top_provider?.context_length)
      return model.top_provider.context_length;

    // Check capabilities object
    if (model.capabilities?.maxContext) return model.capabilities.maxContext;
    if (model.capabilities?.context_length)
      return model.capabilities.context_length;
    if (model.capabilities?.context_window)
      return model.capabilities.context_window;

    // Default based on provider
    const providerConfig = getProviderConfig(providerName);
    return providerConfig.parameters.max_tokens?.default || 8192;
  }

  isPreferredModel(providerName, modelId) {
    // Since we removed hardcoded models, all dynamically fetched models are considered preferred
    // This ensures they show up in listings and are available for use
    return true;
  }

  // Update in-memory model cache
  updateModelCache(models) {
    const startTime = Date.now();

    // Clear existing cache
    this.models.clear();
    this.modelCapabilities.clear();

    // Add models to cache
    for (const model of models) {
      this.models.set(model.name, model);
      this.modelCapabilities.set(model.name, model.capabilities);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Model cache updated with ${models.length} models in ${duration}ms`
    );
  }

  // Get all available models with optional filtering
  async getAvailableModels(capability = null, provider = null, filters = {}) {
    let models = Array.from(this.models.values());

    // Initial debug logging for featured models
    const totalModels = models.length;
    const initialFeaturedCount = models.filter((m) => m.isFeatured).length;
    logger.debug(
      `[getAvailableModels] Starting with ${totalModels} models, ${initialFeaturedCount} featured`
    );

    // Handle multimedia capabilities separately
    if (capability === "image_generation") {
      const imageModels = this.multimediaService.getImageGenerationModels();
      // Apply additional filters to multimedia models
      let filteredModels = imageModels;

      if (provider) {
        filteredModels = filteredModels.filter(
          (model) => model.provider === provider
        );
      }

      if (filters.maxPricePerMillion !== undefined) {
        filteredModels = this.filterByPrice(
          filteredModels,
          filters.maxPricePerMillion
        );
      }

      if (filters.sortBy === "price") {
        filteredModels = this.sortByPrice(filteredModels, filters.sortOrder);
      }

      return filteredModels;
    } else if (capability === "speech_recognition") {
      const speechModels = this.multimediaService.getSpeechRecognitionModels();
      // Apply additional filters to multimedia models
      let filteredModels = speechModels;

      if (provider) {
        filteredModels = filteredModels.filter(
          (model) => model.provider === provider
        );
      }

      if (filters.maxPricePerMillion !== undefined) {
        filteredModels = this.filterByPrice(
          filteredModels,
          filters.maxPricePerMillion
        );
      }

      if (filters.sortBy === "price") {
        filteredModels = this.sortByPrice(filteredModels, filters.sortOrder);
      }

      return filteredModels;
    }

    // Filter by capability
    if (capability) {
      models = models.filter(
        (model) => model.capabilities?.[capability] === true
      );
    }

    // Filter by provider
    if (provider) {
      models = models.filter((model) => model.provider === provider);
    }

    // Apply additional filters
    if (filters.maxPricePerMillion !== undefined) {
      models = this.filterByPrice(models, filters.maxPricePerMillion);
    }

    if (filters.minContextLength !== undefined) {
      models = models.filter(
        (model) => model.capabilities?.maxContext >= filters.minContextLength
      );
    }

    if (filters.costCategory !== undefined) {
      models = models.filter(
        (model) => model.costEstimate?.category === filters.costCategory
      );
    }

    // Sort by price if requested
    if (filters.sortBy === "price") {
      models = this.sortByPrice(models, filters.sortOrder);
    } else if (filters.sortBy === "featured") {
      // Sort featured models first
      logger.info(
        `[getAvailableModels] Sorting by featured status (${
          filters.sortOrder || "desc"
        })`
      );
      models = this.sortByFeatured(models, filters.sortOrder);
    } else {
      // Default sorting: featured models first, then by name
      logger.info(
        `[getAvailableModels] Default sorting: featured models first`
      );
      models = this.sortByFeatured(models, "desc");
    }

    // Final debug logging for featured models after all processing
    const finalFeaturedCount = models.filter((m) => m.isFeatured).length;
    if (finalFeaturedCount > 0) {
      logger.info(
        `[getAvailableModels] Final result: ${models.length} models, ${finalFeaturedCount} featured`,
        models
          .filter((m) => m.isFeatured)
          .slice(0, 5)
          .map((m) => m.name)
      );
    } else {
      logger.info(
        `[getAvailableModels] Final result: ${models.length} models, no featured models`
      );
    }

    return models;
  }

  // Filter models by maximum price per million tokens
  filterByPrice(models, maxPricePerMillion) {
    return models.filter((model) => {
      if (!model.pricing) return false;

      const promptPrice = model.pricing.prompt || 0;
      const completionPrice = model.pricing.completion || 0;
      const totalPrice = promptPrice + completionPrice;

      return totalPrice <= maxPricePerMillion;
    });
  }

  // Sort models by featured status
  sortByFeatured(models, order = "desc") {
    logger.info(
      `[sortByFeatured] Sorting ${models.length} models by featured status (${order})`
    );

    const sorted = models.sort((a, b) => {
      // Featured models get priority
      if (a.isFeatured && !b.isFeatured) return order === "desc" ? -1 : 1;
      if (!a.isFeatured && b.isFeatured) return order === "desc" ? 1 : -1;

      // Then sort by name
      return (a.name || a.id).localeCompare(b.name || b.id);
    });

    // Log featured models for debugging
    const featuredModels = sorted.filter((m) => m.isFeatured);
    if (featuredModels.length > 0) {
      logger.info(
        `[sortByFeatured] Featured models:`,
        featuredModels.map((m) => ({ name: m.name, isFeatured: m.isFeatured }))
      );
    }

    return sorted;
  }

  // Sort models by price
  sortByPrice(models, order = "asc") {
    return models.sort((a, b) => {
      const priceA = this.getTotalPrice(a);
      const priceB = this.getTotalPrice(b);

      return order === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  // Get total price per million tokens for a model
  getTotalPrice(model) {
    if (!model.pricing) return Infinity;

    const promptPrice = model.pricing.prompt || 0;
    const completionPrice = model.pricing.completion || 0;
    return promptPrice + completionPrice;
  }

  // Get model details
  getModelDetails(modelName) {
    const model = this.models.get(modelName);

    if (!model) {
      // Check if it's a multimedia model
      const imageModel =
        this.multimediaService.getImageGenerationModel(modelName);
      if (imageModel) {
        return imageModel;
      }

      const speechModel =
        this.multimediaService.getSpeechRecognitionModel(modelName);
      if (speechModel) {
        return speechModel;
      }

      // Try to parse model name
      const parsed = parseModelName(modelName);
      if (parsed) {
        // Avoid infinite recursion by checking if the parsed name is different
        const reconstructedName = parsed.provider + "/" + parsed.modelId;
        if (reconstructedName !== modelName) {
          return this.getModelDetails(reconstructedName);
        }
      }
    }

    return model || null;
  }

  // Get model capabilities
  getModelCapabilities(modelName) {
    const capabilities = this.modelCapabilities.get(modelName);

    if (!capabilities) {
      // Check if it's a multimedia model
      const imageModel =
        this.multimediaService.getImageGenerationModel(modelName);
      if (imageModel) {
        return imageModel.capabilities;
      }

      const speechModel =
        this.multimediaService.getSpeechRecognitionModel(modelName);
      if (speechModel) {
        return speechModel.capabilities;
      }

      // Try to parse model name
      const parsed = parseModelName(modelName);
      if (parsed) {
        return this.getModelCapabilities(
          parsed.provider + "/" + parsed.modelId
        );
      }
    }

    return (
      capabilities || {
        vision: false,
        tools: false,
        reasoning: false,
        maxContext: 8192,
      }
    );
  }

  // Check if model supports capability
  modelSupportsCapability(modelName, capability) {
    const capabilities = this.getModelCapabilities(modelName);
    return capabilities ? capabilities[capability] === true : false;
  }

  // Get API client for model
  getModelClient(modelName) {
    const parsed = parseModelName(modelName);
    if (!parsed) return null;

    return this.providerClients[parsed.provider] || null;
  }

  // Get provider from model name
  getModelProvider(modelName) {
    const parsed = parseModelName(modelName);
    return parsed ? parsed.provider : null;
  }

  // Get model ID from model name
  getModelId(modelName) {
    const parsed = parseModelName(modelName);
    return parsed ? parsed.modelId : modelName;
  }

  // Refresh models for specific provider
  async refreshProviderModels(providerName) {
    logger.info(`Refreshing models for ${providerName}...`);

    const client = this.providerClients[providerName];
    if (!client) {
      throw new Error(`No client available for provider: ${providerName}`);
    }

    try {
      const models = await this.fetchModelsFromProvider(providerName, client);
      this.updateModelCache(
        [...this.models.values()]
          .filter((m) => m.provider !== providerName)
          .concat(models)
      );

      logger.info(`Refreshed ${models.length} models for ${providerName}`);
    } catch (error) {
      logger.error(`Failed to refresh models for ${providerName}`, {
        error: error.message,
      });
      throw error;
    }
  }

  // Get model statistics
  getModelStats() {
    const stats = {
      total: this.models.size,
      byProvider: {},
      byCapability: {
        text: 0,
        vision: 0,
        reasoning: 0,
        tools: 0,
        imageGeneration: 0,
        speechRecognition: 0,
      },
      byCostCategory: {
        cheap: 0,
        moderate: 0,
        expensive: 0,
        unknown: 0,
      },
      lastFetchTime: this.lastFetchTime,
    };

    // Count regular models
    for (const model of this.models.values()) {
      // Count by provider
      if (!stats.byProvider[model.provider]) {
        stats.byProvider[model.provider] = 0;
      }
      stats.byProvider[model.provider]++;

      // Count by capability
      if (model.capabilities.vision) stats.byCapability.vision++;
      if (model.capabilities.reasoning) stats.byCapability.reasoning++;
      if (model.capabilities.tools) stats.byCapability.tools++;
      if (!model.capabilities.vision && !model.capabilities.reasoning)
        stats.byCapability.text++;

      // Count by cost category
      const category = model.costEstimate?.category || "unknown";
      stats.byCostCategory[category]++;
    }

    // Add multimedia models to statistics
    const imageModels = this.multimediaService.getImageGenerationModels();
    const speechModels = this.multimediaService.getSpeechRecognitionModels();

    stats.byCapability.imageGeneration = imageModels.length;
    stats.byCapability.speechRecognition = speechModels.length;

    // Add to total count
    stats.total += imageModels.length + speechModels.length;

    return stats;
  }

  // Search models
  searchModels(query, filters = {}) {
    const lowercaseQuery = query.toLowerCase();
    let results = Array.from(this.models.values());

    // Handle multimedia capabilities separately when specifically filtered
    if (filters.capability === "image_generation") {
      return this.multimediaService
        .searchMultimediaModels(query)
        .filter((model) => model.capabilities.image_generation);
    } else if (filters.capability === "speech_recognition") {
      return this.multimediaService
        .searchMultimediaModels(query)
        .filter((model) => model.capabilities.speech_recognition);
    }

    // Text search on regular models
    results = results.filter(
      (model) =>
        model.name.toLowerCase().includes(lowercaseQuery) ||
        model.id.toLowerCase().includes(lowercaseQuery) ||
        (model.description &&
          model.description.toLowerCase().includes(lowercaseQuery))
    );

    // Also search multimedia models and add them to results
    const multimediaResults =
      this.multimediaService.searchMultimediaModels(query);
    results = [...results, ...multimediaResults];

    // Apply filters
    if (filters.provider) {
      results = results.filter((model) => model.provider === filters.provider);
    }

    if (filters.capability) {
      results = results.filter(
        (model) => model.capabilities?.[filters.capability] === true
      );
    }

    if (filters.active !== undefined) {
      results = results.filter((model) => model.active === filters.active);
    }

    if (filters.preferred !== undefined) {
      results = results.filter(
        (model) => model.isPreferred === filters.preferred
      );
    }

    if (filters.maxPricePerMillion !== undefined) {
      results = this.filterByPrice(results, filters.maxPricePerMillion);
    }

    if (filters.costCategory !== undefined) {
      results = results.filter(
        (model) => model.costEstimate?.category === filters.costCategory
      );
    }

    return results;
  }

  // Get health status
  getHealth() {
    const stats = this.getModelStats();

    return {
      status: "healthy",
      totalModels: stats.total,
      providers: Object.keys(stats.byProvider).length,
      lastFetchTime: this.lastFetchTime,
      cacheAge: Date.now() - this.lastFetchTime,
      fetcherCache: this.modelFetcher.getCacheStats(),
    };
  }

  // Get models by price range
  getModelsByPriceRange(minPrice = 0, maxPrice = Infinity) {
    return Array.from(this.models.values()).filter((model) => {
      if (!model.pricing) return false;

      const totalPrice = this.getTotalPrice(model);
      return totalPrice >= minPrice && totalPrice <= maxPrice;
    });
  }

  // Get cheapest models
  getCheapestModels(limit = 10, capability = null) {
    let models = Array.from(this.models.values());

    // Handle multimedia capabilities separately
    if (capability === "image_generation") {
      return this.multimediaService
        .getImageGenerationModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
        .slice(0, limit);
    } else if (capability === "speech_recognition") {
      return this.multimediaService
        .getSpeechRecognitionModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
        .slice(0, limit);
    }

    if (capability) {
      models = models.filter(
        (model) => model.capabilities?.[capability] === true
      );
    }

    return models
      .filter((model) => model.pricing)
      .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
      .slice(0, limit);
  }

  // Get most expensive models
  getMostExpensiveModels(limit = 10, capability = null) {
    let models = Array.from(this.models.values());

    // Handle multimedia capabilities separately
    if (capability === "image_generation") {
      return this.multimediaService
        .getImageGenerationModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
        .slice(0, limit);
    } else if (capability === "speech_recognition") {
      return this.multimediaService
        .getSpeechRecognitionModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
        .slice(0, limit);
    }

    if (capability) {
      models = models.filter(
        (model) => model.capabilities[capability] === true
      );
    }

    return models
      .filter((model) => model.pricing)
      .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
      .slice(0, limit);
  }

  // Process subscription models to ensure proper structure
  processSubscriptionModels(models, providerName) {
    if (!models || !Array.isArray(models)) {
      logger.warn("Invalid subscription models data", { models, providerName });
      return [];
    }

    return models
      .map((model) => {
        try {
          // Ensure model has required structure
          if (!model || typeof model !== "object") {
            logger.warn("Invalid model object in subscription data", { model });
            return null;
          }

          // Extract basic model information
          const modelId = model.id || model.name || "unknown";
          const modelName = model.name || modelId;

          // Ensure capabilities exist
          const capabilities = model.capabilities || {};

          // Debug logging for context length
          logger.debug(
            `[processSubscriptionModels] Processing ${providerName}/${modelId}`,
            {
              modelId,
              providerName,
              originalCapabilities: capabilities,
              modelContextLength: model.context_length,
              modelContextWindow: model.context_window,
            }
          );

          // Set default capabilities if missing, but preserve existing context length
          const processedCapabilities = {
            vision: capabilities.vision || false,
            tools: capabilities.tools !== undefined ? capabilities.tools : true,
            reasoning: capabilities.reasoning || false,
            imageGeneration: capabilities.imageGeneration || false,
            speechRecognition: capabilities.speechRecognition || false,
            maxContext:
              capabilities.maxContext ||
              capabilities.context_length ||
              capabilities.context_window ||
              model.context_length ||
              model.context_window ||
              8192,
          };

          logger.debug(
            `[processSubscriptionModels] Final maxContext for ${providerName}/${modelId}: ${processedCapabilities.maxContext}`
          );

          // Process pricing information
          const pricing = model.pricing || null;

          // Ensure cost estimate exists
          const costEstimate = model.costEstimate || this.estimateCost(pricing);

          return {
            id: modelId,
            name: `${providerName}/${modelId}`,
            provider: providerName,
            displayName: modelName,
            description: model.description || "",
            capabilities: processedCapabilities,
            pricing: pricing,
            active: model.active !== false,
            isPreferred: this.isPreferredModel(providerName, modelId),
            isFeatured: model.isFeatured || false, // Include featured status from model fetcher
            costEstimate: costEstimate,
            // Store raw data for debugging
            rawData: model,
          };
        } catch (error) {
          logger.error("Error processing subscription model", {
            error: error.message,
            model,
            providerName,
          });
          return null;
        }
      })
      .filter(Boolean); // Remove null entries
  }

  // Estimate cost category for a model
  estimateCost(pricing) {
    if (!pricing || !pricing.prompt || !pricing.completion) {
      return { category: "unknown", cheap: false, expensive: false };
    }

    const totalPerMillion = pricing.prompt + pricing.completion;

    if (totalPerMillion <= 0.5) {
      return { category: "cheap", cheap: true, expensive: false };
    } else if (totalPerMillion <= 2.0) {
      return { category: "moderate", cheap: false, expensive: false };
    } else {
      return { category: "expensive", cheap: false, expensive: true };
    }
  }
}

export { EnhancedModelService };
