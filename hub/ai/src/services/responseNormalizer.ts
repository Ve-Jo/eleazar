import { logger } from "../utils/logger.ts";
import {
  GroqResponseAdapter,
  OpenRouterResponseAdapter,
  NanoGPTResponseAdapter,
} from "../adapters/providerAdapters.ts";

class ResponseNormalizer {
  providerAdapters: Record<string, any>;

  constructor() {
    this.providerAdapters = {
      groq: new GroqResponseAdapter(),
      openrouter: new OpenRouterResponseAdapter(),
      nanogpt: new NanoGPTResponseAdapter(),
    };
  }

  async initialize() {
    logger.info("ResponseNormalizer initialized successfully");
    return Promise.resolve();
  }

  normalizeResponse(provider: string, rawResponse: any, options: Record<string, any> = {}) {
    const adapter = this.providerAdapters[provider];
    if (!adapter) {
      throw new Error(`No adapter available for provider: ${provider}`);
    }

    try {
      logger.debug(`Normalizing response for provider: ${provider}`, {
        responseId: rawResponse.id,
        model: rawResponse.model,
      });

      const unifiedResponse = adapter.normalize(rawResponse, options);

      unifiedResponse.metadata = {
        ...unifiedResponse.metadata,
        provider,
        normalized: true,
        normalizedAt: new Date().toISOString(),
      };

      if (options.legacyFormat) {
        return this.convertToLegacyFormat(unifiedResponse);
      }

      logger.debug(`Response normalized successfully for ${provider}`, {
        hasContent: !!unifiedResponse.content?.text,
        hasReasoning: (unifiedResponse.reasoning?.tokens?.length || 0) > 0,
        reasoningEnabled: unifiedResponse.reasoning?.enabled,
        legacyFormat: options.legacyFormat || false,
      });

      return unifiedResponse;
    } catch (error: any) {
      logger.error(`Failed to normalize response for ${provider}`, {
        error: error.message,
        responseId: rawResponse.id,
      });
      throw error;
    }
  }

  normalizeStreamingChunk(
    provider: string,
    chunk: any,
    options: Record<string, any> = {}
  ) {
    const adapter = this.providerAdapters[provider];
    if (!adapter) {
      throw new Error(`No adapter available for provider: ${provider}`);
    }

    try {
      const unifiedChunk = adapter.normalizeChunk(chunk, options);

      logger.debug(`Streaming chunk normalized for ${provider}`, {
        hasContent: !!unifiedChunk.content,
        hasReasoning: !!unifiedChunk.reasoning,
        hasToolCalls: !!unifiedChunk.toolCalls,
      });

      return unifiedChunk;
    } catch (error: any) {
      logger.error(`Failed to normalize streaming chunk for ${provider}`, {
        error: error.message,
        chunkId: chunk.id,
      });
      throw error;
    }
  }

  getSupportedProviders() {
    return Object.keys(this.providerAdapters);
  }

  isProviderSupported(provider: string) {
    return Object.prototype.hasOwnProperty.call(this.providerAdapters, provider);
  }

  convertToLegacyFormat(unifiedResponse: any) {
    const { content, reasoning, usage, model, metadata } = unifiedResponse;

    let legacyReasoning = "";
    if (
      reasoning &&
      reasoning.tokens &&
      reasoning.tokens.length > 0 &&
      !reasoning.excluded
    ) {
      legacyReasoning = reasoning.tokens
        .filter((token: any) => token.type === "text" || token.type === "summary")
        .map((token: any) => token.content || token.text || token.summary || "")
        .join("\n");
    }

    return {
      id: metadata.responseId || `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
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
