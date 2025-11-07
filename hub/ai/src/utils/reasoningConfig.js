/**
 * Reasoning Configuration Utility
 * Handles unified reasoning token configuration across all providers
 */

/**
 * Unified reasoning configuration options
 * @typedef {Object} ReasoningConfig
 * @property {boolean} enabled - Whether to enable reasoning tokens
 * @property {boolean} exclude - Whether to exclude reasoning from response
 * @property {string} effort - Reasoning effort level ('low', 'medium', 'high')
 * @property {number} maxTokens - Maximum reasoning tokens (Anthropic-style)
 * @property {string} format - Output format ('hidden', 'raw', 'parsed')
 * @property {boolean} separate - Whether to keep reasoning separate from content
 * @property {boolean} legacyFormat - Whether to use legacy response format
 */

/**
 * Default reasoning configuration
 */
const DEFAULT_REASONING_CONFIG = {
  enabled: false,
  exclude: false,
  effort: "medium",
  maxTokens: null,
  format: "raw",
  separate: true,
  legacyFormat: false,
};

/**
 * Provider-specific reasoning parameter mappings
 */
const PROVIDER_REASONING_PARAMS = {
  groq: {
    // Groq uses include_reasoning, reasoning_effort, reasoning_format
    requestParams: (config) => {
      const params = {};
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
    responseOptions: (config) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
      reasoningEffort: config.effort,
      reasoningFormat: config.format,
    }),
  },

  openrouter: {
    // OpenRouter uses reasoning object with effort/max_tokens/exclude/enabled
    requestParams: (config) => {
      if (!config.enabled) return {};

      const reasoning = {};

      if (config.effort) {
        reasoning.effort = config.effort;
      }

      if (config.maxTokens) {
        reasoning.max_tokens = config.maxTokens;
      }

      if (config.exclude) {
        reasoning.exclude = true;
      }

      if (config.enabled) {
        reasoning.enabled = true;
      }

      return { reasoning };
    },
    responseOptions: (config) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
      reasoningEffort: config.effort,
      reasoningMaxTokens: config.maxTokens,
    }),
  },

  nanogpt: {
    // NanoGPT uses model suffixes
    modelSuffix: (config) => {
      if (!config.enabled) return "";

      let suffix = "";

      if (config.exclude) {
        suffix = ":reasoning-exclude";
      } else if (config.effort === "high") {
        suffix = ":thinking";
      } else if (config.maxTokens) {
        suffix = `:thinking:${config.maxTokens}`;
      } else {
        suffix = ":thinking";
      }

      return suffix;
    },
    responseOptions: (config) => ({
      includeReasoning: config.enabled && !config.exclude,
      excludeReasoning: config.exclude,
      modelSuffix: this.modelSuffix(config),
    }),
  },
};

/**
 * Process unified reasoning configuration for a specific provider
 * @param {string} provider - Provider name
 * @param {ReasoningConfig} config - Unified reasoning configuration
 * @returns {Object} Provider-specific request parameters and response options
 */
function processReasoningConfig(provider, config = {}) {
  // Merge with defaults
  const mergedConfig = { ...DEFAULT_REASONING_CONFIG, ...config };

  const providerConfig = PROVIDER_REASONING_PARAMS[provider];
  if (!providerConfig) {
    logger.warn(`No reasoning configuration for provider: ${provider}`);
    return {
      requestParams: {},
      responseOptions: {
        includeReasoning: false,
        excludeReasoning: true,
      },
    };
  }

  const result = {
    requestParams: {},
    responseOptions: {
      includeReasoning: mergedConfig.enabled && !mergedConfig.exclude,
      excludeReasoning: mergedConfig.exclude,
      separate: mergedConfig.separate,
      legacyFormat: mergedConfig.legacyFormat,
    },
  };

  // Add provider-specific request parameters
  if (providerConfig.requestParams) {
    result.requestParams = providerConfig.requestParams(mergedConfig);
  }

  // Add provider-specific response options
  if (providerConfig.responseOptions) {
    result.responseOptions = {
      ...result.responseOptions,
      ...providerConfig.responseOptions(mergedConfig),
    };
  }

  // Handle model suffix for NanoGPT
  if (providerConfig.modelSuffix) {
    result.modelSuffix = providerConfig.modelSuffix(mergedConfig);
  }

  return result;
}

/**
 * Convert legacy reasoning parameters to unified format
 * @param {Object} legacyParams - Legacy provider-specific parameters
 * @param {string} provider - Provider name
 * @returns {ReasoningConfig} Unified reasoning configuration
 */
function convertLegacyParams(legacyParams, provider) {
  const config = { ...DEFAULT_REASONING_CONFIG };

  switch (provider) {
    case "groq":
      if (legacyParams.include_reasoning !== undefined) {
        config.enabled = legacyParams.include_reasoning;
      }
      if (legacyParams.reasoning_effort) {
        config.effort = legacyParams.reasoning_effort;
      }
      if (legacyParams.reasoning_format) {
        config.format = legacyParams.reasoning_format;
      }
      break;

    case "openrouter":
      if (legacyParams.reasoning) {
        const reasoning = legacyParams.reasoning;
        if (reasoning.enabled !== undefined) {
          config.enabled = reasoning.enabled;
        }
        if (reasoning.exclude !== undefined) {
          config.exclude = reasoning.exclude;
        }
        if (reasoning.effort) {
          config.effort = reasoning.effort;
        }
        if (reasoning.max_tokens) {
          config.maxTokens = reasoning.max_tokens;
        }
      }
      break;

    case "nanogpt":
      // Model suffixes are handled separately in the model name
      if (legacyParams.model) {
        const model = legacyParams.model;
        if (model.includes(":reasoning-exclude")) {
          config.exclude = true;
          config.enabled = true;
        } else if (model.includes(":thinking")) {
          config.enabled = true;
          // Extract max tokens from suffix if present
          const match = model.match(/:thinking:(\d+)/);
          if (match) {
            config.maxTokens = parseInt(match[1]);
          }
        }
      }
      break;
  }

  return config;
}

/**
 * Validate reasoning configuration
 * @param {ReasoningConfig} config - Configuration to validate
 * @returns {Object} Validation result with errors if any
 */
function validateReasoningConfig(config) {
  const errors = [];

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

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get reasoning configuration schema
 * @returns {Object} JSON schema for reasoning configuration
 */
function getReasoningConfigSchema() {
  return {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: false },
      exclude: { type: "boolean", default: false },
      effort: {
        type: "string",
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      maxTokens: {
        type: "number",
        minimum: 0,
        nullable: true,
        default: null,
      },
      format: {
        type: "string",
        enum: ["hidden", "raw", "parsed"],
        default: "raw",
      },
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
