// Provider configurations and utilities
import OpenAI from "openai";
import { logger } from "./logger.js";
import { validateProviderConfig } from "./validators.js";

// Provider configurations - dynamic to ensure env vars are loaded
function getProviderConfigs() {
  return {
    groq: {
      name: "groq",
      displayName: "Groq",
      baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 30, // Groq has higher limits
      },
      dynamicFetching: {
        enabled: false, // Groq doesn't have a public models API
        apiEndpoint: null,
        requiresAuth: true,
      },
      models: {
        text: [],
        vision: [],
        reasoning: [], // Groq doesn't have reasoning models yet
      },
      capabilities: {
        streaming: true,
        tools: true,
        vision: true,
        reasoning: false,
        webSearch: false,
        imageGeneration: false,
        speechRecognition: true,
      },
      parameters: {
        temperature: { min: 0, max: 2, default: 0.7 },
        top_p: { min: 0, max: 1, default: 1 },
        frequency_penalty: { min: -2, max: 2, default: 0 },
        presence_penalty: { min: -2, max: 2, default: 0 },
        max_tokens: { min: 1, max: 8192, default: 4096 },
      },
    },

    openrouter: {
      name: "openrouter",
      displayName: "OpenRouter",
      baseURL:
        process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      timeout: 45000,
      maxRetries: 3,
      retryDelay: 2000,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 60, // OpenRouter has good limits
      },
      dynamicFetching: {
        enabled: true,
        apiEndpoint: "https://openrouter.ai/api/v1/models",
        requiresAuth: true,
      },
      models: {
        text: [],
        vision: [],
        reasoning: [],
      },
      capabilities: {
        streaming: true,
        tools: true,
        vision: true,
        reasoning: true,
        webSearch: true,
        imageGeneration: true,
        speechRecognition: false,
      },
      parameters: {
        temperature: { min: 0, max: 2, default: 0.7 },
        top_p: { min: 0, max: 1, default: 1 },
        top_k: { min: 0, max: 100, default: 0 },
        frequency_penalty: { min: -2, max: 2, default: 0 },
        presence_penalty: { min: -2, max: 2, default: 0 },
        repetition_penalty: { min: 0, max: 2, default: 1 },
        min_p: { min: 0, max: 1, default: 0 },
        top_a: { min: 0, max: 1, default: 0 },
        max_tokens: { min: 1, max: 32768, default: 4096 },
      },
    },

    nanogpt: {
      name: "nanogpt",
      displayName: "NanoGPT",
      baseURL: process.env.NANOGPT_BASE_URL || "https://nano-gpt.com/api/v1",
      apiKey: process.env.NANOGPT_API_KEY,
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 20, // Conservative limit for NanoGPT
      },
      dynamicFetching: {
        enabled: true,
        apiEndpoint: "https://nano-gpt.com/api/subscription/v1/models",
        requiresAuth: true,
      },
      models: {
        text: [],
        vision: [],
        reasoning: [],
      },
      capabilities: {
        streaming: true,
        tools: true,
        vision: true,
        reasoning: true,
        webSearch: false,
        imageGeneration: true,
        speechRecognition: false,
      },
      parameters: {
        temperature: { min: 0, max: 2, default: 0.7 },
        top_p: { min: 0, max: 1, default: 1 },
        frequency_penalty: { min: -2, max: 2, default: 0 },
        presence_penalty: { min: -2, max: 2, default: 0 },
        max_tokens: { min: 1, max: 8192, default: 4096 },
      },
    },
  };
}

