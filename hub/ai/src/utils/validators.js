import Joi from "joi";
import {
  validateReasoningConfig,
  getReasoningConfigSchema,
} from "./reasoningConfig.js";

// Environment validation schema
const envSchema = Joi.object({
  // Server Configuration
  AI_SERVICE_PORT: Joi.number().integer().min(1).max(65535).default(8080),
  AI_SERVICE_HOST: Joi.string().default("0.0.0.0"),
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),

  // AI Provider API Keys
  GROQ_API_KEY: Joi.string().optional(),
  OPENROUTER_API_KEY: Joi.string().optional(),
  NANOGPT_API_KEY: Joi.string().optional(),

  // Redis Configuration
  REDIS_URL: Joi.string().default("redis://localhost:6379"),
  REDIS_PASSWORD: Joi.string().allow("").optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(10),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: Joi.boolean().default(false),

  // WebSocket Configuration
  WS_HEARTBEAT_INTERVAL: Joi.number().integer().min(5000).default(30000),
  WS_MAX_CONNECTIONS: Joi.number().integer().min(1).default(1000),
  WS_CONNECTION_TIMEOUT: Joi.number().integer().min(30000).default(120000),

  // Model Configuration
  MODEL_CACHE_TTL: Joi.number().integer().min(60000).default(600000),
  MODEL_REFRESH_INTERVAL: Joi.number().integer().min(300000).default(3600000),
  MAX_MODEL_CACHE_SIZE: Joi.number().integer().min(100).default(1000),

  // Request Configuration
  MAX_REQUEST_SIZE_MB: Joi.number().min(1).max(100).default(10),
  REQUEST_TIMEOUT_MS: Joi.number().integer().min(30000).default(120000),
  MAX_CONCURRENT_REQUESTS: Joi.number().integer().min(1).default(50),

  // Monitoring and Metrics
  METRICS_PORT: Joi.number().integer().min(1).max(65535).default(9090),
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_PATH: Joi.string().default("/metrics"),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug")
    .default("info"),
  LOG_FORMAT: Joi.string().valid("json", "simple", "pretty").default("json"),
  LOG_FILE: Joi.string().default("logs/ai-service.log"),

  // Security
  CORS_ORIGINS: Joi.string().default("*"),
  API_KEY_REQUIRED: Joi.boolean().default(false),
  API_KEY: Joi.string().optional(),

  // Provider Specific Settings
  GROQ_BASE_URL: Joi.string().default("https://api.groq.com/openai/v1"),
  OPENROUTER_BASE_URL: Joi.string().default("https://openrouter.ai/api/v1"),
  NANOGPT_BASE_URL: Joi.string().default("https://api.nanogpt.com/v1"),

  // Fallback Configuration
  FALLBACK_ENABLED: Joi.boolean().default(true),
  FALLBACK_RETRY_ATTEMPTS: Joi.number().integer().min(0).default(3),
  FALLBACK_RETRY_DELAY: Joi.number().integer().min(0).default(1000),
}).unknown(true);

// Request validation schemas
const aiRequestSchema = Joi.object({
  requestId: Joi.string().uuid().required(),
  model: Joi.string().required(),
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string()
          .valid("system", "user", "assistant", "tool")
          .required(),
        content: Joi.alternatives()
          .try(
            Joi.string(),
            Joi.array().items(
              Joi.object({
                type: Joi.string().valid("text", "image_url").required(),
                text: Joi.string().when("type", {
                  is: "text",
                  then: Joi.required(),
                }),
                image_url: Joi.object({
                  url: Joi.string().uri().required(),
                  detail: Joi.string().valid("auto", "low", "high").optional(),
                }).when("type", { is: "image_url", then: Joi.required() }),
              })
            )
          )
          .required(),
        name: Joi.string().optional(),
        tool_calls: Joi.array().optional(),
        tool_call_id: Joi.string().optional(),
      })
    )
    .required(),
  parameters: Joi.object({
    temperature: Joi.number().min(0).max(2).default(0.7),
    top_p: Joi.number().min(0).max(1).default(1),
    top_k: Joi.number().integer().min(0).max(100).optional(),
    frequency_penalty: Joi.number().min(-2).max(2).default(0),
    presence_penalty: Joi.number().min(-2).max(2).default(0),
    repetition_penalty: Joi.number().min(0).max(2).optional(),
    min_p: Joi.number().min(0).max(1).optional(),
    top_a: Joi.number().min(0).max(1).optional(),
    max_tokens: Joi.number().integer().min(1).max(32768).optional(),
    max_completion_tokens: Joi.number().integer().min(1).max(32768).optional(),
    stream: Joi.boolean().default(false),
    tools: Joi.array().optional(),
    tool_choice: Joi.alternatives()
      .try(
        Joi.string().valid("none", "auto", "required"),
        Joi.object({
          type: Joi.string().valid("function").required(),
          function: Joi.object({
            name: Joi.string().required(),
          }).required(),
        })
      )
      .optional(),
    reasoning: Joi.object({
      enabled: Joi.boolean().default(false),
      exclude: Joi.boolean().default(false),
      effort: Joi.string().valid("low", "medium", "high").default("medium"),
      maxTokens: Joi.number().min(0).allow(null).default(null),
      format: Joi.string().valid("hidden", "raw", "parsed").default("raw"),
      separate: Joi.boolean().default(true),
      legacyFormat: Joi.boolean().default(false),
    }).optional(),
    web_search: Joi.boolean().default(false),
    plugins: Joi.array().optional(),
  }).default({}),
  capabilities: Joi.object({
    vision: Joi.boolean().default(false),
    tools: Joi.boolean().default(false),
    reasoning: Joi.boolean().default(false),
    maxContext: Joi.number().integer().min(1024).default(8192),
  }).default({}),
  userId: Joi.string().optional(),
  guildId: Joi.string().optional(),
  stream: Joi.boolean().default(false),
}).unknown(true);

