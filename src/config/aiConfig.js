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
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.3-70b-versatile",
        "llama3-70b-8192",
        "deepseek-r1-distill-llama-70b",
        "mistral-saba-24b",
        "qwen-qwq-32b",
        "llama-3.2-11b-vision-preview",
      ],
      vision: [
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.2-11b-vision-preview",
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
        "openai/gpt-4.1-nano",
        "qwen/qwen3-235b-a22b",
        "qwen/qwen3-30b-a3b",
        "x-ai/grok-3-mini-beta",
        "google/gemini-2.5-flash-preview",
        "microsoft/phi-4-reasoning-plus",
        "google/gemini-2.0-flash-001",
        "minimax/minimax-01",
        "qwen/qwen-vl-plus",
        "qwen/qwen3-32b",
        "google/gemma-3-27b-it",
        "mistralai/mistral-small-3.1-24b-instruct",
        "mistralai/pixtral-12b",
      ],
      vision: [
        "openai/gpt-4.1-nano",
        "minimax/minimax-01",
        "google/gemma-3-27b-it",
        "qwen/qwen-vl-plus",
        "mistralai/pixtral-12b",
      ],
    },
  },

  // Context and system configuration
  maxContextLength: 4,
  disableSystemPromptFor: [
    "groq/llama3-70b-8192",
    "openrouter/sao10k/l3.3-euryale-70b",
    "openrouter/thedrummer/skyfall-36b-v2",
    "openrouter/google/gemini-2.0-flash-001",
    "openrouter/mistralai/mistral-small-3.1-24b-instruct",
    "openrouter/latitudegames/wayfarer-large-70b-llama-3.3",
    "openrouter/mistralai/pixtral-12b",
  ],

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
- If in a DM (Direct Message), be more personal and direct.

COMMAND HELP:
- Explain how to use bot commands when users ask how to do something.
- Format as: "/command_name [parameter]"
- Do NOT try to run commands for users - guide them to do it themselves.

Always answer in the same language as the user.`,
};

export default CONFIG;
