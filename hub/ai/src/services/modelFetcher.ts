import fetch from "node-fetch";
import { logger } from "../utils/logger.ts";

type CachedModels = {
  models: any[];
  timestamp: number;
};

class ModelFetcher {
  cache: Map<string, CachedModels>;
  cacheDuration: number;
  timeout: number;
  filteredModels: Set<string>;
  featuredModels: Record<string, string[]>;

  constructor() {
    this.cache = new Map();
    this.cacheDuration = 3600000;
    this.timeout = 30000;
    this.filteredModels = new Set([
      "auto-model",
      "auto-model-basic",
      "auto-model-standart",
      "auto-model-premium",
      "auto-model-standard",
    ]);
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

  async fetchNanoGPTModels(apiKey: string) {
    const cacheKey = "nanogpt:models";
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
        } as any
      );

      if (!response.ok) {
        throw new Error(
          `NanoGPT subscription API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const models = this.processNanoGPTModels(data);
      this.cache.set(cacheKey, { models, timestamp: Date.now() });
      logger.info(`Fetched ${models.length} subscription models from NanoGPT`);
      return models;
    } catch (error: any) {
      logger.error("Failed to fetch NanoGPT subscription models", {
        error: error.message,
      });
      throw error;
    }
  }

  processNanoGPTModels(data: any) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid NanoGPT API response format");
    }

    const processedModels = data.data
      .filter((model: any) => {
        const modelId = model.id || model.name || "";
        const shouldFilter = this.filteredModels.has(modelId.toLowerCase());
        if (shouldFilter) {
          logger.debug(`Filtering out auto-model: ${modelId}`);
        }
        return !shouldFilter;
      })
      .map((model: any) => {
        const capabilities = this.detectCapabilities(model);
        const pricing = this.processPricing(model.pricing);
        const modelId = model.id || model.name || "";
        const isFeatured = this.isFeaturedModel("nanogpt", modelId);
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
          isFeatured,
          costEstimate: this.estimateCost(pricing),
          rawData: model,
        };
      });

    const featuredCount = processedModels.filter((m: any) => m.isFeatured).length;
    logger.info(
      `[processNanoGPTModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  async fetchOpenRouterModels(apiKey: string) {
    const cacheKey = "openrouter:models";
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
      } as any);

      if (!response.ok) {
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const models = this.processOpenRouterModels(data);
      this.cache.set(cacheKey, { models, timestamp: Date.now() });
      logger.info(`Fetched ${models.length} models from OpenRouter`);
      return models;
    } catch (error: any) {
      logger.error("Failed to fetch OpenRouter models", {
        error: error.message,
      });
      throw error;
    }
  }

  async fetchGroqModels(apiKey: string) {
    const cacheKey = "groq:models";
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
      } as any);

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = this.processGroqModels(data);
      this.cache.set(cacheKey, { models, timestamp: Date.now() });
      logger.info(`Fetched ${models.length} models from Groq`);
      return models;
    } catch (error: any) {
      logger.error("Failed to fetch Groq models", {
        error: error.message,
      });
      throw error;
    }
  }

  processGroqModels(data: any) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid Groq API response format");
    }

    const processedModels = data.data.map((model: any) => {
      const capabilities = this.detectGroqCapabilities(model);
      const pricing = this.inferGroqPricing(model);
      const isFeatured = this.isFeaturedModel("groq", model.id);

      logger.debug(`Processing Groq model: ${model.id}, isFeatured: ${isFeatured}`);

      return {
        id: model.id,
        name: `groq/${model.id}`,
        provider: "groq",
        displayName: model.id,
        description: `${model.id} by ${model.owned_by || "Unknown"}`,
        capabilities: {
          ...capabilities,
          maxContext: model.context_window || this.extractContextLength(model),
        },
        pricing,
        active: model.active !== false,
        isPreferred: this.isPreferredModel(model.id),
        isFeatured,
        costEstimate: this.estimateCost(pricing),
        rawData: model,
      };
    });

    const featuredCount = processedModels.filter((m: any) => m.isFeatured).length;
    logger.info(
      `[processGroqModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  detectGroqCapabilities(model: any) {
    const modelId = (model.id || "").toLowerCase();
    const vision = this.hasVisionCapability(modelId, "", "", model);
    const reasoning = this.hasReasoningCapability(modelId, "", "", model);
    const tools = true;
    const maxContext = model.context_window || this.extractContextLength(model);

    return {
      vision,
      reasoning,
      tools,
      maxContext,
    };
  }

  inferGroqPricing(model: any) {
    const modelId = (model.id || "").toLowerCase();
    let promptPrice = 0.01;
    let completionPrice = 0.03;

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

  processOpenRouterModels(data: any) {
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Invalid OpenRouter API response format");
    }

    const processedModels = data.data.map((model: any) => {
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
        isFeatured,
        costEstimate: this.estimateCost(pricing),
        rawData: model,
      };
    });

    const featuredCount = processedModels.filter((m: any) => m.isFeatured).length;
    logger.info(
      `[processOpenRouterModels] Processed ${processedModels.length} models, ${featuredCount} are featured`
    );

    return processedModels;
  }

  detectCapabilities(model: any) {
    const modelId = (model.id || "").toLowerCase();
    const name = (model.name || "").toLowerCase();
    const description = (model.description || "").toLowerCase();
    const vision = this.hasVisionCapability(modelId, name, description, model);
    const reasoning = this.hasReasoningCapability(modelId, name, description, model);
    const tools = this.hasToolsCapability(model, modelId);
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

  hasVisionCapability(modelId: string, name: string, description: string, model: any) {
    if (model.capabilities && typeof model.capabilities.vision === "boolean") {
      return model.capabilities.vision;
    }
    if (model.architecture?.input_modalities) {
      return model.architecture.input_modalities.includes("image");
    }
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

  hasReasoningCapability(
    modelId: string,
    name: string,
    description: string,
    model: any
  ) {
    if (model.capabilities && typeof model.capabilities.reasoning === "boolean") {
      return model.capabilities.reasoning;
    }
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

  hasToolsCapability(model: any, modelId: string) {
    if (model.supported_parameters) {
      return model.supported_parameters.includes("tools");
    }
    if (model.capabilities && typeof model.capabilities.tools === "boolean") {
      return model.capabilities.tools;
    }
    return true;
  }

  extractContextLength(model: any) {
    const modelId = model.id || "unknown";
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
    if (model.top_provider?.context_length) {
      logger.debug(
        `[extractContextLength] Found top_provider.context_length: ${model.top_provider.context_length} for ${modelId}`
      );
      return model.top_provider.context_length;
    }
    if (model.architecture?.context_length) {
      logger.debug(
        `[extractContextLength] Found architecture.context_length: ${model.architecture.context_length} for ${modelId}`
      );
      return model.architecture.context_length;
    }
    const modelIdLower = (model.id || "").toLowerCase();
    if (modelIdLower.includes("gpt-4")) return 128000;
    if (modelIdLower.includes("gpt-3.5")) return 16385;
    if (modelIdLower.includes("claude-3")) return 200000;
    if (modelIdLower.includes("llama-3.1")) return 128000;
    logger.debug(`[extractContextLength] Using default fallback 8192 for ${modelId}`);
    return 8192;
  }

  processPricing(pricing: any) {
    if (!pricing) return null;
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

  parsePrice(price: any) {
    if (price === null || price === undefined) return null;
    if (typeof price === "number") return price;
    if (typeof price === "string") {
      const parsed = parseFloat(price);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  estimateCost(pricing: any) {
    if (!pricing || !pricing.prompt || !pricing.completion) {
      return { category: "unknown", cheap: false, expensive: false };
    }
    const totalPerMillion = pricing.prompt + pricing.completion;
    if (totalPerMillion <= 0.5) {
      return { category: "cheap", cheap: true, expensive: false };
    } else if (totalPerMillion <= 2.0) {
      return { category: "moderate", cheap: false, expensive: false };
    }
    return { category: "expensive", cheap: false, expensive: true };
  }

  isFeaturedModel(provider: string, modelId: string) {
    const featured = this.featuredModels[provider];
    if (!featured || !Array.isArray(featured)) return false;
    const normalizedId = modelId.toLowerCase();
    return featured.some((featuredModel) =>
      normalizedId.includes(featuredModel.toLowerCase())
    );
  }

  isPreferredModel(modelId: string) {
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

  clearCache(provider: string | null = null) {
    if (provider) {
      const cacheKey = `${provider}:models`;
      this.cache.delete(cacheKey);
      logger.info(`Cleared cache for ${provider}`);
    } else {
      this.cache.clear();
      logger.info("Cleared all model fetcher cache");
    }
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      cacheDuration: this.cacheDuration,
    };
  }
}

export { ModelFetcher };