const modelRequestSchema = Joi.object({
  provider: Joi.string().valid("groq", "openrouter", "nanogpt").optional(),
  capability: Joi.string()
    .valid(
      "text",
      "vision",
      "reasoning",
      "image_generation",
      "speech_recognition",
      "subscription"
    )
    .optional(),
  refresh: Joi.boolean().default(false),
  // User context for subscription filtering
  userId: Joi.string().optional(),
  // Price filtering parameters
  maxPricePerMillion: Joi.number().positive().optional(),
  minContextLength: Joi.number().integer().min(1024).optional(),
  costCategory: Joi.string().valid("cheap", "moderate", "expensive").optional(),
  // Sorting parameters
  sortBy: Joi.string()
    .valid("price", "name", "provider", "featured")
    .optional(),
  sortOrder: Joi.string().valid("asc", "desc").default("asc").optional(),
  // Search parameters
  q: Joi.string().min(1).optional(),
  active: Joi.boolean().optional(),
  preferred: Joi.boolean().optional(),
  // Pagination and limits
  limit: Joi.number().integer().min(1).max(100).optional(),
  // Price range parameters (for /by-price endpoint)
  min: Joi.number().min(0).optional(),
  max: Joi.number().positive().optional(),
});

const streamingRequestSchema = Joi.object({
  requestId: Joi.string().uuid().required(),
  action: Joi.string().valid("start", "stop", "pause", "resume").required(),
  model: Joi.string().when("action", {
    is: "start",
    then: Joi.required(),
  }),
  messages: Joi.array().when("action", {
    is: "start",
    then: Joi.required(),
  }),
  parameters: Joi.object().when("action", {
    is: "start",
    then: Joi.required(),
  }),
});

// WebSocket message validation
const wsMessageSchema = Joi.object({
  type: Joi.string()
    .valid(
      "ai_request",
      "stream_control",
      "model_request",
      "health_check",
      "ping",
      "pong"
    )
    .required(),
  requestId: Joi.string().uuid().required(),
  data: Joi.object().required(),
  timestamp: Joi.number()
    .integer()
    .min(Date.now() - 300000)
    .max(Date.now() + 300000)
    .optional(),
});

// Provider configuration validation
const providerConfigSchema = Joi.object({
  name: Joi.string().valid("groq", "openrouter", "nanogpt").required(),
  apiKey: Joi.string().required(),
  baseURL: Joi.string().uri().required(),
  timeout: Joi.number().integer().min(5000).default(30000),
  maxRetries: Joi.number().integer().min(0).default(3),
  retryDelay: Joi.number().integer().min(0).default(1000),
  rateLimit: Joi.object({
    windowMs: Joi.number().integer().min(1000).default(60000),
    maxRequests: Joi.number().integer().min(1).default(10),
  }).default(),
  models: Joi.object({
    text: Joi.array().items(Joi.string()).default([]),
    vision: Joi.array().items(Joi.string()).default([]),
    reasoning: Joi.array().items(Joi.string()).default([]),
  }).default(),
});

// Validation functions
function validateEnvironment() {
  const { error, value } = envSchema.validate(process.env);

  if (error) {
    console.error("Environment validation error:", error.details[0].message);
    throw new Error(
      `Invalid environment configuration: ${error.details[0].message}`
    );
  }

  // Update process.env with validated values
  Object.assign(process.env, value);

  // Check if at least one AI provider is configured
  const hasProvider =
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.NANOGPT_API_KEY;

  if (!hasProvider) {
    throw new Error(
      "At least one AI provider API key must be configured (GROQ_API_KEY, OPENROUTER_API_KEY, or NANOGPT_API_KEY)"
    );
  }

  return true;
}

