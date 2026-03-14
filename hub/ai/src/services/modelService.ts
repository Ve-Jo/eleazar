import { logger } from "../utils/logger.ts";
import { ModelFetcher } from "./modelFetcher.ts";
import { MultimediaModelsService } from "./multimediaModels.ts";
import {
  getProviderConfig,
  formatModelName,
  parseModelName,
} from "../utils/providers.ts";
import {
  recordModelCacheHit,
  recordModelCacheMiss,
} from "../middleware/metrics.ts";

type ModelRecord = Record<string, any>;

type ModelFilters = {
  maxPricePerMillion?: number;
  minContextLength?: number;
  costCategory?: string;
  sortBy?: string;
  sortOrder?: string;
  provider?: string;
  capability?: string;
  active?: boolean;
  preferred?: boolean;
};

class EnhancedModelService {
  providerClients: Record<string, any>;
  cacheService: any;
  modelFetcher: ModelFetcher;
  multimediaService: MultimediaModelsService;
  models: Map<string, ModelRecord>;
  modelCapabilities: Map<string, Record<string, any>>;
  lastFetchTime: number;
  cacheDuration: number;
  refreshInterval: number;
  refreshTimer: ReturnType<typeof setInterval> | null;
  fallbackToStatic: boolean;

  constructor(providerClients: Record<string, any>, cacheService: any) {
    this.providerClients = providerClients;
    this.cacheService = cacheService;
    this.modelFetcher = new ModelFetcher();
    this.multimediaService = new MultimediaModelsService();
    this.models = new Map();
    this.modelCapabilities = new Map();
    this.lastFetchTime = 0;
    this.cacheDuration = parseInt(process.env.MODEL_CACHE_TTL || "600000");
    this.refreshInterval = parseInt(
      process.env.MODEL_REFRESH_INTERVAL || "3600000"
    );
    this.refreshTimer = null;
    this.fallbackToStatic = true;
  }

