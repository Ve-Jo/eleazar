type UnifiedUsage = {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  cost: number | null;
  breakdown: Record<string, unknown> | null;
};

type ReasoningToken = {
  type: string;
  content?: string;
  text?: string;
  summary?: string;
  index?: number;
  format?: string;
  id?: string | null;
  signature?: string | null;
};

type UnifiedResponse = {
  content: {
    text: string;
    toolCalls: unknown[];
    finishReason: string | null;
  };
  reasoning: {
    enabled: boolean;
    excluded: boolean;
    totalTokens: number;
    tokens: ReasoningToken[];
    metadata: Record<string, unknown>;
  };
  usage: UnifiedUsage | null;
  model: string;
  metadata: Record<string, unknown>;
};

type UnifiedStreamChunk = {
  content?: string;
  toolCalls?: unknown[] | unknown | null;
  finishReason?: string | null;
  reasoning?: ReasoningToken | ReasoningToken[] | null;
};

type NormalizerOptions = Record<string, unknown>;

type ProviderMessage = {
  content?: string;
  tool_calls?: unknown[];
  reasoning?: string;
  reasoning_details?: Array<Record<string, any>>;
};

type ProviderChoice = {
  message: ProviderMessage;
  delta?: ProviderMessage;
  finish_reason?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asChoices(value: unknown): ProviderChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((choice) => {
    const choiceRecord = asRecord(choice);
    return {
      message: asRecord(choiceRecord.message) as ProviderMessage,
      delta: asRecord(choiceRecord.delta) as ProviderMessage,
      finish_reason:
        typeof choiceRecord.finish_reason === "string" || choiceRecord.finish_reason === null
          ? (choiceRecord.finish_reason as string | null)
          : null,
    };
  });
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

class BaseResponseAdapter {
  normalize(_response: Record<string, unknown>, _options: NormalizerOptions): UnifiedResponse {
    throw new Error("normalize method must be implemented by subclass");
  }

  normalizeChunk(
    _chunk: Record<string, unknown>,
    _options: NormalizerOptions
  ): UnifiedStreamChunk {
    throw new Error("normalizeChunk method must be implemented by subclass");
  }

  extractUsage(usage: Record<string, unknown> | null | undefined): UnifiedUsage | null {
    if (!usage) return null;

    return {
      promptTokens: Number(usage.prompt_tokens || 0),
      completionTokens: Number(usage.completion_tokens || 0),
      reasoningTokens: Number(usage.reasoning_tokens || 0),
      totalTokens: Number(usage.total_tokens || 0),
      cost: typeof usage.cost === "number" ? usage.cost : null,
      breakdown:
        usage.breakdown && typeof usage.breakdown === "object"
          ? (usage.breakdown as Record<string, unknown>)
          : null,
    };
  }

  extractMetadata(response: Record<string, unknown>) {
    return {
      systemFingerprint: response.system_fingerprint || null,
      created: response.created || Date.now(),
      id: response.id || null,
      object: response.object || null,
    };
  }
}

class GroqResponseAdapter extends BaseResponseAdapter {
  normalize(response: Record<string, unknown>, options: NormalizerOptions): UnifiedResponse {
    const choice = asChoices(response.choices)[0];
    if (!choice) {
      throw new Error("No response choices available from Groq");
    }

    const message = choice.message;
    const usage = this.extractUsage(asRecord(response.usage));

    return {
      content: {
        text: asString(message.content),
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: asString(response.model),
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message: ProviderMessage, options: NormalizerOptions) {
    const reasoning = {
      enabled: !!message.reasoning || options.includeReasoning === true,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [] as ReasoningToken[],
      metadata: {
        effort: options.reasoningEffort || null,
        format: options.reasoningFormat || null,
      },
    };

    if (message.reasoning && !options.excludeReasoning) {
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

  normalizeChunk(chunk: Record<string, any>, options: Record<string, any>) {
    const choice = chunk.choices?.[0];
    if (!choice) return {};

    const delta = choice.delta;
    const unifiedChunk: Record<string, any> = {
      content: delta.content || "",
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

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

  estimateReasoningTokens(reasoningText: string) {
    if (!reasoningText) return 0;
    return Math.ceil(reasoningText.length / 4);
  }
}

class OpenRouterResponseAdapter extends BaseResponseAdapter {
  normalize(response: Record<string, unknown>, options: NormalizerOptions): UnifiedResponse {
    const choice = asChoices(response.choices)[0];
    if (!choice) {
      throw new Error("No response choices available from OpenRouter");
    }

    const message = choice.message;
    const usage = this.extractUsage(asRecord(response.usage));

    return {
      content: {
        text: asString(message.content),
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: asString(response.model),
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message: ProviderMessage, options: NormalizerOptions) {
    const reasoning = {
      enabled: !!message.reasoning_details || options.includeReasoning === true,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [] as ReasoningToken[],
      metadata: {
        effort: options.reasoningEffort || null,
        maxTokens: options.reasoningMaxTokens || null,
      },
    };

    if (message.reasoning_details && !options.excludeReasoning) {
      reasoning.tokens = message.reasoning_details.map((detail: any) => ({
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

  mapReasoningType(type: string) {
    const typeMap: Record<string, string> = {
      "reasoning.summary": "summary",
      "reasoning.encrypted": "encrypted",
      "reasoning.text": "text",
    };
    return typeMap[type] || "text";
  }

  extractReasoningContent(detail: Record<string, any>) {
    if (detail.type === "reasoning.summary") return detail.summary || "";
    if (detail.type === "reasoning.encrypted") return detail.data || "";
    if (detail.type === "reasoning.text") return detail.text || "";
    return "";
  }

  normalizeChunk(chunk: Record<string, unknown>, options: NormalizerOptions) {
    const choice = asChoices(chunk.choices)[0];
    if (!choice) return {};

    const delta = choice.delta || {};
    const unifiedChunk: UnifiedStreamChunk = {
      content: asString(delta.content),
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

    if (delta.reasoning_details && !options.excludeReasoning) {
      unifiedChunk.reasoning = delta.reasoning_details.map((detail: any) => ({
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

  calculateReasoningTokens(tokens: ReasoningToken[]) {
    return tokens.reduce((total, token) => {
      return total + Math.ceil((token.content?.length || 0) / 4);
    }, 0);
  }
}

class NanoGPTResponseAdapter extends BaseResponseAdapter {
  normalize(response: Record<string, unknown>, options: NormalizerOptions): UnifiedResponse {
    const choice = asChoices(response.choices)[0];
    if (!choice) {
      throw new Error("No response choices available from NanoGPT");
    }

    const message = choice.message;
    const usage = this.extractUsage(asRecord(response.usage));

    return {
      content: {
        text: asString(message.content),
        toolCalls: message.tool_calls || [],
        finishReason: choice.finish_reason || null,
      },
      reasoning: this.extractReasoning(message, options),
      usage,
      model: asString(response.model),
      metadata: this.extractMetadata(response),
    };
  }

  extractReasoning(message: ProviderMessage, options: NormalizerOptions) {
    const reasoning = {
      enabled: !!message.reasoning || options.includeReasoning === true,
      excluded: options.excludeReasoning === true,
      totalTokens: 0,
      tokens: [] as ReasoningToken[],
      metadata: {
        suffixConfig: options.modelSuffix || null,
      },
    };

    if (message.reasoning && !options.excludeReasoning) {
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

  normalizeChunk(chunk: Record<string, any>, options: Record<string, any>) {
    const choice = chunk.choices?.[0];
    if (!choice) return {};

    const delta = choice.delta;
    const unifiedChunk: Record<string, any> = {
      content: delta.content || "",
      toolCalls: delta.tool_calls || null,
      finishReason: choice.finish_reason || null,
      reasoning: null,
    };

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

  estimateReasoningTokens(reasoningText: string) {
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
export type {
  UnifiedUsage,
  ReasoningToken,
  UnifiedResponse,
  UnifiedStreamChunk,
  NormalizerOptions,
};
