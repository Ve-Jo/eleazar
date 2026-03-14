import { logger } from "../utils/logger.ts";
import {
  validateAIRequest,
  validateProviderParameters,
  getProviderFromModel,
  getModelIdFromModel,
} from "../utils/validators.ts";
import {
  ProviderError,
  RateLimitError,
  TimeoutError,
} from "../middleware/errorHandler.ts";
import {
  recordAIRequest,
  recordTokenUsage,
  updateStreamingConnections,
} from "../middleware/metrics.ts";
import { MultimediaModelsService } from "./multimediaModels.ts";
import { processReasoningConfig } from "../utils/reasoningConfig.ts";
import { EnhancedModelService } from "./modelService.ts";
import { RateLimitService } from "./rateLimitService.ts";
import { CacheService } from "./cacheService.ts";
import { StreamingService } from "./streamingService.ts";
import { ResponseNormalizer } from "./responseNormalizer.ts";

type ActiveRequest = {
  startTime: number;
  provider: string;
  model: string;
  userId?: string;
  guildId?: string;
};

type ProviderClient = {
  chat: {
    completions: {
      create: (
        request: Record<string, unknown>,
        options?: { signal?: AbortSignal }
      ) => Promise<any>;
    };
  };
};

type AIMessageContentPart = {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

type AIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | AIMessageContentPart[];
  name?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
};

type AIRequestParameters = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  min_p?: number;
  top_a?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  reasoning?: Record<string, unknown>;
  web_search?: boolean;
  plugins?: unknown[];
  [key: string]: unknown;
};

type AIRequestCapabilities = {
  vision?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  maxContext?: number;
};

type ValidatedAIRequest = {
  requestId: string;
  model: string;
  messages: AIMessage[];
  parameters?: AIRequestParameters;
  capabilities?: AIRequestCapabilities;
  userId?: string;
  guildId?: string;
  stream?: boolean;
  reasoning?: Record<string, unknown>;
  sessionId?: string;
  provider?: string;
};

class AIProcessingService {
  providerClients: Record<string, ProviderClient>;
  modelService: EnhancedModelService;
  rateLimitService: RateLimitService;
  cacheService: CacheService;
  streamingService: StreamingService;
  responseNormalizer: ResponseNormalizer;
  multimediaService: MultimediaModelsService;
  circuitBreakers: Map<string, any>;
  activeRequests: Map<string, ActiveRequest>;
  requestTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  abortControllers: Map<string, AbortController>;

  constructor(
    providerClients: Record<string, ProviderClient>,
    modelService: EnhancedModelService,
    rateLimitService: RateLimitService,
    cacheService: CacheService,
    streamingService: StreamingService,
    responseNormalizer: ResponseNormalizer
  ) {
    this.providerClients = providerClients;
    this.modelService = modelService;
    this.rateLimitService = rateLimitService;
    this.cacheService = cacheService;
    this.streamingService = streamingService;
    this.responseNormalizer = responseNormalizer;
    this.multimediaService = new MultimediaModelsService();
    this.circuitBreakers = new Map();
    this.activeRequests = new Map();
    this.requestTimeouts = new Map();
    this.abortControllers = new Map();
  }

  async initialize() {
    logger.info("Initializing AI processing service...");
    logger.info("AI processing service initialized", {
      providers: Object.keys(this.providerClients),
      circuitBreakers: this.circuitBreakers.size,
    });
  }

