import { logger } from "../utils/logger.js";
import {
  GroqResponseAdapter,
  OpenRouterResponseAdapter,
  NanoGPTResponseAdapter,
} from "../adapters/providerAdapters.js";

/**
 * Response Normalizer Service
 * Normalizes responses from different AI providers to a unified format
 * with separate reasoning tokens from main content
 */
class ResponseNormalizer {
  constructor() {
    this.providerAdapters = {
      groq: new GroqResponseAdapter(),
      openrouter: new OpenRouterResponseAdapter(),
      nanogpt: new NanoGPTResponseAdapter(),
    };
  }

  /**
   * Initialize the response normalizer
   * @returns {Promise<void>}
   */
  async initialize() {
    logger.info("ResponseNormalizer initialized successfully");
    // Add any initialization logic here if needed
    return Promise.resolve();
  }

  /**
   * Normalize a provider response to unified format
   * @param {string} provider - Provider name (groq, openrouter, nanogpt)
   * @param {Object} rawResponse - Raw response from provider
   * @param {Object} options - Normalization options
   * @returns {Object} Unified response format
   */
  normalizeResponse(provider, rawResponse, options = {}) {
    const adapter = this.providerAdapters[provider];
    if (!adapter) {
      throw new Error(`No adapter available for provider: ${provider}`);
    }

    try {
      logger.debug(`Normalizing response for provider: ${provider}`, {
        responseId: rawResponse.id,
        model: rawResponse.model,
      });

      // Normalize to unified format
      const unifiedResponse = adapter.normalize(rawResponse, options);

      // Add metadata
      unifiedResponse.metadata = {
        ...unifiedResponse.metadata,
        provider,
        normalized: true,
        normalizedAt: new Date().toISOString(),
      };

      // Apply backward compatibility if requested
      if (options.legacyFormat) {
        return this.convertToLegacyFormat(unifiedResponse);
      }

      logger.debug(`Response normalized successfully for ${provider}`, {
        hasContent: !!unifiedResponse.content?.text,
        hasReasoning: unifiedResponse.reasoning?.tokens?.length > 0,
        reasoningEnabled: unifiedResponse.reasoning?.enabled,
        legacyFormat: options.legacyFormat || false,
      });

      return unifiedResponse;
    } catch (error) {
      logger.error(`Failed to normalize response for ${provider}`, {
        error: error.message,
        responseId: rawResponse.id,
      });
      throw error;
    }
  }

  /**
   * Normalize a streaming chunk to unified format
   * @param {string} provider - Provider name
   * @param {Object} chunk - Streaming chunk from provider
   * @param {Object} options - Normalization options
   * @returns {Object} Unified streaming chunk format
   */
  normalizeStreamingChunk(provider, chunk, options = {}) {
    const adapter = this.providerAdapters[provider];
    if (!adapter) {
      throw new Error(`No adapter available for provider: ${provider}`);
    }

    try {
      // Normalize streaming chunk
      const unifiedChunk = adapter.normalizeChunk(chunk, options);

      logger.debug(`Streaming chunk normalized for ${provider}`, {
        hasContent: !!unifiedChunk.content,
        hasReasoning: !!unifiedChunk.reasoning,
        hasToolCalls: !!unifiedChunk.toolCalls,
      });

      return unifiedChunk;
    } catch (error) {
      logger.error(`Failed to normalize streaming chunk for ${provider}`, {
        error: error.message,
        chunkId: chunk.id,
      });
      throw error;
    }
  }

  /**
   * Get supported providers
   * @returns {Array} List of supported provider names
   */
  getSupportedProviders() {
    return Object.keys(this.providerAdapters);
  }

  /**
   * Check if provider is supported
   * @param {string} provider - Provider name to check
   * @returns {boolean} Whether provider is supported
   */
  isProviderSupported(provider) {
    return this.providerAdapters.hasOwnProperty(provider);
  }

  /**
   * Convert unified response to legacy format for backward compatibility
   * @param {Object} unifiedResponse - Unified response format
   * @returns {Object} Legacy response format
   */
  convertToLegacyFormat(unifiedResponse) {
    const { content, reasoning, usage, model, metadata } = unifiedResponse;

    // Convert structured reasoning back to simple string format
    let legacyReasoning = "";
    if (
      reasoning &&
      reasoning.tokens &&
      reasoning.tokens.length > 0 &&
      !reasoning.excluded
    ) {
      legacyReasoning = reasoning.tokens
        .filter((token) => token.type === "text" || token.type === "summary")
        .map((token) => token.content || token.text || token.summary || "")
        .join("\n");
    }

    // Return OpenAI-compatible format
    return {
      id: metadata.responseId || `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: content.text || "",
            reasoning: legacyReasoning || undefined,
            tool_calls: content.toolCalls || undefined,
          },
          finish_reason: content.finishReason || "stop",
        },
      ],
      usage: usage
        ? {
            prompt_tokens: usage.promptTokens || 0,
            completion_tokens: usage.completionTokens || 0,
            total_tokens: usage.totalTokens || 0,
          }
        : undefined,
      // Include metadata for debugging (non-standard field)
      _metadata: {
        normalized: true,
        normalizedAt: metadata.normalizedAt,
        legacyFormat: true,
        provider: metadata.provider,
      },
    };
  }
}

export { ResponseNormalizer };
