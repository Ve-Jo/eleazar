import fetch from "node-fetch";
import { logger } from "../utils/logger.js";

/**
 * Model Fetcher Service
 * Fetches models from external AI provider APIs with pricing and capability information
 */
class ModelFetcher {
  constructor() {
    this.cache = new Map();
    this.cacheDuration = 3600000; // 1 hour
    this.timeout = 30000; // 30 seconds

    // Models to filter out (auto-model variants)
    this.filteredModels = new Set([
      "auto-model",
      "auto-model-basic",
      "auto-model-standart",
      "auto-model-premium",
      "auto-model-standard", // Also include common typo variant
    ]);

    // Featured models per provider - these will be shown first
    this.featuredModels = {
      nanogpt: [
        "moonshotai/kimi-k2-thinking",
        "moonshotai/Kimi-K2-Instruct-0905",
        "z-ai/glm-4.6:thinking",
        "z-ai/glm-4.6",
        "deepseek-ai/deepseek-v3.2-exp",
        "deepseek-ai/DeepSeek-V3.1-Terminus:thinking",
        "deepseek-ai/DeepSeek-V3.1-Terminus",
        "deepseek-ai/DeepSeek-V3.1",
        "qwen/qwen3-coder",
        "Qwen/Qwen3-235B-A22B-Thinking-2507",
        "Qwen/Qwen3-235B-A22B-Instruct-2507",
        "Qwen/Qwen3-VL-235B-A22B-Instruct",
        "qwen3-vl-235b-a22b-thinking",
        "Qwen/Qwen3-Next-80B-A3B-Instruct",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qvq-max",
        "MiniMax-M2",
        "meta-llama/llama-4-maverick",
        "meta-llama/llama-4-scout",
      ],
      openrouter: [],
      groq: [],
    };
  }

  /**
   * Fetch models from NanoGPT API
   * @param {string} apiKey - NanoGPT API key
   * @returns {Promise<Array>} Array of model objects
   */
  async fetchNanoGPTModels(apiKey) {
    const cacheKey = "nanogpt:models";

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug("Using cached NanoGPT models");
      return cached.models;
    }

    try {
      logger.info("Fetching models from NanoGPT detailed API");

      const response = await fetch(
        "https://nano-gpt.com/api/subscription/v1/models?detailed=true",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: this.timeout,
        }
      );