  async processRequest(requestData: ValidatedAIRequest & Record<string, unknown>) {
    const startTime = Date.now();
    let requestId: string | undefined;
    let provider: string | null = null;
    let model: string | undefined;

    try {
      const { sessionId, provider: _providedProvider, ...requestForValidation } =
        requestData;
      const validatedRequest = validateAIRequest(requestForValidation) as ValidatedAIRequest;
      requestId = validatedRequest.requestId;
      model = validatedRequest.model;
      provider = getProviderFromModel(model);

      if (!provider) {
        throw new Error(`Invalid model format: ${model}`);
      }

      const requestIdValue = validatedRequest.requestId as string;
      const modelValue = validatedRequest.model as string;

      logger.info("Processing AI request", {
        requestId,
        provider,
        model,
        stream: validatedRequest.stream,
        userId: validatedRequest.userId,
        guildId: validatedRequest.guildId,
      });

      await this.checkRateLimits(provider, modelValue, validatedRequest.userId);

      const modelDetails = this.modelService.getModelDetails(modelValue);
      if (!modelDetails) {
        throw new Error(`Model not found: ${model}`);
      }

      this.validateCapabilities(modelDetails, validatedRequest);
      this.setupRequestTimeout(requestIdValue);

      this.activeRequests.set(requestIdValue, {
        startTime,
        provider,
        model: modelValue,
        userId: validatedRequest.userId,
        guildId: validatedRequest.guildId,
      });

      const result = validatedRequest.stream
        ? await this.processStreamingRequest(requestIdValue, validatedRequest)
        : await this.processNonStreamingRequest(requestIdValue, validatedRequest);

      const duration = (Date.now() - startTime) / 1000;
      recordAIRequest(provider, modelValue, "success", duration);
      this.cleanupRequest(requestIdValue);
      return result;
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      if (provider && model) {
        const errorType = this.classifyError(error);
        recordAIRequest(provider, model, "error", duration, errorType);
      }
      if (requestId) {
        this.cleanupRequest(requestId);
      }
      throw error;
    }
  }

