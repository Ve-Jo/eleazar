import { logger } from "./logger.ts";

type ReasoningConfig = {
  enabled?: boolean;
  exclude?: boolean;
  effort?: "low" | "medium" | "high";
  maxTokens?: number | null;
  format?: "hidden" | "raw" | "parsed";
  separate?: boolean;
  legacyFormat?: boolean;
};

const DEFAULT_REASONING_CONFIG: Required<ReasoningConfig> = {
  enabled: false,
  exclude: false,
  effort: "medium",
  maxTokens: null,
  format: "raw",
  separate: true,
  legacyFormat: false,
};

const PROVIDER_REASONING_PARAMS: Record<string, any> = {
  groq: {
    requestParams: (config: Required<ReasoningConfig>) => {
      const params: Record<string, any> = {};
      if (config.enabled) {
        params.include_reasoning = true;
        if (config.effort) {
          params.reasoning_effort = config.effort;
        }
        if (config.format) {
          params.reasoning_format = config.format;
        }
      }
      return params;
    },
    responseOptions: (config: Required<ReasoningConfig>) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
      reasoningEffort: config.effort,
      reasoningFormat: config.format,
    }),
  },
  openrouter: {
    requestParams: (config: Required<ReasoningConfig>) => {
      if (!config.enabled) return {};
      const reasoning: Record<string, any> = {};
      if (config.effort) reasoning.effort = config.effort;
      if (config.maxTokens) reasoning.max_tokens = config.maxTokens;
      if (config.exclude) reasoning.exclude = true;
      if (config.enabled) reasoning.enabled = true;
      return { reasoning };
    },
    responseOptions: (config: Required<ReasoningConfig>) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
      reasoningEffort: config.effort,
      reasoningMaxTokens: config.maxTokens,
    }),
  },
  nanogpt: {
    modelSuffix: (config: Required<ReasoningConfig>) => {
      if (!config.enabled) return "";
      if (config.exclude) return ":reasoning-exclude";
      if (config.effort === "high") return ":thinking";
      if (config.maxTokens) return `:thinking:${config.maxTokens}`;
      return ":thinking";
    },
    responseOptions: (config: Required<ReasoningConfig>) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
    }),
  },
};

function processReasoningConfig(provider: string, config: ReasoningConfig = {}) {
  const mergedConfig = { ...DEFAULT_REASONING_CONFIG, ...config };
  const providerConfig = PROVIDER_REASONING_PARAMS[provider];
  if (!providerConfig) {
    logger.warn(`No reasoning configuration for provider: ${provider}`);
    return {
      requestParams: {},
      responseOptions: { includeReasoning: false, excludeReasoning: true },
    };
  }

  const result: Record<string, any> = {
    requestParams: {},
    responseOptions: {
      includeReasoning: mergedConfig.enabled && !mergedConfig.exclude,
      excludeReasoning: mergedConfig.exclude,
      separate: mergedConfig.separate,
      legacyFormat: mergedConfig.legacyFormat,
    },
  };

  if (providerConfig.requestParams) {
    result.requestParams = providerConfig.requestParams(mergedConfig);
  }
  if (providerConfig.responseOptions) {
    result.responseOptions = {
      ...result.responseOptions,
      ...providerConfig.responseOptions(mergedConfig),
    };
  }
  if (providerConfig.modelSuffix) {
    result.modelSuffix = providerConfig.modelSuffix(mergedConfig);
  }

  return result;
}

function convertLegacyParams(legacyParams: Record<string, any>, provider: string) {
  const config: Required<ReasoningConfig> = { ...DEFAULT_REASONING_CONFIG };
  switch (provider) {
    case "groq":
      if (legacyParams.include_reasoning !== undefined) {
        config.enabled = legacyParams.include_reasoning;
      }
      if (legacyParams.reasoning_effort) config.effort = legacyParams.reasoning_effort;
      if (legacyParams.reasoning_format) config.format = legacyParams.reasoning_format;
      break;
    case "openrouter":
      if (legacyParams.reasoning) {
        const reasoning = legacyParams.reasoning;
        if (reasoning.enabled !== undefined) config.enabled = reasoning.enabled;
        if (reasoning.exclude !== undefined) config.exclude = reasoning.exclude;
        if (reasoning.effort) config.effort = reasoning.effort;
        if (reasoning.max_tokens) config.maxTokens = reasoning.max_tokens;
      }
      break;
    case "nanogpt":
      if (legacyParams.model) {
        const model = legacyParams.model;
        if (model.includes(":reasoning-exclude")) {
          config.exclude = true;
          config.enabled = true;
        } else if (model.includes(":thinking")) {
          config.enabled = true;
          const match = model.match(/:thinking:(\d+)/);
          if (match?.[1]) config.maxTokens = parseInt(match[1], 10);
        }
      }
      break;
  }
  return config;
}

function validateReasoningConfig(config: ReasoningConfig) {
  const errors: string[] = [];
  if (config.effort && !["low", "medium", "high"].includes(config.effort)) {
    errors.push(
      `Invalid effort level: ${config.effort}. Must be 'low', 'medium', or 'high'`
    );
  }
  if (config.format && !["hidden", "raw", "parsed"].includes(config.format)) {
    errors.push(
      `Invalid format: ${config.format}. Must be 'hidden', 'raw', or 'parsed'`
    );
  }
  if (
    config.maxTokens &&
    (typeof config.maxTokens !== "number" || config.maxTokens < 0)
  ) {
    errors.push(
      `Invalid maxTokens: ${config.maxTokens}. Must be a positive number`
    );
  }
  return { valid: errors.length === 0, errors };
}

function getReasoningConfigSchema() {
  return {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: false },
      exclude: { type: "boolean", default: false },
      effort: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
      maxTokens: { type: "number", minimum: 0, nullable: true, default: null },
      format: { type: "string", enum: ["hidden", "raw", "parsed"], default: "raw" },
      separate: { type: "boolean", default: true },
      legacyFormat: { type: "boolean", default: false },
    },
    additionalProperties: false,
  };
}

export {
  processReasoningConfig,
  convertLegacyParams,
  validateReasoningConfig,
  getReasoningConfigSchema,
  DEFAULT_REASONING_CONFIG,
  PROVIDER_REASONING_PARAMS,
};