      if (!response.ok) {
        throw new Error(
          `NanoGPT subscription API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const models = this.processNanoGPTModels(data);

      // Cache the results
      this.cache.set(cacheKey, {
        models,
        timestamp: Date.now(),
      });

      logger.info(`Fetched ${models.length} subscription models from NanoGPT`);
      return models;
    } catch (error) {
      logger.error("Failed to fetch NanoGPT subscription models", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process NanoGPT API response
   * @param {Object} data - API response data
   * @returns {Array} Processed model objects
   */
  processNanoGPTModels(data) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid NanoGPT API response format");
    }

    const processedModels = data.data
      .filter((model) => {
        // Filter out auto-model variants
        const modelId = model.id || model.name || "";
        const shouldFilter = this.filteredModels.has(modelId.toLowerCase());
        if (shouldFilter) {
          logger.debug(`Filtering out auto-model: ${modelId}`);
        }
        return !shouldFilter;
      })
      .map((model) => {
        const capabilities = this.detectCapabilities(model);
        const pricing = this.processPricing(model.pricing);
        const modelId = model.id || model.name || "";
        const isFeatured = this.isFeaturedModel("nanogpt", modelId);

        // Use context_length from detailed API response
        const finalMaxContext = model.context_length || capabilities.maxContext;

        logger.debug(
          `[processNanoGPTModels] Processing ${modelId}: context_length=${model.context_length}, finalMaxContext=${finalMaxContext}, isFeatured=${isFeatured}`
        );

        return {
          id: modelId,
          name: `nanogpt/${modelId}`,
          provider: "nanogpt",
          displayName: model.name || modelId,
          description: model.description || "",
          capabilities: {
            ...capabilities,
            maxContext: finalMaxContext,
          },
          pricing,
          active: model.active !== false,
          isPreferred: this.isPreferredModel(modelId),
          isFeatured: isFeatured,
          costEstimate: this.estimateCost(pricing),
          rawData: model, // Store raw data for debugging
        };
      });

    // Debug logging for processed models
    const featuredCount = processedModels.filter((m) => m.isFeatured).length;
    logger.info(
      `[processNanoGPTModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  /**
   * Fetch models from OpenRouter API
   * @param {string} apiKey - OpenRouter API key
   * @returns {Promise<Array>} Array of model objects
   */
  async fetchOpenRouterModels(apiKey) {
    const cacheKey = "openrouter:models";

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug("Using cached OpenRouter models");
      return cached.models;
    }

    try {
      logger.info("Fetching models from OpenRouter API");

      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITE_URL || "https://your-site.com",
          "X-Title": process.env.SITE_NAME || "AI Hub Service",
        },
        timeout: this.timeout,
      });

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const models = this.processOpenRouterModels(data);

      // Cache the results
      this.cache.set(cacheKey, {
        models,
        timestamp: Date.now(),
      });

      logger.info(`Fetched ${models.length} models from OpenRouter`);
      return models;
    } catch (error) {
      logger.error("Failed to fetch OpenRouter models", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Fetch models from Groq API
   * @param {string} apiKey - Groq API key
   * @returns {Promise<Array>} Array of model objects
   */
  async fetchGroqModels(apiKey) {
    const cacheKey = "groq:models";

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      logger.debug("Using cached Groq models");
      return cached.models;
    }

    try {
      logger.info("Fetching models from Groq API");

      const response = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: this.timeout,
      });

      if (!response.ok) {
        throw new Error(
          `Groq API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const models = this.processGroqModels(data);

      // Cache the results
      this.cache.set(cacheKey, {
        models,
        timestamp: Date.now(),
      });

      logger.info(`Fetched ${models.length} models from Groq`);
      return models;
    } catch (error) {
      logger.error("Failed to fetch Groq models", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process Groq API response
   * @param {Object} data - API response data
   * @returns {Array} Processed model objects
   */
  processGroqModels(data) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid Groq API response format");
    }

    const processedModels = data.data.map((model) => {
      const capabilities = this.detectGroqCapabilities(model);
      const pricing = this.inferGroqPricing(model);
      const isFeatured = this.isFeaturedModel("groq", model.id);

      logger.debug(
        `Processing Groq model: ${model.id}, isFeatured: ${isFeatured}`
      );

      return {
        id: model.id,
        name: `groq/${model.id}`,
        provider: "groq",
        displayName: model.id, // Groq uses ID as the display name
        description: `${model.id} by ${model.owned_by || "Unknown"}`,
        capabilities: {
          ...capabilities,
          maxContext: model.context_window || this.extractContextLength(model),
        },
        pricing,
        active: model.active !== false,
        isPreferred: this.isPreferredModel(model.id),
        isFeatured: isFeatured,
        costEstimate: this.estimateCost(pricing),
        rawData: model, // Store raw data for debugging
      };
    });

    // Debug logging for processed models
    const featuredCount = processedModels.filter((m) => m.isFeatured).length;
    logger.info(
      `[processGroqModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  /**
   * Detect Groq model capabilities
   * @param {Object} model - Raw model data from Groq
   * @returns {Object} Capabilities object
   */
  detectGroqCapabilities(model) {
    const modelId = (model.id || "").toLowerCase();

    // Vision capability detection for Groq models
    const vision = this.hasVisionCapability(modelId, "", "", model);

    // Reasoning capability detection for Groq models
    const reasoning = this.hasReasoningCapability(modelId, "", "", model);

    // Tools capability (most Groq models support tools)
    const tools = true;

    // Max context length from Groq's context_window field
    const maxContext = model.context_window || this.extractContextLength(model);

    return {
      vision,
      reasoning,
      tools,
      maxContext,
    };
  }

  /**
   * Infer Groq model pricing (Groq doesn't provide pricing in their API)
   * @param {Object} model - Raw model data from Groq
   * @returns {Object} Inferred pricing object
   */
  inferGroqPricing(model) {
    const modelId = (model.id || "").toLowerCase();

    // Groq pricing inference based on model families
    let promptPrice = 0.01; // Default
    let completionPrice = 0.03; // Default

    if (modelId.includes("llama-3.1")) {
      if (modelId.includes("70b")) {
        promptPrice = 0.00059;
        completionPrice = 0.00079;
      } else if (modelId.includes("8b")) {
        promptPrice = 0.00005;
        completionPrice = 0.00008;
      } else {
        promptPrice = 0.00059;
        completionPrice = 0.00079;
      }
    } else if (modelId.includes("llama-3")) {
      if (modelId.includes("70b")) {
        promptPrice = 0.00059;
        completionPrice = 0.00079;
      } else if (modelId.includes("8b")) {
        promptPrice = 0.00005;
        completionPrice = 0.00008;
      }
    } else if (modelId.includes("gemma")) {
      promptPrice = 0.00007;
      completionPrice = 0.00007;
    } else if (modelId.includes("whisper")) {
      // Whisper models are audio-based, different pricing structure
      promptPrice = 0.00006;
      completionPrice = 0.00006;
    } else if (modelId.includes("llama-guard")) {
      promptPrice = 0.00005;
      completionPrice = 0.00008;
    } else if (modelId.includes("mixtral")) {
      promptPrice = 0.0003;
      completionPrice = 0.0006;
    }

    return {
      prompt: promptPrice,
      completion: completionPrice,
      currency: "USD",
      unit: "per_million_tokens",
    };
  }

  /**
   * Process OpenRouter API response
   * @param {Object} data - API response data
   * @returns {Array} Processed model objects
   */
  processOpenRouterModels(data) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid OpenRouter API response format");
    }

    const processedModels = data.data.map((model) => {
      const capabilities = this.detectCapabilities(model);
      const pricing = this.processPricing(model.pricing);
      const isFeatured = this.isFeaturedModel("openrouter", model.id);

      logger.debug(
        `Processing OpenRouter model: ${model.id}, isFeatured: ${isFeatured}`
      );

      return {
        id: model.id,
        name: `openrouter/${model.id}`,
        provider: "openrouter",
        displayName: model.name || model.id,
        description: model.description || "",
        capabilities: {
          ...capabilities,
          maxContext: this.extractContextLength(model),
        },
        pricing,
        active: model.active !== false,
        isPreferred: this.isPreferredModel(model.id),
        isFeatured: isFeatured,
        costEstimate: this.estimateCost(pricing),
        rawData: model, // Store raw data for debugging
      };
    });

    // Debug logging for processed models
    const featuredCount = processedModels.filter((m) => m.isFeatured).length;
    logger.info(
      `[processOpenRouterModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  /**
   * Detect model capabilities
   * @param {Object} model - Raw model data
   * @returns {Object} Capabilities object
   */
  detectCapabilities(model) {
    const modelId = (model.id || "").toLowerCase();
    const name = (model.name || "").toLowerCase();
    const description = (model.description || "").toLowerCase();

    // Vision capability detection
    const vision = this.hasVisionCapability(modelId, name, description, model);

    // Reasoning capability detection
    const reasoning = this.hasReasoningCapability(
      modelId,
      name,
      description,
      model
    );

    // Tools capability detection
    const tools = this.hasToolsCapability(model, modelId);

    // Max context length
    const maxContext = this.extractContextLength(model);

    logger.debug(
      `[detectCapabilities] Detected capabilities for ${modelId}: maxContext=${maxContext}, vision=${vision}, reasoning=${reasoning}, tools=${tools}`
    );

    return {
      vision,
      reasoning,
      tools,
      maxContext,
    };
  }

  /**
   * Check if model has vision capability
   */
  hasVisionCapability(modelId, name, description, model) {
    // Check explicit capabilities object
    if (model.capabilities) {
      if (typeof model.capabilities.vision === "boolean") {
        return model.capabilities.vision;
      }
    }

    // Check architecture input modalities
    if (model.architecture?.input_modalities) {
      return model.architecture.input_modalities.includes("image");
    }

    // Pattern matching
    const visionPatterns = [
      "vision",
      "vl-",
      "gpt-4o",
      "claude-3",
      "gemini-pro-vision",
      "llava",
      "bakllava",
      "image",
      "multimodal",
    ];

    const text = `${modelId} ${name} ${description}`;
    return visionPatterns.some((pattern) => text.includes(pattern));
  }

  /**
   * Check if model has reasoning capability
   */
  hasReasoningCapability(modelId, name, description, model) {
    // Check explicit capabilities object
    if (model.capabilities) {
      if (typeof model.capabilities.reasoning === "boolean") {
        return model.capabilities.reasoning;
      }
    }

    // Pattern matching
    const reasoningPatterns = [
      "reason",
      "thinking",
      "o1-",
      "o3-",
      "logic",
      "math",
      "code",
      "programming",
      "analysis",
    ];

    const text = `${modelId} ${name} ${description}`;
    return reasoningPatterns.some((pattern) => text.includes(pattern));
  }

  /**
   * Check if model has tools capability
   */
  hasToolsCapability(model, modelId) {
    // Check supported parameters
    if (model.supported_parameters) {
      return model.supported_parameters.includes("tools");
    }

    // Check explicit capabilities
    if (model.capabilities) {
      if (typeof model.capabilities.tools === "boolean") {
        return model.capabilities.tools;
      }
    }

    // Default to true for most modern models
    return true;
  }

  /**
   * Extract context length from model data
   */
  extractContextLength(model) {
    const modelId = model.id || "unknown";

    // Direct context length fields
    if (model.context_length) {
      logger.debug(
        `[extractContextLength] Found context_length: ${model.context_length} for ${modelId}`
      );
      return model.context_length;
    }
    if (model.context_window) {
      logger.debug(
        `[extractContextLength] Found context_window: ${model.context_window} for ${modelId}`
      );
      return model.context_window;
    }
    if (model.max_context) {
      logger.debug(
        `[extractContextLength] Found max_context: ${model.max_context} for ${modelId}`
      );
      return model.max_context;
    }

    // Check top provider context
    if (model.top_provider?.context_length) {
      logger.debug(
        `[extractContextLength] Found top_provider.context_length: ${model.top_provider.context_length} for ${modelId}`
      );
      return model.top_provider.context_length;
    }

    // Architecture context length
    if (model.architecture?.context_length) {
      logger.debug(
        `[extractContextLength] Found architecture.context_length: ${model.architecture.context_length} for ${modelId}`
      );
      return model.architecture.context_length;
    }

    // Default based on model patterns
    const modelIdLower = (model.id || "").toLowerCase();

    if (modelIdLower.includes("gpt-4")) return 128000;
    if (modelIdLower.includes("gpt-3.5")) return 16385;
    if (modelIdLower.includes("claude-3")) return 200000;
    if (modelIdLower.includes("llama-3.1")) return 128000;

    logger.debug(
      `[extractContextLength] Using default fallback 8192 for ${modelId}`
    );
    return 8192; // Default fallback
  }

  /**
   * Process pricing information
   */
  processPricing(pricing) {
    if (!pricing) return null;

    // Handle different pricing formats
    const prompt = this.parsePrice(pricing.prompt || pricing.input);
    const completion = this.parsePrice(pricing.completion || pricing.output);
    const request = this.parsePrice(pricing.request);
    const image = this.parsePrice(pricing.image);
    const webSearch = this.parsePrice(pricing.web_search);
    const reasoning = this.parsePrice(pricing.internal_reasoning);

    return {
      prompt,
      completion,
      request,
      image,
      webSearch,
      reasoning,
      currency: pricing.currency || "USD",
      unit: pricing.unit || "per_million_tokens",
    };
  }

  /**
   * Parse price value (handles string and number formats)
   */
  parsePrice(price) {
    if (price === null || price === undefined) return null;
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      const parsed = parseFloat(price);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Estimate cost category
   */
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

  /**
   * Check if model is featured for a specific provider
   */
  isFeaturedModel(provider, modelId) {
    const featured = this.featuredModels[provider];
    if (!featured || !Array.isArray(featured)) return false;

    const normalizedId = modelId.toLowerCase();
    return featured.some((featuredModel) =>
      normalizedId.includes(featuredModel.toLowerCase())
    );
  }

  /**
   * Check if model is preferred
   */
  isPreferredModel(modelId) {
    const preferredModels = [
      "gpt-4o",
      "gpt-4o-mini",
      "claude-3-5-sonnet",
      "claude-3-haiku",
      "llama-3.1-70b",
      "llama-3.1-8b",
      "gemini-pro",
      "mixtral-8x7b",
    ];

    const normalizedId = modelId.toLowerCase();
    return preferredModels.some((pref) => normalizedId.includes(pref));
  }

  /**
   * Clear cache for specific provider or all
   */
  clearCache(provider = null) {
    if (provider) {
      const cacheKey = `${provider}:models`;
      this.cache.delete(cacheKey);
      logger.info(`Cleared cache for ${provider}`);
    } else {
      this.cache.clear();
      logger.info("Cleared all model fetcher cache");
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      cacheDuration: this.cacheDuration,
    };
  }
}

export { ModelFetcher };