  async processStreamingRequest(requestId: string, request: ValidatedAIRequest) {
    const { model, messages, parameters, userId, guildId } = request;
    const provider = getProviderFromModel(model) as string;
    const modelId = getModelIdFromModel(model);
    if (!modelId) {
      throw new Error(`Invalid model ID for model: ${model}`);
    }

    logger.info("Processing streaming request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    const sessionId = this.findSessionForRequest(requestId);
    if (!sessionId) {
      throw new Error("No WebSocket session found for streaming request");
    }

    updateStreamingConnections(provider, model, 1);

    try {
      const providerRequest = this.prepareProviderRequest(
        provider,
        modelId,
        messages,
        parameters,
        true,
        request.reasoning
      );

      const stream = await this.executeStreamingRequest(
        provider,
        providerRequest,
        requestId
      );

      await this.processStreamingResponse(
        sessionId,
        requestId,
        stream,
        provider,
        model
      );

      return {
        requestId,
        status: "streaming",
        message: "Streaming response started",
      };
    } catch (error) {
      updateStreamingConnections(provider, model, -1);
      throw error;
    }
  }

  async processNonStreamingRequest(requestId: string, request: ValidatedAIRequest) {
    const { model, messages, parameters, userId, guildId } = request;
    const provider = getProviderFromModel(model) as string;
    const modelId = getModelIdFromModel(model);
    if (!modelId) {
      throw new Error(`Invalid model ID for model: ${model}`);
    }

    logger.info("Processing non-streaming request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    try {
      const cacheKey = this.generateCacheKey(request);
      const cachedResponse = await this.cacheService.get(cacheKey);
      if (cachedResponse) {
        logger.debug("Returning cached response", { requestId });
        return cachedResponse;
      }

      const providerRequest = this.prepareProviderRequest(
        provider,
        modelId,
        messages,
        parameters,
        false,
        request.reasoning
      );

      const response = await this.executeProviderRequest(provider, providerRequest);
      const processedResponse = this.processProviderResponse(provider, response);
      await this.cacheService.set(cacheKey, processedResponse, 300000);

      if (response.usage) {
        recordTokenUsage(
          provider,
          model,
          response.usage.prompt_tokens || 0,
          response.usage.completion_tokens || 0
        );
      }

      return processedResponse;
    } catch (error: any) {
      throw this.handleProviderError(provider, error);
    }
  }

  async executeStreamingRequest(
    provider: string,
    request: Record<string, unknown>,
    requestId: string
  ) {
    const client = this.providerClients[provider];
    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    try {
      const controller = new AbortController();
      const signal = controller.signal;
      if (requestId) {
        this.abortControllers.set(requestId, controller);
      }
      return await client.chat.completions.create(request, { signal });
    } catch (error: any) {
      throw this.handleProviderError(provider, error);
    }
  }

  async executeProviderRequest(provider: string, request: Record<string, unknown>) {
    const client = this.providerClients[provider];
    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    try {
      return await client.chat.completions.create(request);
    } catch (error: any) {
      throw this.handleProviderError(provider, error);
    }
  }

  async processStreamingResponse(
    sessionId: string,
    requestId: string,
    stream: AsyncIterable<any>,
    provider: string,
    model: string,
    options: Record<string, any> = {}
  ) {
    logger.info("Processing streaming response with normalization", {
      sessionId,
      requestId,
      provider,
      model,
    });

    let responseContent = "";
    let reasoningTokens: any[] = [];
    let toolCalls: any[] = [];
    let finishReason: string | null = null;
    let chunkCount = 0;

    try {
      for await (const chunk of stream) {
        chunkCount++;
        const normalizedChunk = this.responseNormalizer.normalizeStreamingChunk(
          provider,
          chunk,
          options
        );

        const content = normalizedChunk.content || "";
        const reasoning = normalizedChunk.reasoning || null;
        const functionDelta = normalizedChunk.toolCalls || null;
        finishReason = normalizedChunk.finishReason;

        if (content) {
          responseContent += content;
          this.streamingService.sendStreamChunk(sessionId, requestId, {
            type: "content",
            data: content,
            timestamp: Date.now(),
          });
        }

        if (reasoning) {
          if (Array.isArray(reasoning)) {
            reasoningTokens.push(...reasoning);
          } else {
            reasoningTokens.push(reasoning);
          }

          if (!options.excludeReasoning) {
            this.streamingService.sendStreamChunk(sessionId, requestId, {
              type: "reasoning",
              data: reasoning,
              timestamp: Date.now(),
            });
          }
        }

        if (functionDelta) {
          toolCalls = this.processToolCallDelta(toolCalls, functionDelta);
          this.streamingService.sendStreamChunk(sessionId, requestId, {
            type: "tool_calls",
            data: [functionDelta],
            timestamp: Date.now(),
          });
        }
      }

      const completionData = {
        content: {
          text: responseContent,
          toolCalls,
          finishReason,
        },
        reasoning: {
          tokens: reasoningTokens,
          totalTokens: reasoningTokens.length,
          excluded: options.excludeReasoning === true,
        },
      };

      this.streamingService.sendStreamComplete(
        sessionId,
        requestId,
        completionData
      );
      updateStreamingConnections(provider, model, -1);

      return {
        requestId,
        content: responseContent,
        reasoning: reasoningTokens,
        toolCalls,
        finishReason,
        chunks: chunkCount,
      };
    } catch (error: any) {
      if (error?.name === "AbortError" || /abort/i.test(error?.message || "")) {
        try {
          this.streamingService.sendStreamComplete(sessionId, requestId, {
            finishReason: "cancelled",
          });
        } catch (sendErr: any) {
          logger.warn("Failed to send cancelled completion", {
            sessionId,
            requestId,
            error: sendErr.message,
          });
        }
      }

      updateStreamingConnections(provider, model, -1);
      throw error;
    }
  }

  processProviderResponse(
    provider: string,
    response: Record<string, any>,
    options: Record<string, any> = {}
  ) {
    try {
      const normalizedResponse = this.responseNormalizer.normalizeResponse(
        provider,
        response,
        options
      );
      normalizedResponse.provider = provider;
      return normalizedResponse;
    } catch (error: any) {
      logger.error(`Failed to process provider response for ${provider}`, {
        error: error.message,
        responseId: response.id,
      });
      throw error;
    }
  }

  prepareProviderRequest(
    provider: string,
    modelId: string,
    messages: AIMessage[],
    parameters: AIRequestParameters = {},
    stream = false,
    reasoningConfig: Record<string, unknown> | null = null
  ) {
    const validatedParams = validateProviderParameters(provider, parameters) as Record<
      string,
      any
    >;

    let reasoningOptions: Record<string, any> = {};
    if (reasoningConfig) {
      const reasoningResult = processReasoningConfig(provider, reasoningConfig) as Record<
        string,
        any
      >;
      reasoningOptions = reasoningResult.responseOptions || {};
      if (reasoningResult.requestParams) {
        Object.assign(validatedParams, reasoningResult.requestParams);
      }
      if (reasoningResult.modelSuffix && provider === "nanogpt") {
        modelId = modelId + reasoningResult.modelSuffix;
      }
    }

    const request: Record<string, any> = {
      model: modelId,
      messages,
      stream,
    };

    switch (provider) {
      case "groq":
        Object.assign(request, {
          temperature: validatedParams.temperature,
          top_p: validatedParams.top_p,
          frequency_penalty: validatedParams.frequency_penalty,
          presence_penalty: validatedParams.presence_penalty,
          max_tokens: validatedParams.max_tokens,
        });
        if (validatedParams.include_reasoning !== undefined) {
          request.include_reasoning = validatedParams.include_reasoning;
        }
        if (validatedParams.reasoning_effort) {
          request.reasoning_effort = validatedParams.reasoning_effort;
        }
        if (validatedParams.reasoning_format) {
          request.reasoning_format = validatedParams.reasoning_format;
        }
        break;
      case "openrouter":
        Object.assign(request, {
          temperature: validatedParams.temperature,
          top_p: validatedParams.top_p,
          top_k: validatedParams.top_k,
          frequency_penalty: validatedParams.frequency_penalty,
          presence_penalty: validatedParams.presence_penalty,
          repetition_penalty: validatedParams.repetition_penalty,
          min_p: validatedParams.min_p,
          top_a: validatedParams.top_a,
          max_tokens: validatedParams.max_tokens,
        });
        if (validatedParams.reasoning) {
          request.reasoning = validatedParams.reasoning;
        }
        if (validatedParams.web_search) {
          request.plugins = [
            {
              id: "web",
              max_results: 3,
              search_prompt:
                "A web search was conducted today. Incorporate the following web search results into your response.",
            },
          ];
        }
        break;
      case "nanogpt":
        Object.assign(request, {
          temperature: validatedParams.temperature,
          top_p: validatedParams.top_p,
          frequency_penalty: validatedParams.frequency_penalty,
          presence_penalty: validatedParams.presence_penalty,
          max_tokens: validatedParams.max_tokens,
        });
        break;
    }

    if (validatedParams.tools && validatedParams.tools.length > 0) {
      request.tools = validatedParams.tools;
      request.tool_choice = validatedParams.tool_choice || "auto";
    }

    if (
      reasoningOptions.includeReasoning &&
      this.modelService.modelSupportsCapability(provider + "/" + modelId, "reasoning")
    ) {
      logger.debug(`Reasoning enabled for ${provider}/${modelId}`, {
        exclude: reasoningOptions.excludeReasoning,
        separate: reasoningOptions.separate,
      });
    }

    return request;
  }

  async checkRateLimits(provider: string, model: string, userId?: string) {
    const providerLimit = await this.rateLimitService.checkProviderLimit(provider);
    if (!providerLimit.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for provider: ${provider}`,
        providerLimit.retryAfter
      );
    }

    const modelLimit = await this.rateLimitService.checkModelLimit(model);
    if (!modelLimit.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for model: ${model}`,
        modelLimit.retryAfter
      );
    }

    if (userId) {
      const userLimit = await this.rateLimitService.checkUserLimit(userId);
      if (!userLimit.allowed) {
        throw new RateLimitError(
          `Rate limit exceeded for user: ${userId}`,
          userLimit.retryAfter
        );
      }
    }
  }

