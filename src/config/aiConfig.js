const CONFIG = {
  groq: {
    provider: "groq",
    apiKey: process.env.GROQ_API,
    clientPath: "groq",
    models: {
      text: [
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.3-70b-versatile",
        "deepseek-r1-distill-llama-70b",
        "llama3-70b-8192",
        "mistral-saba-24b",
        "qwen-qwq-32b",
        "llama-3.2-11b-vision-preview",
        "llama-3.1-8b-instant",
        "llama3-8b-8192",
      ],
      vision: [
        "meta-llama/llama-4-maverick-17b-128e-instruct",
        "meta-llama/llama-4-scout-17b-16e-instruct",
        "llama-3.2-90b-vision-preview",
        "llama-3.2-11b-vision-preview",
      ],
    },
  },
  maxContextLength: 4,
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
