import { logger } from "../utils/logger.js";

/**
 * Base Response Adapter
 * Abstract base class for provider-specific response adapters
 */
class BaseResponseAdapter {
  /**
   * Normalize a provider response to unified format
   * @param {Object} response - Raw provider response
   * @param {Object} options - Normalization options
   * @returns {Object} Unified response format
   */
  normalize(response, options) {
    throw new Error("normalize method must be implemented by subclass");
  }

  /**
   * Normalize a streaming chunk
   * @param {Object} chunk - Streaming chunk
   * @param {Object} options - Normalization options
   * @returns {Object} Unified streaming chunk
   */
  normalizeChunk(chunk, options) {
    throw new Error("normalizeChunk method must be implemented by subclass");
  }

  /**
   * Extract usage information
   * @param {Object} usage - Provider usage data
   * @returns {Object} Unified usage format
   */
  extractUsage(usage) {
    if (!usage) return null;

    return {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      reasoningTokens: usage.reasoning_tokens || 0,
      totalTokens: usage.total_tokens || 0,
      cost: usage.cost || null,
      breakdown: usage.breakdown || null,
    };
  }

  /**
   * Extract metadata
   * @param {Object} response - Provider response
   * @returns {Object} Unified metadata
   */
  extractMetadata(response) {
    return {
      systemFingerprint: response.system_fingerprint || null,
      created: response.created || Date.now(),
      id: response.id || null,
      object: response.object || null,
    };
  }
}

/**
 * Groq Response Adapter
 * Adapts Groq API responses to unified format
 */
class GroqResponseAdapter extends BaseResponseAdapter {
  normalize(response, options) {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("No response choices available from Groq");
    }

    const message = choice.message;
    const usage = this.extractUsage(response.usage);

    return {
      content: {
        text: message.content || "",
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: response.model,
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message, options) {
    const reasoning = {
      enabled: !!message.reasoning || options.includeReasoning,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [],
      metadata: {
        effort: options.reasoningEffort || null,
        format: options.reasoningFormat || null,
      },
    };

    if (message.reasoning && !options.excludeReasoning) {
      // Convert Groq's simple reasoning string to structured format
      reasoning.tokens.push({
        type: "text",
        content: message.reasoning,
        index: 0,
        format: "groq-v1",
      });
      reasoning.totalTokens = this.estimateReasoningTokens(message.reasoning);
    }

    return reasoning;
  }

  normalizeChunk(chunk, options) {
    const choice = chunk.choices?.[0];
    if (!choice) return {};

    const delta = choice.delta;
    const unifiedChunk = {
      content: delta.content || "",
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

    // Handle reasoning in streaming chunks
    if (delta.reasoning && !options.excludeReasoning) {
      unifiedChunk.reasoning = {
        type: "text",
        content: delta.reasoning,
        index: 0,
        format: "groq-v1",
      };
    }

    return unifiedChunk;
  }

  estimateReasoningTokens(reasoningText) {
    if (!reasoningText) return 0;
    // Rough estimation: ~4 characters per token
    return Math.ceil(reasoningText.length / 4);
  }
}

/**
 * OpenRouter Response Adapter
 * Adapts OpenRouter API responses to unified format
 */
class OpenRouterResponseAdapter extends BaseResponseAdapter {
  normalize(response, options) {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("No response choices available from OpenRouter");
    }

    const message = choice.message;
    const usage = this.extractUsage(response.usage);

    return {
      content: {
        text: message.content || "",
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: response.model,
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message, options) {
    const reasoning = {
      enabled: !!message.reasoning_details || options.includeReasoning,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [],
      metadata: {
        effort: options.reasoningEffort || null,
        maxTokens: options.reasoningMaxTokens || null,
      },
    };

    if (message.reasoning_details && !options.excludeReasoning) {
      // Use OpenRouter's sophisticated reasoning_details format
      reasoning.tokens = message.reasoning_details.map((detail) => ({
        type: this.mapReasoningType(detail.type),
        content: this.extractReasoningContent(detail),
        index: detail.index,
        format: detail.format || "anthropic-claude-v1",
        id: detail.id || null,
        signature: detail.signature || null,
      }));
      reasoning.totalTokens = this.calculateReasoningTokens(reasoning.tokens);
    }

    return reasoning;
  }

  mapReasoningType(type) {
    const typeMap = {
      "reasoning.summary": "summary",
      "reasoning.encrypted": "encrypted",
      "reasoning.text": "text",
    };
    return typeMap[type] || "text";
  }

  extractReasoningContent(detail) {
    if (detail.type === "reasoning.summary") return detail.summary || "";
    if (detail.type === "reasoning.encrypted") return detail.data || "";
    if (detail.type === "reasoning.text") return detail.text || "";
    return "";
  }

  normalizeChunk(chunk, options) {
    const choice = chunk.choices?.[0];
    if (!choice) return {};

    const delta = choice.delta;
    const unifiedChunk = {
      content: delta.content || "",
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

    // Handle OpenRouter's sophisticated reasoning_details streaming
    if (delta.reasoning_details && !options.excludeReasoning) {
      unifiedChunk.reasoning = delta.reasoning_details.map((detail) => ({
        type: this.mapReasoningType(detail.type),
        content: this.extractReasoningContent(detail),
        index: detail.index,
        format: detail.format || "anthropic-claude-v1",
        id: detail.id || null,
        signature: detail.signature || null,
      }));
    }

    return unifiedChunk;
  }

  calculateReasoningTokens(tokens) {
    return tokens.reduce((total, token) => {
      return total + Math.ceil((token.content?.length || 0) / 4);
    }, 0);
  }
}

/**
 * NanoGPT Response Adapter
 * Adapts NanoGPT API responses to unified format
 */
class NanoGPTResponseAdapter extends BaseResponseAdapter {
  normalize(response, options) {
    const choice = response.choices?.[0];
    if (!choice) {
      throw new Error("No response choices available from NanoGPT");
    }

    const message = choice.message;
    const usage = this.extractUsage(response.usage);

    return {
      content: {
        text: message.content || "",
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: response.model,
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message, options) {
    const reasoning = {
      enabled: !!message.reasoning || options.includeReasoning,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [],
      metadata: {
        // NanoGPT uses model suffixes for configuration
        suffixConfig: options.modelSuffix || null,
      },
    };

    if (message.reasoning && !options.excludeReasoning) {
      // Convert NanoGPT's reasoning to structured format
      reasoning.tokens.push({
        type: "text",
        content: message.reasoning,
        index: 0,
        format: "nanogpt-v1",
      });
      reasoning.totalTokens = this.estimateReasoningTokens(message.reasoning);
    }

    return reasoning;
  }

  normalizeChunk(chunk, options) {
    const choice = chunk.choices?.[0];
    if (!choice) return {};

    const delta = choice.delta;
    const unifiedChunk = {
      content: delta.content || "",
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

    // Handle reasoning in streaming chunks
    if (delta.reasoning && !options.excludeReasoning) {
      unifiedChunk.reasoning = {
        type: "text",
        content: delta.reasoning,
        index: 0,
        format: "nanogpt-v1",
      };
    }

    return unifiedChunk;
  }

  estimateReasoningTokens(reasoningText) {
    if (!reasoningText) return 0;
    return Math.ceil(reasoningText.length / 4);
  }
}

export {
  BaseResponseAdapter,
  GroqResponseAdapter,
  OpenRouterResponseAdapter,
  NanoGPTResponseAdapter,
};