  validateCapabilities(
    modelDetails: {
      name?: string;
      capabilities?: AIRequestCapabilities;
    },
    request: ValidatedAIRequest
  ) {
    const { messages, capabilities } = request;
    const modelName = modelDetails.name || "unknown";
    const modelCapabilities = modelDetails.capabilities || {};
    const hasImages = messages.some(
      (msg) =>
        Array.isArray(msg.content) &&
        msg.content.some((item) => item.type === "image_url")
    );

    if (hasImages && !modelCapabilities.vision) {
      throw new Error(`Model ${modelName} does not support vision capabilities`);
    }
    if (capabilities?.tools && !modelCapabilities.tools) {
      throw new Error(`Model ${modelName} does not support tool capabilities`);
    }
    if (capabilities?.reasoning && !modelCapabilities.reasoning) {
      throw new Error(
        `Model ${modelName} does not support reasoning capabilities`
      );
    }
  }

  handleProviderError(provider: string, error: any) {
    logger.error(`Provider error: ${provider}`, {
      error: error.message,
      status: error.status,
      statusCode: error.statusCode,
      category: "provider_error",
    });

    if (error.status === 429 || error.statusCode === 429) {
      return new RateLimitError(`Rate limit exceeded for provider: ${provider}`);
    }
    if (error.status === 401 || error.statusCode === 401) {
      return new ProviderError(
        provider,
        `Authentication failed for provider: ${provider}`,
        401,
        "AUTHENTICATION_ERROR"
      );
    }
    if (error.status === 404 || error.statusCode === 404) {
      return new ProviderError(
        provider,
        `Model not found for provider: ${provider}`,
        404,
        "MODEL_NOT_FOUND"
      );
    }
    if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
      return new TimeoutError(`Request timeout for provider: ${provider}`);
    }