function validateAIRequest(data) {
  const { error, value } = aiRequestSchema.validate(data);

  if (error) {
    throw new Error(`Invalid AI request: ${error.details[0].message}`);
  }

  // Validate reasoning configuration if present
  if (value.reasoning) {
    const validation = validateReasoningConfig(value.reasoning);
    if (!validation.valid) {
      throw new Error(
        `Invalid reasoning configuration: ${validation.errors.join(", ")}`
      );
    }
  }

  return value;
}

function validateModelRequest(data) {
  const { error, value } = modelRequestSchema.validate(data);

  if (error) {
    throw new Error(`Invalid model request: ${error.details[0].message}`);
  }

  return value;
}

function validateStreamingRequest(data) {
  const { error, value } = streamingRequestSchema.validate(data);

  if (error) {
    throw new Error(`Invalid streaming request: ${error.details[0].message}`);
  }

  return value;
}

function validateWebSocketMessage(data) {
  const { error, value } = wsMessageSchema.validate(data);

  if (error) {
    throw new Error(`Invalid WebSocket message: ${error.details[0].message}`);
  }

  return value;
}

function validateProviderConfig(data) {
  const { error, value } = providerConfigSchema.validate(data);

  if (error) {
    throw new Error(
      `Invalid provider configuration: ${error.details[0].message}`
    );
  }

  return value;
}

// Utility validation functions
function isValidUUID(uuid) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidModelId(modelId) {
  return (
    typeof modelId === "string" && modelId.length > 0 && modelId.length <= 200
  );
}

function isValidProvider(provider) {
  return ["groq", "openrouter", "nanogpt"].includes(provider);
}

function isValidCapability(capability) {
  return ["text", "vision", "reasoning", null, undefined].includes(capability);
}

function sanitizeModelId(modelId) {
  if (typeof modelId !== "string") return "";
  return modelId.replace(/[^a-zA-Z0-9\-_/]/g, "").substring(0, 200);
}

function sanitizeProvider(provider) {
  if (!isValidProvider(provider)) return null;
  return provider;
}

// Extract provider from model ID (format: "provider/model-id")
function getProviderFromModel(modelId) {
  if (typeof modelId !== "string") return null;

  const parts = modelId.split("/");
  if (parts.length >= 2) {
    const provider = parts[0].toLowerCase();
    return isValidProvider(provider) ? provider : null;
  }

  return null;
}

// Extract model ID from full model string (format: "provider/model-id")
function getModelIdFromModel(modelId) {
  if (typeof modelId !== "string") return null;

  const parts = modelId.split("/");
  if (parts.length >= 2) {
    return parts.slice(1).join("/"); // Handle cases like "openrouter/anthropic/claude"
  }

  return modelId; // Return as-is if no provider prefix
}

// Validate provider-specific parameters
function validateProviderParameters(provider, parameters) {
  if (!isValidProvider(provider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  const defaults = {
    temperature: 0.7,
    top_p: 1,
    top_k: undefined,
    frequency_penalty: 0,
    presence_penalty: 0,
    repetition_penalty: undefined,
    min_p: undefined,
    top_a: undefined,
    max_tokens: undefined,
    max_completion_tokens: undefined,
    stream: false,
    tools: undefined,
    tool_choice: undefined,
    reasoning: undefined,
    web_search: false,
    plugins: undefined,
  };

  // Merge with defaults
  const validated = { ...defaults, ...parameters };

  // Provider-specific validation
  switch (provider) {
    case "groq":
      // Groq doesn't support repetition_penalty, min_p, top_a
      delete validated.repetition_penalty;
      delete validated.min_p;
      delete validated.top_a;
      break;

    case "openrouter":
      // OpenRouter supports all parameters
      break;

    case "nanogpt":
      // NanoGPT has similar limitations to Groq
      delete validated.repetition_penalty;
      delete validated.min_p;
      delete validated.top_a;
      break;
  }

  return validated;
}

export {
  validateEnvironment,
  validateAIRequest,
  validateModelRequest,
  validateStreamingRequest,
  validateWebSocketMessage,
  validateProviderConfig,
  isValidUUID,
  isValidModelId,
  isValidProvider,
  isValidCapability,
  sanitizeModelId,
  sanitizeProvider,
  getProviderFromModel,
  getModelIdFromModel,
  validateProviderParameters,
};
