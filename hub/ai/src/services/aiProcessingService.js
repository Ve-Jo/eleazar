import { logger } from "../utils/logger.js";
import {
  validateAIRequest,
  validateProviderParameters,
  getProviderFromModel,
  getModelIdFromModel,
} from "../utils/validators.js";
import {
  ProviderError,
  RateLimitError,
  TimeoutError,
  retryWithBackoff,
  CircuitBreaker,
} from "../middleware/errorHandler.js";
import {
  recordAIRequest,
  recordTokenUsage,
  updateStreamingConnections,
} from "../middleware/metrics.js";
import { MultimediaModelsService } from "./multimediaModels.js";
import { ResponseNormalizer } from "./responseNormalizer.js";
import { processReasoningConfig } from "../utils/reasoningConfig.js";

class AIProcessingService {
  constructor(
    providerClients,
    modelService,
    rateLimitService,
    cacheService,
    streamingService,
    responseNormalizer
  ) {
    this.providerClients = providerClients;
    this.modelService = modelService;
    this.rateLimitService = rateLimitService;
    this.cacheService = cacheService;
    this.streamingService = streamingService;
    this.responseNormalizer = responseNormalizer;
    this.multimediaService = new MultimediaModelsService();

    // Circuit breakers for each provider
    this.circuitBreakers = new Map();

    // Request tracking
    this.activeRequests = new Map();
    this.requestTimeouts = new Map();
    // Abort controllers for streaming requests
    this.abortControllers = new Map();
  }

  async initialize() {
    logger.info("Initializing AI processing service...");

    // Initialize circuit breakers for each provider
    for (const [providerName, client] of Object.entries(this.providerClients)) {
      this.circuitBreakers.set(
        providerName,
        new CircuitBreaker(
          async (request) => this.executeProviderRequest(providerName, request),
          {
            failureThreshold: 5,
            resetTimeout: 60000,
            monitoringPeriod: 10000,
          }
        )
      );
    }

    logger.info("AI processing service initialized", {
      providers: Object.keys(this.providerClients),
      circuitBreakers: this.circuitBreakers.size,
    });
  }

  // Process AI request
  async processRequest(requestData) {
    const startTime = Date.now();
    let requestId, provider, model;

    try {
      // Validate request: ignore transport-specific fields like sessionId/provider
      const {
        sessionId,
        provider: providedProvider,
        ...requestForValidation
      } = requestData;
      const validatedRequest = validateAIRequest(requestForValidation);
      requestId = validatedRequest.requestId;
      model = validatedRequest.model;
      provider = getProviderFromModel(model);

      if (!provider) {
        throw new Error(`Invalid model format: ${model}`);
      }

      logger.info("Processing AI request", {
        requestId,
        provider,
        model,
        stream: validatedRequest.stream,
        userId: validatedRequest.userId,
        guildId: validatedRequest.guildId,
      });

      // Check rate limits
      await this.checkRateLimits(provider, model, validatedRequest.userId);

      // Get model details and validate
      const modelDetails = this.modelService.getModelDetails(model);
      if (!modelDetails) {
        throw new Error(`Model not found: ${model}`);
      }

      // Validate capabilities
      this.validateCapabilities(modelDetails, validatedRequest);

      // Set up request timeout
      this.setupRequestTimeout(requestId);

      // Track active request
      this.activeRequests.set(requestId, {
        startTime,
        provider,
        model,
        userId: validatedRequest.userId,
        guildId: validatedRequest.guildId,
      });

      // Process request
      let result;

      if (validatedRequest.stream) {
        result = await this.processStreamingRequest(
          requestId,
          validatedRequest
        );
      } else {
        result = await this.processNonStreamingRequest(
          requestId,
          validatedRequest
        );
      }

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      recordAIRequest(provider, model, "success", duration);

      // Clean up
      this.cleanupRequest(requestId);

      return result;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      // Record error metrics
      if (provider && model) {
        const errorType = this.classifyError(error);
        recordAIRequest(provider, model, "error", duration, errorType);
      }

      // Clean up
      if (requestId) {
        this.cleanupRequest(requestId);
      }

      throw error;
    }
  }

