import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
  // Provider configurations
  groq: {
    provider: "groq",
    apiKey: process.env.GROQ_API,
    clientPath: "groq",
    preferredModels: {
      text: [
        /*"meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "deepseek-r1-distill-llama-70b",*/
      ],
      vision: [
        /*"meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",*/
      ],
    },
  },

  openrouter: {
    provider: "openrouter",
    apiKey: process.env.OPENROUTER_API_KEY,
    clientPath: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    preferredModels: {
      text: [
        /*"openai/gpt-4.1-nano",
        "qwen/qwen3-235b-a22b-thinking-2507",
        "qwen/qwen3-235b-a22b",
        "moonshotai/kimi-k2",
        "minimax/minimax-01",
        "mistralai/magistral-small-2506",
        "x-ai/grok-3-mini-beta",
        "google/gemini-2.5-flash-lite-preview-06-17",
        "google/gemma-3-27b-it",
        "qwen/qwen-vl-plus",*/
      ],
      vision: [
        /*"openai/gpt-4.1-nano",
        "minimax/minimax-01",
        "google/gemma-3-27b-it",
        "qwen/qwen-vl-plus",*/
      ],
    },
  },

  nanogpt: {
    provider: "nanogpt",
    apiKey: process.env.NANOGPT_API_KEY,
    clientPath: "nanogpt",
    baseURL: "https://nano-gpt.com/api/v1",
    preferredModels: {
      text: [
        "moonshotai/Kimi-K2-Instruct-0905",
        "z-ai/glm-4.6:thinking",
        "zai-org/GLM-4.5-FP8:thinking",
        "inclusionai/ling-1t",
        "inclusionai/ring-1t",
        "deepseek-ai/deepseek-v3.2-exp-thinking",
        "deepseek-ai/DeepSeek-V3.1-Terminus:thinking",
        "deepseek-ai/DeepSeek-V3.1:thinking",
        "Qwen/Qwen3-Next-80B-A3B-Instruct",
        "qwen3-vl-235b-a22b-thinking",
        "qvq-max",
        "nousresearch/hermes-4-405b:thinking",
        "nvidia/Llama-3.1-Nemotron-Ultra-253B-v1",
        "openai/gpt-oss-120b",
        "minimax/minimax-01",
        "Gemma-3-27B-it-Abliterated",
        "meta-llama/llama-4-maverick",
        "meta-llama/llama-4-scout",
      ],
      vision: ["qwen3-vl-235b-a22b-thinking"],
    },
  },

  // Models that support reasoning capabilities
  reasoningCapableModels: [
    "minimax/minimax-m1",
    "qwen/qwen3-235b-a22b-thinking-2507",
    "x-ai/grok-3-mini-beta",
    "mistralai/magistral-small-2506",
  ],

  // Default reasoning settings
  defaultReasoningSettings: {
    enabled: true,
    effort: "medium", // "low", "medium", "high"
    maxTokens: 2000,
    exclude: false,
  },

  // Context window sizes for models (in tokens)
  modelContextWindows: {
    // Groq models
    "groq/meta-llama/llama-4-maverick-17b-128e-instruct": 128000,
    "groq/meta-llama/llama-4-scout-17b-16e-instruct": 16000,
    "groq/deepseek-r1-distill-llama-70b": 32000,

    // OpenRouter models
    "openrouter/openai/gpt-4.1-nano": 128000,
    "openrouter/qwen/qwen3-235b-a22b-thinking-2507": 32000,
    "openrouter/qwen/qwen3-235b-a22b": 32000,
    "openrouter/moonshotai/kimi-k2": 200000,
    "openrouter/minimax/minimax-01": 4000000,
    "openrouter/mistralai/magistral-small-2506": 32000,
    "openrouter/x-ai/grok-3-mini-beta": 32000,
    "openrouter/google/gemini-2.5-flash-lite-preview-06-17": 1000000,
    "openrouter/google/gemma-3-27b-it": 32000,
    "openrouter/qwen/qwen-vl-plus": 32000,

    // NanoGPT models
    "nanogpt/inclusionai/ling-1t": 128000,
    "nanogpt/inclusionai/ring-1t": 128000,
    "nanogpt/moonshotai/Kimi-K2-Instruct-0905": 200000,
    "nanogpt/z-ai/glm-4.6:thinking": 32000,
    "nanogpt/zai-org/GLM-4.5-FP8:thinking": 32000,
    "nanogpt/deepseek-ai/deepseek-v3.2-exp-thinking": 128000,
    "nanogpt/deepseek-ai/DeepSeek-V3.1-Terminus:thinking": 128000,
    "nanogpt/deepseek-ai/DeepSeek-V3.1:thinking": 128000,
    "nanogpt/Qwen/Qwen3-Next-80B-A3B-Instruct": 32000,
    "nanogpt/qwen3-vl-235b-a22b-thinking": 32000,
    "nanogpt/qvq-max": 32000,
    "nanogpt/nousresearch/hermes-4-405b:thinking": 32000,
    "nanogpt/nvidia/Llama-3.1-Nemotron-Ultra-253B-v1": 128000,
    "nanogpt/openai/gpt-oss-120b": 32000,
    "nanogpt/minimax/minimax-01": 4000000,
    "nanogpt/Gemma-3-27B-it-Abliterated": 32000,
    "nanogpt/meta-llama/llama-4-maverick": 128000,
    "nanogpt/meta-llama/llama-4-scout": 16000,
  },

  // Context and system configuration
  maxContextLength: 4,
  disableSystemPromptFor: [],

  // AI generation parameters with documentation
  aiParameters: {
    // Creativity control parameters
    temperature: {
      default: 1,
      min: 0.0,
      max: 2.0,
      description:
        "Controls randomness: higher values produce more creative results",
    },

    // Sampling strategy parameters
    top_p: {
      default: 1.0,
      min: 0.0,
      max: 1.0,
      description:
        "Nucleus sampling: considers tokens with top_p probability mass",
    },
    top_k: {
      default: 0.0,
      min: 0,
      max: 100,
      description: "Only sample from the K most likely tokens",
      providers: ["openrouter"],
    },
    min_p: {
      default: 0.05,
      min: 0.0,
      max: 1.0,
      description: "Only tokens with at least this probability are considered",
      providers: ["openrouter"],
    },
    top_a: {
      default: 0.0,
      min: 0.0,
      max: 1.0,
      description: "Dynamic nucleus sampling threshold",
      providers: ["openrouter"],
    },

    // Reasoning parameters
    reasoning_effort: {
      default: "medium",
      options: ["low", "medium", "high"],
      description: "Controls how much reasoning the model should do",
      providers: ["openrouter"],
    },
    reasoning_max_tokens: {
      default: 2000,
      min: 0,
      max: 10000,
      description: "Maximum tokens to use for reasoning (if supported)",
      providers: ["openrouter"],
    },
    reasoning_exclude: {
      default: false,
      description: "Whether to exclude reasoning from the response",
      providers: ["openrouter"],
    },

    // Web search parameters
    web_search: {
      default: false,
      description: "Enable web search capability for the model",
      providers: ["openrouter"],
    },

    // Repetition control parameters
    frequency_penalty: {
      default: 0.0,
      min: -2.0,
      max: 2.0,
      description: "Decreases repetition of frequent tokens",
    },
    presence_penalty: {
      default: 0.0,
      min: -2.0,
      max: 2.0,
      description: "Decreases repetition of used tokens",
    },
    repetition_penalty: {
      default: 1.0,
      min: 1.0,
      max: 2.0,
      description: "Higher values prevent repetition",
      providers: ["openrouter"],
    },

    // Groq-specific parameters
    max_completion_tokens: {
      default: 4096,
      min: 1,
      max: 8192,
      description: "Maximum number of tokens to generate (Groq only)",
      providers: ["groq"],
    },
  },

  // Default system context
  initialSystemContext: `You are a helpful AI assistant for the Discord bot "Eleazar" created by "@vejoy_".

CONVERSATION GUIDELINES:
- Be conversational, helpful, and concise.
- Use the user's nickname when addressing them directly.
- Reference mentioned users by their nicknames when they're discussed.
- Consider the server context, channel topics, and conversation setting.
- For channels, use the # symbol when referencing them (e.g., #general).
- Adjust your tone based on whether you're in a public channel, thread, or direct message.
- You may invent plausible answers when real information is unavailable. Always respond confidently.

COMMAND HELP:
- Explain how to use bot commands when users ask how to do something.
- Format as: "/command_name [parameter]"
- Do NOT try to run commands for users - guide them to do it themselves.

Always answer in the same language as the user.`,
};

export default CONFIG;
