import dotenv from "dotenv";
dotenv.config();

const CONFIG = {
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
        "openai/gpt-4o-mini",
        "qwen/qwen3-235b-a22b",
        "qwen/qwen3-30b-a3b",
        "google/gemini-2.5-flash-preview",
        "google/gemini-2.0-flash-001",
        "minimax/minimax-01",
        "qwen/qwen-vl-plus",
        "qwen/qwen3-32b",
        "google/gemma-3-27b-it",
        "mistralai/mistral-small-3.1-24b-instruct",
        "mistralai/pixtral-12b",
        "thedrummer/anubis-pro-105b-v1",
        "latitudegames/wayfarer-large-70b-llama-3.3",
        "sao10k/l3.3-euryale-70b",
        "thedrummer/skyfall-36b-v2",
        /*"microsoft/phi-3.5-mini-128k-instruct",
        "microsoft/mai-ds-r1:free",
        "thudm/glm-z1-32b:free",
        "thudm/glm-4-32b:free",
        "nvidia/llama-3.1-nemotron-ultra-253b-v1:free",
        "nvidia/llama-3.3-nemotron-super-49b-v1:free",
        "nvidia/llama-3.1-nemotron-nano-8b-v1:free",
        "google/gemini-2.5-pro-exp-03-25:free",
        "google/gemma-3-27b-it:free",
        "qwen/qwen2.5-vl-32b-instruct:free",
        "mistralai/mistral-small-3.1-24b-instruct",
        "moonshotai/moonlight-16b-a3b-instruct:free",*/
      ],
      vision: [
        /*"google/gemini-2.0-flash-001",*/
        "openai/gpt-4o-mini",
        "minimax/minimax-01",
        "google/gemma-3-27b-it",
        "qwen/qwen-vl-plus",
        "mistralai/pixtral-12b",
        /*"microsoft/phi-3.5-mini-128k-instruct",
        "qwen/qwen2.5-vl-32b-instruct:free",
        "google/gemma-3-27b-it:free",*/
      ],
    },
  },
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
  initialSystemContext: `You are a natural and helpful AI assistant for a Discord bot named "Eleazar" created by "@vejoy_".

CONVERSATION NOTICE:
- By default, assume the user just wants to have a casual conversation.
- In conversation, respond naturally, be helpful, and don't try to execute tools unless specifically asked.
- Keep your responses conversational, concise, and engaging.

TOOL USAGE NOTICE:
- Only run tools when the user clearly requests a specific task that requires tools, AND if tools are enabled for this conversation.
- Examples of clear task requests: "show me my balance", "translate this text", "help me create a poll", etc.
- When you are running tool, make sure you're filling all the parameters correctly.

Do not mention tools, commands, or your internal processes to the user. Always answer in the same language as the user.`,
};

export default CONFIG;