  // Process streaming request
  async processStreamingRequest(requestId, request) {
    const { model, messages, parameters, userId, guildId } = request;
    const provider = getProviderFromModel(model);
    const modelId = getModelIdFromModel(model);

    logger.info("Processing streaming request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    // Get WebSocket session for streaming
    const sessionId = this.findSessionForRequest(requestId);
    if (!sessionId) {
      throw new Error("No WebSocket session found for streaming request");
    }

    // Update streaming metrics
    updateStreamingConnections(provider, model, 1);

    try {
      // Prepare request for provider
      const providerRequest = this.prepareProviderRequest(
        provider,
        modelId,
        messages,
        parameters,
        true
      );

      // Execute streaming request (abortable)
      const stream = await this.executeStreamingRequest(
        provider,
        providerRequest,
        requestId
      );

      // Process streaming response
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

  // Process non-streaming request
  async processNonStreamingRequest(requestId, request) {
    const { model, messages, parameters, userId, guildId } = request;
    const provider = getProviderFromModel(model);
    const modelId = getModelIdFromModel(model);

    logger.info("Processing non-streaming request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cachedResponse = await this.cacheService.get(cacheKey);

      if (cachedResponse) {
        logger.debug("Returning cached response", { requestId });
        return cachedResponse;
      }

      // Prepare request for provider
      const providerRequest = this.prepareProviderRequest(
        provider,
        modelId,
        messages,
        parameters,
        false
      );

      // Execute request with circuit breaker
      const response = await this.circuitBreakers
        .get(provider)
        .call(providerRequest);

      // Process response
      const processedResponse = this.processProviderResponse(
        provider,
        response
      );

      // Cache response
      await this.cacheService.set(cacheKey, processedResponse, 300000); // 5 minutes cache

      // Record token usage
      if (response.usage) {
        recordTokenUsage(
          provider,
          model,
          response.usage.prompt_tokens || 0,
          response.usage.completion_tokens || 0
        );
      }

      return processedResponse;
    } catch (error) {
      throw this.handleProviderError(provider, error);
    }
  }

  // Execute streaming request with provider
  async executeStreamingRequest(provider, request, requestId) {
    const client = this.providerClients[provider];
    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    try {
      // Create abort controller for this streaming request
      const controller = new AbortController();
      const signal = controller.signal;
      // Keep controller for potential cancellation
      // Use explicit requestId passed from caller to track controller
      if (requestId) {
        this.abortControllers.set(requestId, controller);
      }

      return await client.chat.completions.create(request, { signal });
    } catch (error) {
      throw this.handleProviderError(provider, error);
    }
  }

  // Execute non-streaming request with provider
  async executeProviderRequest(provider, request) {
    const client = this.providerClients[provider];
    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    try {
      return await client.chat.completions.create(request);
    } catch (error) {
      throw this.handleProviderError(provider, error);
    }
  }

  // Process streaming response with normalization
  async processStreamingResponse(
    sessionId,
    requestId,
    stream,
    provider,
    model,
    options = {}
  ) {
    logger.info("Processing streaming response with normalization", {
      sessionId,
      requestId,
      provider,
      model,
    });

    let responseContent = "";
    let reasoningTokens = [];
    let toolCalls = [];
    let finishReason = null;
    let chunkCount = 0;

    try {
      for await (const chunk of stream) {
        chunkCount++;

        if (chunkCount === 1) {
          logger.debug("First streaming chunk received", {
            sessionId,
            requestId,
            provider,
            model,
          });
        }

        // Normalize the chunk using the response normalizer
        const normalizedChunk = this.responseNormalizer.normalizeStreamingChunk(
          provider,
          chunk,
          options
        );

        // Extract content
        const content = normalizedChunk.content || "";
        const reasoning = normalizedChunk.reasoning || null;
        const functionDelta = normalizedChunk.toolCalls || null;
        finishReason = normalizedChunk.finishReason;

        // Accumulate content
        if (content) {
          responseContent += content;
        }

        // Accumulate reasoning tokens (structured format)
        if (reasoning) {
          if (Array.isArray(reasoning)) {
            reasoningTokens.push(...reasoning);
          } else {
            reasoningTokens.push(reasoning);
          }
        }

        // Handle tool calls
        if (functionDelta) {
          toolCalls = this.processToolCallDelta(toolCalls, functionDelta);
        }

        // Send separate chunks for content and reasoning
        if (content) {
          const contentChunk = {
            type: "content",
            data: content,
            timestamp: Date.now(),
          };
          this.streamingService.sendStreamChunk(
            sessionId,
            requestId,
            contentChunk
          );
        }

        if (reasoning && !options.excludeReasoning) {
          const reasoningChunk = {
            type: "reasoning",
            data: reasoning,
            timestamp: Date.now(),
          };
          this.streamingService.sendStreamChunk(
            sessionId,
            requestId,
            reasoningChunk
          );
        }

        if (functionDelta) {
          const toolCallChunk = {
            type: "tool_calls",
            data: [functionDelta],
            timestamp: Date.now(),
          };
          this.streamingService.sendStreamChunk(
            sessionId,
            requestId,
            toolCallChunk
          );
        }

        // Log progress periodically
        if (chunkCount % 10 === 0) {
          logger.debug("Streaming progress", {
            sessionId,
            requestId,
            chunks: chunkCount,
            contentLength: responseContent.length,
            reasoningTokens: reasoningTokens.length,
          });
        }
      }

      // Send unified completion
      const completionData = {
        content: {
          text: responseContent,
          toolCalls: toolCalls,
          finishReason: finishReason,
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

      // Update streaming metrics
      updateStreamingConnections(provider, model, -1);

      logger.info("Streaming response completed with normalization", {
        sessionId,
        requestId,
        chunks: chunkCount,
        contentLength: responseContent.length,
        reasoningTokens: reasoningTokens.length,
      });

      return {
        requestId,
        content: responseContent,
        reasoning: reasoningTokens,
        toolCalls,
        finishReason,
        chunks: chunkCount,
      };
    } catch (error) {
      // On abort, send a cancelled completion to client
      if (error?.name === "AbortError" || /abort/i.test(error?.message || "")) {
        logger.info("Streaming aborted by client", { sessionId, requestId });
        try {
          this.streamingService.sendStreamComplete(sessionId, requestId, {
            finishReason: "cancelled",
          });
        } catch (sendErr) {
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

  // Process provider response with normalization
  processProviderResponse(provider, response, options = {}) {
    try {
      // Use the response normalizer to convert to unified format
      const normalizedResponse = this.responseNormalizer.normalizeResponse(
        provider,
        response,
        options
      );

      // Add provider information
      normalizedResponse.provider = provider;

      logger.debug(`Provider response normalized`, {
        provider,
        hasContent: !!normalizedResponse.content?.text,
        hasReasoning: normalizedResponse.reasoning?.tokens?.length > 0,
        reasoningEnabled: normalizedResponse.reasoning?.enabled,
      });

      return normalizedResponse;
    } catch (error) {
      logger.error(`Failed to process provider response for ${provider}`, {
        error: error.message,
        responseId: response.id,
      });
      throw error;
    }
  }

  // Prepare request for provider with unified reasoning configuration
  prepareProviderRequest(
    provider,
    modelId,
    messages,
    parameters,
    stream = false,
    reasoningConfig = null
  ) {
    // Validate parameters for provider
    const validatedParams = validateProviderParameters(provider, parameters);

    // Process reasoning configuration if provided
    let reasoningOptions = {};
    if (reasoningConfig) {
      const reasoningResult = processReasoningConfig(provider, reasoningConfig);
      reasoningOptions = reasoningResult.responseOptions;

      // Apply provider-specific reasoning parameters
      if (reasoningResult.requestParams) {
        Object.assign(validatedParams, reasoningResult.requestParams);
      }

      // Handle model suffix for NanoGPT
      if (reasoningResult.modelSuffix && provider === "nanogpt") {
        modelId = modelId + reasoningResult.modelSuffix;
      }
    }

    // Base request
    const request = {
      model: modelId,
      messages,
      stream,
    };

    // Add provider-specific parameters
    switch (provider) {
      case "groq":
        Object.assign(request, {
          temperature: validatedParams.temperature,
          top_p: validatedParams.top_p,
          frequency_penalty: validatedParams.frequency_penalty,
          presence_penalty: validatedParams.presence_penalty,
          max_tokens: validatedParams.max_tokens,
        });

        // Add Groq-specific reasoning parameters
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

        // Add OpenRouter-specific reasoning parameters
        if (validatedParams.reasoning) {
          request.reasoning = validatedParams.reasoning;
        }

        // Add web search if enabled
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

    // Add tools if provided
    if (validatedParams.tools && validatedParams.tools.length > 0) {
      request.tools = validatedParams.tools;
      request.tool_choice = validatedParams.tool_choice || "auto";
    }

    // Add reasoning if supported (using unified configuration)
    if (
      reasoningOptions.includeReasoning &&
      this.modelService.modelSupportsCapability(
        provider + "/" + modelId,
        "reasoning"
      )
    ) {
      // Provider-specific reasoning parameters are already applied above
      logger.debug(`Reasoning enabled for ${provider}/${modelId}`, {
        exclude: reasoningOptions.excludeReasoning,
        separate: reasoningOptions.separate,
      });
    }

    return request;
  }

  // Check rate limits
  async checkRateLimits(provider, model, userId) {
    // Check provider rate limit
    const providerLimit = await this.rateLimitService.checkProviderLimit(
      provider
    );
    if (!providerLimit.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for provider: ${provider}`,
        providerLimit.retryAfter
      );
    }

    // Check model rate limit
    const modelLimit = await this.rateLimitService.checkModelLimit(model);
    if (!modelLimit.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded for model: ${model}`,
        modelLimit.retryAfter
      );
    }

    // Check user rate limit if user ID provided
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

  // Validate capabilities
  validateCapabilities(modelDetails, request) {
    const { messages, capabilities } = request;

    // Check vision capability
    const hasImages = messages.some(
      (msg) =>
        Array.isArray(msg.content) &&
        msg.content.some((item) => item.type === "image_url")
    );

    if (hasImages && !modelDetails.capabilities.vision) {
      throw new Error(
        `Model ${modelDetails.name} does not support vision capabilities`
      );
    }

    // Check tools capability
    if (capabilities?.tools && !modelDetails.capabilities.tools) {
      throw new Error(
        `Model ${modelDetails.name} does not support tool capabilities`
      );
    }

    // Check reasoning capability
    if (capabilities?.reasoning && !modelDetails.capabilities.reasoning) {
      throw new Error(
        `Model ${modelDetails.name} does not support reasoning capabilities`
      );
    }
  }

  // Handle provider errors
  handleProviderError(provider, error) {
    logger.error(`Provider error: ${provider}`, {
      error: error.message,
      status: error.status,
      statusCode: error.statusCode,
      category: "provider_error",
    });

    // Classify error type
    if (error.status === 429 || error.statusCode === 429) {
      return new RateLimitError(
        `Rate limit exceeded for provider: ${provider}`
      );
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

  // Classify error type
  classifyError(error) {
    if (error instanceof RateLimitError) return "rate_limit";
    if (error instanceof TimeoutError) return "timeout";
    if (error instanceof ProviderError) return "provider_error";
    if (error.name === "ValidationError") return "validation_error";
    if (error.message.includes("model")) return "model_error";
    if (error.message.includes("authentication")) return "authentication_error";
    return "unknown_error";
  }

  // Generate cache key
  generateCacheKey(request) {
    const { model, messages, parameters } = request;
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

  // Setup request timeout
  setupRequestTimeout(requestId) {
    const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS || "120000");

    const timeoutId = setTimeout(() => {
      this.cleanupRequest(requestId);
      logger.warn("Request timeout", { requestId, timeout });
    }, timeout);

    this.requestTimeouts.set(requestId, timeoutId);
  }

  // Cleanup request
  cleanupRequest(requestId) {
    // Clear timeout
    const timeoutId = this.requestTimeouts.get(requestId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.requestTimeouts.delete(requestId);
    }

    // Remove abort controller if present
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      this.abortControllers.delete(requestId);
    }

    // Remove from active requests
    this.activeRequests.delete(requestId);
  }

  // Find session for request
  findSessionForRequest(requestId) {
    try {
      if (!this.streamingService) return null;
      const sessionId = this.streamingService.getSessionIdForRequest(requestId);
      if (!sessionId) {
        logger.warn("Session not found for request", { requestId });
      }
      return sessionId;
    } catch (error) {
      logger.error("Error finding session for request", {
        requestId,
        error: error.message,
      });
      return null;
    }
  }

  // Process tool call delta
  processToolCallDelta(toolCalls, delta) {
    if (!toolCalls) toolCalls = [];

    if (delta.index === 0 && !toolCalls[0]) {
      // New tool call
      toolCalls.push({
        id: delta.id,
        type: delta.type,
        function: {
          name: delta.function?.name || "",
          arguments: delta.function?.arguments || "",
        },
      });
    } else if (toolCalls[delta.index]) {
      // Update existing tool call
      if (delta.function?.name) {
        toolCalls[delta.index].function.name += delta.function.name;
      }
      if (delta.function?.arguments) {
        toolCalls[delta.index].function.arguments += delta.function.arguments;
      }
    }

    return toolCalls;
  }

  // Get active requests
  getActiveRequests() {
    return Array.from(this.activeRequests.entries()).map(
      ([requestId, request]) => ({
        requestId,
        ...request,
        duration: Date.now() - request.startTime,
      })
    );
  }

  // Get service health
  getHealth() {
    const activeRequests = this.getActiveRequests();
    const circuitBreakerStates = {};

    for (const [provider, breaker] of this.circuitBreakers.entries()) {
      circuitBreakerStates[provider] = breaker.getState();
    }

    return {
      status: "healthy",
      activeRequests: activeRequests.length,
      circuitBreakers: circuitBreakerStates,
      providers: Object.keys(this.providerClients),
    };
  }

  // Process image generation request
  async processImageGeneration(requestData) {
    const { requestId, model, prompt, parameters, userId, guildId } =
      requestData;
    const provider = getProviderFromModel(model);
    const modelId = getModelIdFromModel(model);

    logger.info("Processing image generation request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
      promptLength: prompt.length,
    });

    try {
      // Check rate limits
      await this.checkRateLimits(provider, model, userId);

      // Check if it's a multimedia model first
      const multimediaModel =
        this.multimediaService.getImageGenerationModel(modelId);
      if (multimediaModel) {
        // Use multimedia model directly
        return await this.processMultimediaImageGeneration(
          requestData,
          multimediaModel
        );
      }

      // Get model details from regular model service
      const modelDetails = this.modelService.getModelDetails(model);
      if (!modelDetails) {
        throw new Error(`Model not found: ${model}`);
      }

      // Validate image generation capability
      if (!modelDetails.capabilities.imageGeneration) {
        throw new Error(
          `Model ${model} does not support image generation capabilities`
        );
      }

      // Prepare image generation request
      const imageRequest = {
        model: modelId,
        prompt,
        n: parameters.n || 1,
        size: parameters.size || "1024x1024",
        quality: parameters.quality || "standard",
        style: parameters.style || "vivid",
        response_format: parameters.response_format || "url",
      };

      // Add additional parameters if provided
      if (parameters.width && parameters.height) {
        imageRequest.size = `${parameters.width}x${parameters.height}`;
      }

      // Execute request with circuit breaker
      const response = await this.circuitBreakers
        .get(provider)
        .call(imageRequest);

      // Process response
      const processedResponse = {
        images: response.data.map((image) => ({
          url: image.url,
          revised_prompt: image.revised_prompt,
        })),
        created: response.created,
        model: response.model,
        provider: provider,
      };

      // Record metrics
      recordAIRequest(provider, model, "success", 0);

      return processedResponse;
    } catch (error) {
      // Record error metrics
      const errorType = this.classifyError(error);
      recordAIRequest(provider, model, "error", 0, errorType);

      throw error;
    }
  }

  // Process speech recognition request
  async processSpeechRecognition(requestData) {
    const { requestId, model, audio, parameters, userId, guildId } =
      requestData;
    const provider = getProviderFromModel(model);
    const modelId = getModelIdFromModel(model);

    logger.info("Processing speech recognition request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    try {
      // Check rate limits
      await this.checkRateLimits(provider, model, userId);

      // Check if it's a multimedia model first
      const multimediaModel =
        this.multimediaService.getSpeechRecognitionModel(modelId);
      if (multimediaModel) {
        // Use multimedia model directly
        return await this.processMultimediaSpeechRecognition(
          requestData,
          multimediaModel
        );
      }

      // Get model details from regular model service
      const modelDetails = this.modelService.getModelDetails(model);
      if (!modelDetails) {
        throw new Error(`Model not found: ${model}`);
      }

      // Validate speech recognition capability
      if (!modelDetails.capabilities.speechRecognition) {
        throw new Error(
          `Model ${model} does not support speech recognition capabilities`
        );
      }

      // Prepare speech recognition request
      const speechRequest = {
        model: modelId,
        file: audio, // This should be base64 encoded audio data or file path
        response_format: parameters.response_format || "json",
        language: parameters.language || "en",
        temperature: parameters.temperature || 0,
      };

      // Add additional parameters if provided
      if (parameters.timestamp_granularities) {
        speechRequest.timestamp_granularities =
          parameters.timestamp_granularities;
      }

      // Execute request with circuit breaker
      const response = await this.circuitBreakers
        .get(provider)
        .call(speechRequest);

      // Process response
      const processedResponse = {
        text: response.text,
        task: response.task,
        language: response.language,
        duration: response.duration,
        segments: response.segments || [],
        words: response.words || [],
        provider: provider,
        model: response.model,
      };

      // Record metrics
      recordAIRequest(provider, model, "success", 0);

      return processedResponse;
    } catch (error) {
      // Record error metrics
      const errorType = this.classifyError(error);
      recordAIRequest(provider, model, "error", 0, errorType);

      throw error;
    }
  }

  // Process image generation using multimedia models
  async processMultimediaImageGeneration(requestData, modelDetails) {
    const { requestId, model, prompt, parameters, userId, guildId } =
      requestData;
    const provider = modelDetails.provider;

    logger.info("Processing multimedia image generation request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
      promptLength: prompt.length,
    });

    try {
      // Check rate limits
      await this.checkRateLimits(provider, model, userId);

      // Get model-specific configuration
      const width = parameters.width || 1024;
      const height = parameters.height || 1024;
      const steps =
        parameters.interference_steps ||
        (modelDetails.id === "chroma" || modelDetails.id === "qwen-image"
          ? 4
          : 10);
      const seed = parameters.seed || 0;

      // Try both endpoints - first the OpenAI-compatible one, then the direct one
      const endpoints = [
        "https://nano-gpt.com/v1/images/generations",
        "https://nano-gpt.com/api/generate-image",
      ];

      let lastError;

      for (const endpoint of endpoints) {
        try {
          logger.info(`Trying NanoGPT endpoint: ${endpoint}`);

          // Prepare request based on endpoint type
          const imageRequest = endpoint.includes("/v1/images/generations")
            ? {
                model: modelDetails.id,
                prompt: prompt,
                n: parameters.n || 1,
                size: `${width}x${height}`,
                response_format: parameters.response_format || "url",
                num_inference_steps: steps,
                ...(seed !== 0 && { seed: seed }),
              }
            : {
                model: modelDetails.id,
                prompt: prompt,
                width: width,
                height: height,
                steps: steps,
                seed: seed || 0,
              };

          // Execute request with circuit breaker
          const response = await this.circuitBreakers.get(provider).call({
            url: endpoint,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                this.providerClients[provider].apiKey ||
                process.env.NANOGPT_API_KEY
              }`,
            },
            body: JSON.stringify(imageRequest),
          });

          // Process response based on content type
          const contentType = response.headers?.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            // JSON response - parse it
            const result =
              typeof response === "string" ? JSON.parse(response) : response;

            let imageUrl;
            let base64Data;

            // Handle different response formats
            if (endpoint.includes("/v1/images/generations")) {
              // OpenAI-compatible format
              if (!result.data || !result.data[0]) {
                throw new Error("No data in NanoGPT response (OpenAI format)");
              }

              // Try URL first, then base64
              if (result.data[0].url) {
                imageUrl = result.data[0].url;
              } else if (result.data[0].b64_json) {
                base64Data = result.data[0].b64_json;
              } else {
                throw new Error(
                  "No image URL or base64 data in NanoGPT response"
                );
              }
            } else {
              // Direct API format
              if (result.imageUrl) {
                imageUrl = result.imageUrl;
              } else if (result.b64_json) {
                base64Data = result.b64_json;
              } else {
                throw new Error(
                  "No image URL or base64 data in NanoGPT response"
                );
              }
            }

            if (base64Data) {
              // Decode base64 data directly
              return {
                images: [
                  {
                    url: `data:image/png;base64,${base64Data}`,
                    revised_prompt: result.data?.[0]?.revised_prompt || prompt,
                  },
                ],
                created: result.created || Date.now(),
                model: model,
                provider: provider,
              };
            } else {
              // Return URL for client to fetch
              return {
                images: [
                  {
                    url: imageUrl,
                    revised_prompt: result.data?.[0]?.revised_prompt || prompt,
                  },
                ],
                created: result.created || Date.now(),
                model: model,
                provider: provider,
              };
            }
          } else {
            // Binary response - assume it's the image data directly
            return {
              images: [
                {
                  data: Buffer.from(response),
                  revised_prompt: prompt,
                },
              ],
              created: Date.now(),
              model: model,
              provider: provider,
            };
          }
        } catch (error) {
          lastError = error;
          logger.warn(`Endpoint ${endpoint} failed:`, error.message);
          // Continue to next endpoint
        }
      }

      // If we get here, all endpoints failed
      throw new Error(
        `All NanoGPT endpoints failed. Last error: ${
          lastError?.message || "Unknown error"
        }`
      );
    } catch (error) {
      // Record error metrics
      const errorType = this.classifyError(error);
      recordAIRequest(provider, model, "error", 0, errorType);

      throw error;
    }
  }

  // Process speech recognition using multimedia models
  async processMultimediaSpeechRecognition(requestData, modelDetails) {
    const { requestId, model, audio, parameters, userId, guildId } =
      requestData;
    const provider = modelDetails.provider;

    logger.info("Processing multimedia speech recognition request", {
      requestId,
      provider,
      model,
      userId,
      guildId,
    });

    try {
      // Check rate limits
      await this.checkRateLimits(provider, model, userId);

      // Prepare speech recognition request for Groq
      const speechRequest = {
        model: modelDetails.id,
        file: audio, // This should be base64 encoded audio data or file path
        response_format: parameters.response_format || "json",
        language: parameters.language || "en",
        temperature: parameters.temperature || 0,
      };

      // Execute request with circuit breaker
      const client = this.providerClients[provider];
      if (!client) {
        throw new Error(`No client available for provider: ${provider}`);
      }

      const response = await this.circuitBreakers
        .get(provider)
        .call(speechRequest);

      // Process response
      const processedResponse = {
        text: response.text || "",
        task: response.task || "transcribe",
        language: response.language || parameters.language || "en",
        duration: response.duration || 0,
        segments: response.segments || [],
        words: response.words || [],
        provider: provider,
        model: response.model || model,
      };

      // Record metrics
      recordAIRequest(provider, model, "success", 0);

      return processedResponse;
    } catch (error) {
      // Record error metrics
      const errorType = this.classifyError(error);
      recordAIRequest(provider, model, "error", 0, errorType);

      throw error;
    }
  }

  // Cancel an active streaming request
  cancelStreamingRequest(requestId) {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      try {
        controller.abort("Stream cancelled by client");
        logger.info("Streaming request aborted", { requestId });
        this.cleanupRequest(requestId);
        return true;
      } catch (e) {
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