  async initialize() {
    logger.info("Initializing enhanced model service...");

    try {
      await this.refreshModels();
      this.startRefreshTimer();
      logger.info("Enhanced model service initialized successfully");
    } catch (error: any) {
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

  startRefreshTimer() {
    this.refreshTimer = setInterval(async () => {
      try {
        logger.info("Auto-refreshing models...");
        await this.refreshModels();
      } catch (error: any) {
        logger.error("Auto-refresh failed", { error: error.message });
      }
    }, this.refreshInterval);

    logger.info(
      `Model refresh timer started (interval: ${this.refreshInterval}ms)`
    );
  }

  async refreshModels() {
    logger.info("Refreshing models from providers...");

    const startTime = Date.now();
    const allModels: ModelRecord[] = [];
    const errors: Array<{ provider: string; error: string }> = [];

    for (const [providerName, client] of Object.entries(this.providerClients)) {
      try {
        logger.debug(
          `Fetching models from ${providerName}... client: ${client ? "exists" : "null"}`
        );
        if (providerName === "nanogpt") {
          logger.debug(
            `NanoGPT provider detected - hasConfig: ${!!getProviderConfig(
              providerName
            )}, apiKey: ${!!getProviderConfig(providerName)?.apiKey}`
          );
        }

        const models = await this.fetchModelsFromProvider(providerName, client);
        allModels.push(...models);
        logger.debug(`Fetched ${models.length} models from ${providerName}`);
      } catch (error: any) {
        logger.error(`Failed to fetch models from ${providerName}`, {
          error: error.message,
        });
        errors.push({ provider: providerName, error: error.message });

        if (this.fallbackToStatic) {
          try {
            logger.info(`Falling back to static models for ${providerName}`);
            const staticModels = await this.getStaticModels(providerName);
            allModels.push(...staticModels);
          } catch (fallbackError: any) {
            logger.error(`Static fallback failed for ${providerName}`, {
              error: fallbackError.message,
            });
          }
        }
      }
    }

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

  async fetchModelsFromProvider(providerName: string, client: any) {
    const cacheKey = `models:${providerName}`;
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
      let models: ModelRecord[] = [];
      const providerConfig = getProviderConfig(providerName);

      if (!providerConfig) {
        throw new Error(`Unknown provider: ${providerName}`);
      }

      if (providerConfig.apiKey && this.supportsDynamicFetching(providerName)) {
        try {
          models = await this.fetchModelsDynamically(
            providerName,
            providerConfig.apiKey
          );
          logger.info(
            `Dynamically fetched ${models.length} models from ${providerName}`
          );
        } catch (error: any) {
          logger.warn(
            `Dynamic fetching failed for ${providerName}, trying API fallback`,
            {
              error: error.message,
            }
          );

          if (client && providerConfig.capabilities.modelListing) {
            models = await this.fetchModelsFromAPI(providerName, client);
          } else {
            throw error;
          }
        }
      } else if (client && providerConfig.capabilities.modelListing) {
        models = await this.fetchModelsFromAPI(providerName, client);
      } else {
        models = this.getConfiguredModels(providerName);
      }

      await this.cacheService.set(
        cacheKey,
        {
          models,
          timestamp: Date.now(),
        },
        this.cacheDuration
      );

      return models;
    } catch (error: any) {
      logger.error(`Failed to fetch models from ${providerName}`, {
        error: error.message,
      });
      return this.getConfiguredModels(providerName);
    }
  }

  supportsDynamicFetching(providerName: string) {
    return ["nanogpt", "openrouter", "groq"].includes(providerName);
  }

  async fetchModelsDynamically(providerName: string, apiKey: string) {
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

  async fetchModelsFromAPI(providerName: string, client: any) {
    try {
      const response = await client.models.list();
      const models = response.data || response;
      return models.map((model: any) => this.processAPIModel(providerName, model));
    } catch (error: any) {
      logger.warn(`API model listing not available for ${providerName}`, {
        error: error.message,
      });
      return this.getConfiguredModels(providerName);
    }
  }

  processAPIModel(providerName: string, model: any) {
    const modelId = model.id || model.name;
    const maxContext = this.detectMaxContext(providerName, modelId, model);
    logger.debug(
      `[processAPIModel] Processing ${providerName}/${modelId}, maxContext: ${maxContext}`,
      {
        modelId,
        providerName,
        context_window: model.context_window,
        context_length: model.context_length,
        max_context: model.max_context,
        maxContext,
      }
    );

    const capabilities = {
      vision: this.detectVisionCapability(providerName, modelId, model),
      tools: this.detectToolsCapability(providerName, modelId, model),
      reasoning: this.detectReasoningCapability(providerName, modelId, model),
      imageGeneration: false,
      speechRecognition: false,
      maxContext,
    };

    return {
      id: modelId,
      name: formatModelName(model, providerName),
      provider: providerName,
      capabilities,
      pricing: model.pricing || null,
      active: model.active !== false,
      isPreferred: this.isPreferredModel(providerName, modelId),
      isFeatured: model.isFeatured || false,
    };
  }

  getConfiguredModels(_providerName: string) {
    return [];
  }

  async getStaticModels(providerName: string) {
    return this.getConfiguredModels(providerName);
  }

  detectVisionCapability(providerName: string, modelId: string, _model: any) {
    const providerConfig = getProviderConfig(providerName);
    if (providerConfig?.models?.vision?.includes(modelId)) {
      return true;
    }
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

  detectToolsCapability(providerName: string, _modelId: string, _model: any) {
    const providerConfig = getProviderConfig(providerName);
    return providerConfig?.capabilities?.tools ?? true;
  }

  detectReasoningCapability(_providerName: string, modelId: string, _model: any) {
    const reasoningPatterns = ["reason", "o1", "thinking"];
    const lowerModelId = modelId.toLowerCase();
    return reasoningPatterns.some((pattern) => lowerModelId.includes(pattern));
  }

  detectMaxContext(providerName: string, _modelId: string, model: any) {
    if (model.context_window) return model.context_window;
    if (model.context_length) return model.context_length;
    if (model.max_context) return model.max_context;
    if (model.maxContext) return model.maxContext;
    if (model.architecture?.context_length) return model.architecture.context_length;
    if (model.architecture?.context_window) return model.architecture.context_window;
    if (model.top_provider?.context_length) return model.top_provider.context_length;
    if (model.capabilities?.maxContext) return model.capabilities.maxContext;
    if (model.capabilities?.context_length) return model.capabilities.context_length;
    if (model.capabilities?.context_window) return model.capabilities.context_window;
    const providerConfig = getProviderConfig(providerName);
    return providerConfig?.parameters?.max_tokens?.default || 8192;
  }

  isPreferredModel(_providerName: string, _modelId: string) {
    return true;
  }

  updateModelCache(models: ModelRecord[]) {
    const startTime = Date.now();
    this.models.clear();
    this.modelCapabilities.clear();

    for (const model of models) {
      this.models.set(model.name, model);
      this.modelCapabilities.set(model.name, model.capabilities);
    }

    const duration = Date.now() - startTime;
    logger.info(
      `Model cache updated with ${models.length} models in ${duration}ms`
    );
  }

  async getAvailableModels(
    capability: string | null = null,
    provider: string | null = null,
    filters: ModelFilters = {}
  ) {
    let models = Array.from(this.models.values());

    const totalModels = models.length;
    const initialFeaturedCount = models.filter((m) => m.isFeatured).length;
    logger.debug(
      `[getAvailableModels] Starting with ${totalModels} models, ${initialFeaturedCount} featured`
    );

    if (capability === "image_generation") {
      let filteredModels: ModelRecord[] =
        this.multimediaService.getImageGenerationModels();
      if (provider) {
        filteredModels = filteredModels.filter((model) => model.provider === provider);
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

    if (capability === "speech_recognition") {
      let filteredModels: ModelRecord[] =
        this.multimediaService.getSpeechRecognitionModels();
      if (provider) {
        filteredModels = filteredModels.filter((model) => model.provider === provider);
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

    if (capability) {
      models = models.filter((model) => model.capabilities?.[capability] === true);
    }
    if (provider) {
      models = models.filter((model) => model.provider === provider);
    }
    if (filters.maxPricePerMillion !== undefined) {
      models = this.filterByPrice(models, filters.maxPricePerMillion);
    }
    if (filters.minContextLength !== undefined) {
      models = models.filter(
        (model) => model.capabilities?.maxContext >= filters.minContextLength!
      );
    }
    if (filters.costCategory !== undefined) {
      models = models.filter(
        (model) => model.costEstimate?.category === filters.costCategory
      );
    }

    if (filters.sortBy === "price") {
      models = this.sortByPrice(models, filters.sortOrder);
    } else if (filters.sortBy === "featured") {
      logger.info(
        `[getAvailableModels] Sorting by featured status (${filters.sortOrder || "desc"})`
      );
      models = this.sortByFeatured(models, filters.sortOrder);
    } else {
      logger.info(`[getAvailableModels] Default sorting: featured models first`);
      models = this.sortByFeatured(models, "desc");
    }

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

  filterByPrice(models: ModelRecord[], maxPricePerMillion: number) {
    return models.filter((model) => {
      if (!model.pricing) return false;
      const promptPrice = model.pricing.prompt || 0;
      const completionPrice = model.pricing.completion || 0;
      return promptPrice + completionPrice <= maxPricePerMillion;
    });
  }

  sortByFeatured(models: ModelRecord[], order = "desc") {
    logger.info(
      `[sortByFeatured] Sorting ${models.length} models by featured status (${order})`
    );

    const sorted = models.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return order === "desc" ? -1 : 1;
      if (!a.isFeatured && b.isFeatured) return order === "desc" ? 1 : -1;
      return (a.name || a.id).localeCompare(b.name || b.id);
    });

    const featuredModels = sorted.filter((m) => m.isFeatured);
    if (featuredModels.length > 0) {
      logger.info(
        `[sortByFeatured] Featured models:`,
        featuredModels.map((m) => ({ name: m.name, isFeatured: m.isFeatured }))
      );
    }

    return sorted;
  }

  sortByPrice(models: ModelRecord[], order = "asc") {
    return models.sort((a, b) => {
      const priceA = this.getTotalPrice(a);
      const priceB = this.getTotalPrice(b);
      return order === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  getTotalPrice(model: ModelRecord) {
    if (!model.pricing) return Infinity;
    return (model.pricing.prompt || 0) + (model.pricing.completion || 0);
  }

  getModelDetails(modelName: string): ModelRecord | null {
    const model = this.models.get(modelName);
    if (!model) {
      const imageModel = this.multimediaService.getImageGenerationModel(modelName);
      if (imageModel) return imageModel;
      const speechModel = this.multimediaService.getSpeechRecognitionModel(modelName);
      if (speechModel) return speechModel;
      const parsed = parseModelName(modelName);
      if (parsed) {
        const reconstructedName = parsed.provider + "/" + parsed.modelId;
        if (reconstructedName !== modelName) {
          return this.getModelDetails(reconstructedName);
        }
      }
    }
    return model || null;
  }

  getModelCapabilities(modelName: string): Record<string, any> {
    const capabilities = this.modelCapabilities.get(modelName);
    if (!capabilities) {
      const imageModel = this.multimediaService.getImageGenerationModel(modelName);
      if (imageModel) return imageModel.capabilities;
      const speechModel = this.multimediaService.getSpeechRecognitionModel(modelName);
      if (speechModel) return speechModel.capabilities;
      const parsed = parseModelName(modelName);
      if (parsed) {
        return this.getModelCapabilities(parsed.provider + "/" + parsed.modelId);
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

  modelSupportsCapability(modelName: string, capability: string) {
    const capabilities = this.getModelCapabilities(modelName);
    return capabilities ? capabilities[capability] === true : false;
  }

  getModelClient(modelName: string) {
    const parsed = parseModelName(modelName);
    if (!parsed) return null;
    return parsed.provider ? this.providerClients[parsed.provider] || null : null;
  }

  getModelProvider(modelName: string) {
    const parsed = parseModelName(modelName);
    return parsed ? parsed.provider : null;
  }

  getModelId(modelName: string) {
    const parsed = parseModelName(modelName);
    return parsed ? parsed.modelId : modelName;
  }

  async refreshProviderModels(providerName: string) {
    logger.info(`Refreshing models for ${providerName}...`);
    const client = this.providerClients[providerName];
    if (!client) {
      throw new Error(`No client available for provider: ${providerName}`);
    }

    try {
      const models = await this.fetchModelsFromProvider(providerName, client);
      this.updateModelCache(
        [...this.models.values()].filter((m) => m.provider !== providerName).concat(models)
      );
      logger.info(`Refreshed ${models.length} models for ${providerName}`);
    } catch (error: any) {
      logger.error(`Failed to refresh models for ${providerName}`, {
        error: error.message,
      });
      throw error;
    }
  }

  getModelStats() {
    const stats: Record<string, any> = {
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

    for (const model of this.models.values()) {
      if (!stats.byProvider[model.provider]) {
        stats.byProvider[model.provider] = 0;
      }
      stats.byProvider[model.provider]++;
      if (model.capabilities.vision) stats.byCapability.vision++;
      if (model.capabilities.reasoning) stats.byCapability.reasoning++;
      if (model.capabilities.tools) stats.byCapability.tools++;
      if (!model.capabilities.vision && !model.capabilities.reasoning) {
        stats.byCapability.text++;
      }
      const category = model.costEstimate?.category || "unknown";
      stats.byCostCategory[category]++;
    }

    const imageModels = this.multimediaService.getImageGenerationModels();
    const speechModels = this.multimediaService.getSpeechRecognitionModels();
    stats.byCapability.imageGeneration = imageModels.length;
    stats.byCapability.speechRecognition = speechModels.length;
    stats.total += imageModels.length + speechModels.length;
    return stats;
  }

  searchModels(query: string, filters: ModelFilters = {}) {
    const lowercaseQuery = query.toLowerCase();
    let results = Array.from(this.models.values());

    if (filters.capability === "image_generation") {
      return this.multimediaService
        .searchMultimediaModels(query)
        .filter((model) => model.capabilities.image_generation);
    }
    if (filters.capability === "speech_recognition") {
      return this.multimediaService
        .searchMultimediaModels(query)
        .filter((model) => model.capabilities.speech_recognition);
    }

    results = results.filter(
      (model) =>
        model.name.toLowerCase().includes(lowercaseQuery) ||
        model.id.toLowerCase().includes(lowercaseQuery) ||
        (model.description &&
          model.description.toLowerCase().includes(lowercaseQuery))
    );

    results = [...results, ...this.multimediaService.searchMultimediaModels(query)];

    if (filters.provider) {
      results = results.filter((model) => model.provider === filters.provider);
    }
    if (filters.capability) {
      results = results.filter(
        (model) => model.capabilities?.[filters.capability!] === true
      );
    }
    if (filters.active !== undefined) {
      results = results.filter((model) => model.active === filters.active);
    }
    if (filters.preferred !== undefined) {
      results = results.filter((model) => model.isPreferred === filters.preferred);
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

  getModelsByPriceRange(minPrice = 0, maxPrice = Infinity) {
    return Array.from(this.models.values()).filter((model) => {
      if (!model.pricing) return false;
      const totalPrice = this.getTotalPrice(model);
      return totalPrice >= minPrice && totalPrice <= maxPrice;
    });
  }

  getCheapestModels(limit = 10, capability: string | null = null) {
    let models = Array.from(this.models.values());
    if (capability === "image_generation") {
      return this.multimediaService
        .getImageGenerationModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
        .slice(0, limit);
    }
    if (capability === "speech_recognition") {
      return this.multimediaService
        .getSpeechRecognitionModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
        .slice(0, limit);
    }
    if (capability) {
      models = models.filter((model) => model.capabilities?.[capability] === true);
    }
    return models
      .filter((model) => model.pricing)
      .sort((a, b) => this.getTotalPrice(a) - this.getTotalPrice(b))
      .slice(0, limit);
  }

  getMostExpensiveModels(limit = 10, capability: string | null = null) {
    let models = Array.from(this.models.values());
    if (capability === "image_generation") {
      return this.multimediaService
        .getImageGenerationModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
        .slice(0, limit);
    }
    if (capability === "speech_recognition") {
      return this.multimediaService
        .getSpeechRecognitionModels()
        .filter((model) => model.pricing)
        .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
        .slice(0, limit);
    }
    if (capability) {
      models = models.filter((model) => model.capabilities?.[capability] === true);
    }
    return models
      .filter((model) => model.pricing)
      .sort((a, b) => this.getTotalPrice(b) - this.getTotalPrice(a))
      .slice(0, limit);
  }

  processSubscriptionModels(models: any[], providerName: string) {
    if (!models || !Array.isArray(models)) {
      logger.warn("Invalid subscription models data", { models, providerName });
      return [];
    }

    return models
      .map((model) => {
        try {
          if (!model || typeof model !== "object") {
            logger.warn("Invalid model object in subscription data", { model });
            return null;
          }

          const modelId = model.id || model.name || "unknown";
          const modelName = model.name || modelId;
          const capabilities = model.capabilities || {};

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

          const pricing = model.pricing || null;
          const costEstimate = model.costEstimate || this.estimateCost(pricing);

          return {
            id: modelId,
            name: `${providerName}/${modelId}`,
            provider: providerName,
            displayName: modelName,
            description: model.description || "",
            capabilities: processedCapabilities,
            pricing,
            active: model.active !== false,
            isPreferred: this.isPreferredModel(providerName, modelId),
            isFeatured: model.isFeatured || false,
            costEstimate,
            rawData: model,
          };
        } catch (error: any) {
          logger.error("Error processing subscription model", {
            error: error.message,
            model,
            providerName,
          });
          return null;
        }
      })
      .filter(Boolean);
  }

  estimateCost(pricing: any) {
    if (!pricing || !pricing.prompt || !pricing.completion) {
      return { category: "unknown", cheap: false, expensive: false };
    }
    const totalPerMillion = pricing.prompt + pricing.completion;
    if (totalPerMillion <= 0.5) {
      return { category: "cheap", cheap: true, expensive: false };
    }
    if (totalPerMillion <= 2.0) {
      return { category: "moderate", cheap: false, expensive: false };
    }
    return { category: "expensive", cheap: false, expensive: true };
  }
}

export { EnhancedModelService };