    return new ProviderError(
      provider,
      `Provider error: ${error.message}`,
      error.status || 500
    );
  }

  classifyError(error: any) {
    if (error instanceof RateLimitError) return "rate_limit";
    if (error instanceof TimeoutError) return "timeout";
    if (error instanceof ProviderError) return "provider_error";
    if (error.name === "ValidationError") return "validation_error";
    if ((error.message || "").includes("model")) return "model_error";
    if ((error.message || "").includes("authentication")) {
      return "authentication_error";
    }
    return "unknown_error";
  }

  generateCacheKey(request: ValidatedAIRequest) {
    const { model, messages, parameters = {} } = request;
    const keyData = {
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      })),
      parameters: {
        temperature: parameters.temperature,
        top_p: parameters.top_p,
        max_tokens: parameters.max_tokens,
      },
    };
    return `ai_response:${JSON.stringify(keyData)}`;
  }

  setupRequestTimeout(requestId: string) {
    const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS || "120000");
    const timeoutId = setTimeout(() => {
      this.cleanupRequest(requestId);
      logger.warn("Request timeout", { requestId, timeout });
    }, timeout);
    this.requestTimeouts.set(requestId, timeoutId);
  }

  cleanupRequest(requestId: string) {
    const timeoutId = this.requestTimeouts.get(requestId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.requestTimeouts.delete(requestId);
    }
    if (this.abortControllers.has(requestId)) {
      this.abortControllers.delete(requestId);
    }
    this.activeRequests.delete(requestId);
  }

  findSessionForRequest(requestId: string) {
    try {
      if (!this.streamingService) return null;
      const sessionId = this.streamingService.getSessionIdForRequest(requestId);
      if (!sessionId) {
        logger.warn("Session not found for request", { requestId });
      }
      return sessionId;
    } catch (error: any) {
      logger.error("Error finding session for request", {
        requestId,
        error: error.message,
      });
      return null;
    }
  }

  processToolCallDelta(toolCalls: any[], delta: any) {
    if (!toolCalls) toolCalls = [];

    if (delta.index === 0 && !toolCalls[0]) {
      toolCalls.push({
        id: delta.id,
        type: delta.type,
        function: {
          name: delta.function?.name || "",
          arguments: delta.function?.arguments || "",
        },
      });
    } else if (toolCalls[delta.index]) {
      if (delta.function?.name) {
        toolCalls[delta.index].function.name += delta.function.name;
      }
      if (delta.function?.arguments) {
        toolCalls[delta.index].function.arguments += delta.function.arguments;
      }
    }

    return toolCalls;
  }

  getActiveRequests() {
    return Array.from(this.activeRequests.entries()).map(([requestId, request]) => ({
      requestId,
      ...request,
      duration: Date.now() - request.startTime,
    }));
  }

  getHealth() {
    const activeRequests = this.getActiveRequests();
    const circuitBreakerStates: Record<string, any> = {};
    for (const [provider, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStates[provider] = breaker.getState?.() || null;
    }
    return {
      status: "healthy",
      activeRequests: activeRequests.length,
      circuitBreakers: circuitBreakerStates,
      providers: Object.keys(this.providerClients),
    };
  }

  async processImageGeneration(requestData: Record<string, any>) {
    const { model, userId } = requestData;
    const provider = getProviderFromModel(model) as string;
    await this.checkRateLimits(provider, model, userId);

    const modelId = getModelIdFromModel(model);
    if (!modelId) {
      throw new Error(`Invalid model ID for model: ${model}`);
    }
    const multimediaModel = this.multimediaService.getImageGenerationModel(modelId);
    if (multimediaModel) {
      return await this.processMultimediaImageGeneration(requestData, multimediaModel);
    }

    throw new Error(`Model ${model} does not support image generation capabilities`);
  }

  async processSpeechRecognition(requestData: Record<string, any>) {
    const { model, userId } = requestData;
    const provider = getProviderFromModel(model) as string;
    await this.checkRateLimits(provider, model, userId);

    const modelId = getModelIdFromModel(model);
    if (!modelId) {
      throw new Error(`Invalid model ID for model: ${model}`);
    }
    const multimediaModel = this.multimediaService.getSpeechRecognitionModel(modelId);
    if (multimediaModel) {
      return await this.processMultimediaSpeechRecognition(
        requestData,
        multimediaModel
      );
    }

    throw new Error(
      `Model ${model} does not support speech recognition capabilities`
    );
  }

  async processMultimediaImageGeneration(
    requestData: Record<string, any>,
    modelDetails: Record<string, any>
  ) {
    const { model, prompt, parameters = {} } = requestData;
    const provider = modelDetails.provider;

    return {
      images: [
        {
          url: parameters.mockUrl || null,
          revised_prompt: prompt,
        },
      ],
      created: Date.now(),
      model,
      provider,
    };
  }

  async processMultimediaSpeechRecognition(
    requestData: Record<string, any>,
    modelDetails: Record<string, any>
  ) {
    const { model, parameters = {} } = requestData;
    const provider = modelDetails.provider;

    return {
      text: "",
      task: "transcribe",
      language: parameters.language || "en",
      duration: 0,
      segments: [],
      words: [],
      provider,
      model,
    };
  }

  cancelStreamingRequest(requestId: string) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      try {
        controller.abort("Stream cancelled by client");
        logger.info("Streaming request aborted", { requestId });
        this.cleanupRequest(requestId);
        return true;
      } catch (e: any) {
        logger.warn("Failed to abort streaming request", {
          requestId,
          error: e.message,
        });
      }
    } else {
      logger.warn("No abort controller found for request", { requestId });
    }
    return false;
  }
}

export { AIProcessingService };
export type { ProviderClient };