// Provider client creation
function createProviderClient(providerName, config = {}) {
  const configs = getProviderConfigs();
  const providerConfig = configs[providerName];

  if (!providerConfig) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  if (!providerConfig.apiKey) {
    throw new Error(`API key not configured for provider: ${providerName}`);
  }

  try {
    switch (providerName) {
      case "groq":
      case "openrouter":
      case "nanogpt":
        return new OpenAI({
          apiKey: providerConfig.apiKey,
          baseURL: providerConfig.baseURL,
          timeout: config.timeout || providerConfig.timeout,
          maxRetries: config.maxRetries || providerConfig.maxRetries,
          defaultHeaders:
            providerName === "openrouter"
              ? {
                  "HTTP-Referer":
                    process.env.SITE_URL || "https://your-site.com",
                  "X-Title": process.env.SITE_NAME || "AI Hub Service",
                }
              : {},
        });

      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  } catch (error) {
    logger.error(`Failed to create ${providerName} client`, {
      error: error.message,
    });
    throw error;
  }
}

// Get provider configuration
function getProviderConfig(providerName) {
  const configs = getProviderConfigs();
  return configs[providerName] || null;
}

// Get all available providers
function getAvailableProviders() {
  const configs = getProviderConfigs();
  return Object.keys(configs).filter((provider) => configs[provider].apiKey);
}

// Get models for provider
function getProviderModels(providerName, capability = null) {
  const configs = getProviderConfigs();
  const config = configs[providerName];
  if (!config) return [];

  if (capability) {
    return config.models[capability] || [];
  }

  // Return all models
  return [
    ...config.models.text,
    ...config.models.vision,
    ...config.models.reasoning,
  ];
}

// Check if provider supports capability
function providerSupportsCapability(providerName, capability) {
  const configs = getProviderConfigs();
  const config = configs[providerName];
  if (!config) return false;

  return config.capabilities[capability] || false;
}

// Get provider parameters
function getProviderParameters(providerName) {
  const configs = getProviderConfigs();
  const config = configs[providerName];
  if (!config) return {};

  return config.parameters;
}

// Validate parameters for provider
function validateProviderParameters(providerName, parameters) {
  const providerParams = getProviderParameters(providerName);
  const validated = {};
  const errors = [];

  for (const [param, config] of Object.entries(providerParams)) {
    if (parameters[param] !== undefined) {
      const value = parameters[param];

      if (
        typeof value !== "number" ||
        value < config.min ||
        value > config.max
      ) {
        errors.push(
          `${param}: must be between ${config.min} and ${config.max}`
        );
      } else {
        validated[param] = value;
      }
    } else {
      // Use default if not provided
      validated[param] = config.default;
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid parameters for ${providerName}: ${errors.join(", ")}`
    );
  }

  return validated;
}

// Format model name with provider prefix
function formatModelName(modelId, providerName) {
  return `${providerName}/${modelId}`;
}

// Parse model name to get provider and model ID
function parseModelName(modelName) {
  const parts = modelName.split("/");
  if (parts.length >= 2) {
    return {
      provider: parts[0],
      modelId: parts.slice(1).join("/"),
    };
  }
  return null;
}

// Check if model supports capability
function modelSupportsCapability(modelName, capability) {
  const provider = getProviderFromModel(modelName);
  if (!provider) return false;

  const modelId = getModelIdFromModel(modelName);
  const models = getProviderModels(provider, capability);

  return models.includes(modelId);
}

// Get rate limit configuration for provider
function getProviderRateLimit(providerName) {
  const configs = getProviderConfigs();
  const config = configs[providerName];
  if (!config) return null;

  return config.rateLimit;
}

// Initialize provider clients
function initializeProviderClients() {
  const clients = {};
  const availableProviders = getAvailableProviders();

  for (const provider of availableProviders) {
    try {
      clients[provider] = createProviderClient(provider);
      logger.info(`Initialized ${provider} client`);
    } catch (error) {
      logger.error(`Failed to initialize ${provider} client`, {
        error: error.message,
      });
    }
  }

  return clients;
}

export {
  getProviderConfigs,
  createProviderClient,
  getProviderConfig,
  getAvailableProviders,
  getProviderModels,
  providerSupportsCapability,
  getProviderParameters,
  validateProviderParameters,
  formatModelName,
  parseModelName,
  modelSupportsCapability,
  getProviderRateLimit,
  initializeProviderClients,
};
