import { Events } from "discord.js";
import { translate } from "bing-translate-api";

let models = {
  text: [
    /*"llama-3.2-90b-text-preview",*/
    "llama-3.1-70b-versatile",
    "llama3-groq-70b-8192-tool-use-preview",
  ],
  vision: ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview"],
};

let modelCooldowns = {
  text: {},
  vision: {},
};

const MAX_CONTEXT_LENGTH = 5;
const INITIAL_CONTEXT = {
  role: "system",
  content: `You are a discord bot called "Eleazar". You have tons of tools (commands) that you can execute for the user. If user just want to talk with you, try to talk as natural to him as possible.`,
};

let context = {};

function generateToolsFromCommands(client) {
  return Array.from(client.commands.values())
    .filter((command) => command.data)
    .flatMap((command) => {
      if (command.data.options && command.data.options.length > 0) {
        return command.data.options.map((subcommand) =>
          createToolObject(command.data.name, subcommand)
        );
      }
      return [createToolObject(command.data.name, command.data)];
    });
}

function createToolObject(commandName, commandData) {
  const parameters = {};
  if (commandData.options) {
    commandData.options.forEach((option) => {
      parameters[option.name] = {
        type: "string",
        description: option.description,
      };
    });
  }
  return {
    type: "function",
    function: {
      name: commandData.name
        ? `${commandName}_${commandData.name}`
        : commandName,
      description: commandData.description,
      parameters: {
        type: "object",
        properties: parameters,
        required: commandData.options
          ? commandData.options
              .filter((opt) => opt.required)
              .map((opt) => opt.name)
          : [],
      },
    },
  };
}

async function translateText(text, targetLang) {
  try {
    // Preserve code blocks
    const codeBlocks = [];
    text = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Preserve quoted text
    const quotedTexts = [];
    text = text.replace(/"([^"]*)"/g, (match, group) => {
      quotedTexts.push(group);
      return `__QUOTED_TEXT_${quotedTexts.length - 1}__`;
    });

    // Translate the modified text
    const result = await translate(text, null, targetLang);
    let translatedText = result.translation;

    // Restore quoted texts
    quotedTexts.forEach((quote, index) => {
      translatedText = translatedText.replace(
        `__QUOTED_TEXT_${index}__`,
        `"${quote}"`
      );
    });

    // Restore code blocks
    codeBlocks.forEach((block, index) => {
      translatedText = translatedText.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
}

async function executeToolCall(toolCall, message, processingMessage) {
  const { name, arguments: args } = toolCall.function;
  const [commandName, subcommandName] = name.split("_");
  const command = message.client.commands.get(commandName);

  if (!command) return false;

  try {
    const fakeInteraction = await createFakeInteraction(
      message,
      processingMessage,
      commandName,
      subcommandName,
      args
    );

    // Add this check
    if (!fakeInteraction.guild || !fakeInteraction.member) {
      await processingMessage.edit(
        "This command can only be used in a server."
      );
      return false;
    }

    await command.execute(fakeInteraction);
    return true;
  } catch (error) {
    console.error(`Error executing command ${name}:`, error);
    await processingMessage.edit(`Error executing command: ${error.message}`);
    return false;
  }
}

async function createFakeInteraction(
  message,
  processingMessage,
  commandName,
  subcommandName,
  args
) {
  const fakeOptions = createFakeOptions(subcommandName, args, message);

  let freshMember;
  try {
    freshMember = await message.guild.members.fetch(message.author.id);
    console.log(`Fetched fresh member data for ${message.author.tag}`);
  } catch (error) {
    console.error(
      `Failed to fetch member data for ${message.author.tag}:`,
      error
    );
    freshMember = message.member; // Fallback to existing member data
  }

  if (!freshMember) {
    console.error(
      `Member data is unavailable for interaction by ${message.author.tag}`
    );
  }

  // Add this block to ensure guild and roles are properly set
  const guild = message.guild;
  if (guild) {
    await guild.roles.fetch(); // Ensure roles are fetched
  }

  return {
    user: message.author,
    guild: guild,
    channel: message.channel,
    member: freshMember,
    client: {
      ...message.client,
    },
    ...message,
    reply: async (content) => processingMessage.edit(content),
    editReply: async (content) => processingMessage.edit(content),
    deferReply: async () => processingMessage.edit("Processing..."),
    followUp: async (content) => message.channel.send(content),
    options: fakeOptions,
    isCommand: () => true,
    commandName: commandName,
    deferred: false,
    replied: false,
    ephemeral: false,
    webhook: {
      send: async (content) => message.channel.send(content),
      editMessage: async (messageId, content) => {
        const msg = await message.channel.messages.fetch(messageId);
        return msg.edit(content);
      },
    },
    roles: freshMember ? freshMember.roles : null,
  };
}

function createFakeOptions(subcommandName, args, message) {
  return {
    data: [{ name: subcommandName, value: args }],
    getSubcommand: () => subcommandName,
    getString: (name) => JSON.parse(args)[name],
    getInteger: (name) => parseInt(JSON.parse(args)[name]),
    getBoolean: (name) => JSON.parse(args)[name] === "true",
    getUser: (name) => message.mentions.users.first() || message.author,
    getMember: (name) =>
      message.guild.members.cache.get(JSON.parse(args).user) || message.member,
    getChannel: (name) =>
      message.guild.channels.cache.get(JSON.parse(args).channel) ||
      message.channel,
  };
}

function parseXmlToolCall(xmlString) {
  // Match both complete and incomplete function calls
  const functionMatch = xmlString.match(
    /<function(?:=|\s+name=")([^">]+)"?>({[^<]+})?(?:<\/function>)?/
  );
  if (!functionMatch) return null;

  const name = functionMatch[1];
  let args = {};

  if (functionMatch[2]) {
    try {
      // Try to parse the JSON, even if it's incomplete
      const jsonStr = functionMatch[2].replace(/&/g, "&amp;");
      args = JSON.parse(jsonStr);
    } catch (error) {
      console.error("Error parsing function arguments:", error);
      // If JSON parsing fails, try to extract key-value pairs
      const argPairs = functionMatch[2].match(/("?\w+"?\s*:\s*"[^"]*")/g);
      if (argPairs) {
        argPairs.forEach((pair) => {
          const [key, value] = pair
            .split(":")
            .map((s) => s.trim().replace(/"/g, ""));
          args[key] = value;
        });
      }
    }
  }

  return {
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}

function updateModelCooldown(modelType, modelName, retryAfter) {
  const cooldownUntil = Date.now() + retryAfter * 1000;
  modelCooldowns[modelType][modelName] = cooldownUntil;
}

function getAvailableModel(modelType) {
  const now = Date.now();
  for (const model of models[modelType]) {
    if (
      !modelCooldowns[modelType][model] ||
      modelCooldowns[modelType][model] <= now
    ) {
      return model;
    }
  }
  return null;
}

async function handleRateLimit(error, modelType, currentModel) {
  console.log("Checking for rate limit error:", JSON.stringify(error, null, 2));

  if (
    error.status === 429 ||
    (error.error &&
      error.error.error &&
      error.error.error.code === "rate_limit_exceeded")
  ) {
    console.log(`Rate limited for model ${currentModel}. Swapping model.`);

    let retryAfter = 60;
    let headers = error.headers || {};

    if (headers["retry-after"]) {
      retryAfter = parseInt(headers["retry-after"]);
    } else if (error.error && error.error.error && error.error.error.message) {
      const match = error.error.error.message.match(
        /Please try again in (\d+m)?(\d+(?:\.\d+)?s)/
      );
      if (match) {
        const minutes = match[1] ? parseInt(match[1]) : 0;
        const seconds = parseFloat(match[2]);
        retryAfter = minutes * 60 + Math.ceil(seconds);
      }
    }

    updateModelCooldown(modelType, currentModel, retryAfter);

    // Log rate limit information
    console.log(`Rate limit info:
      Retry-After: ${retryAfter} seconds
      Requests Per Day (RPD) Limit: ${headers["x-ratelimit-limit-requests"]}
      Tokens Per Minute (TPM) Limit: ${headers["x-ratelimit-limit-tokens"]}
      Remaining RPD: ${headers["x-ratelimit-remaining-requests"]}
      Remaining TPM: ${headers["x-ratelimit-remaining-tokens"]}
      RPD Reset: ${headers["x-ratelimit-reset-requests"]}
      TPM Reset: ${headers["x-ratelimit-reset-tokens"]}
      Error Message: ${error.error?.error?.message || "N/A"}
    `);

    return true;
  }
  return false;
}

// Add this function near the top of the file, after the import statements
function splitMessage(message, maxLength = 2000) {
  const chunks = [];
  let currentChunk = "";
  let inCodeBlock = false;
  let codeBlockLanguage = "";

  const lines = message.split("\n");
  for (const line of lines) {
    const codeBlockMatch = line.match(/^```(\w+)?/);
    if (codeBlockMatch) {
      if (inCodeBlock) {
        inCodeBlock = false;
        currentChunk += line + "\n";
        chunks.push(currentChunk.trim());
        currentChunk = "";
        continue;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = codeBlockMatch[1] || "";
      }
    }

    if (currentChunk.length + line.length + 1 > maxLength) {
      if (inCodeBlock) {
        chunks.push(currentChunk.trim() + "\n```");
        currentChunk = "```" + codeBlockLanguage + "\n" + line;
      } else {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      }
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  // Ensure the last chunk closes any open code block
  if (inCodeBlock && !chunks[chunks.length - 1].endsWith("```")) {
    chunks[chunks.length - 1] += "\n```";
  }

  return chunks;
}

// Replace the existing processingMessage.edit calls with this new function
async function sendResponse(
  message,
  processingMessage,
  content,
  debugInfo = ""
) {
  const chunks = splitMessage(content);

  // Edit the processing message with the first chunk
  await processingMessage.edit(
    chunks[0] + (chunks.length === 1 ? debugInfo : "")
  );

  // Send additional chunks as new messages
  for (let i = 1; i < chunks.length; i++) {
    let chunk = chunks[i];
    if (i === chunks.length - 1) {
      chunk += debugInfo;
    }
    await message.channel.send(chunk);
  }
}

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const botMention = `<@${message.client.user.id}>`;
    if (!message.content.startsWith(botMention)) return;

    let messageContent = message.content.slice(botMention.length).trim();
    message.channel.sendTyping();
    const processingMessage = await message.channel.send(
      "Processing your request..."
    );

    try {
      const {
        language: { from: originalLanguage },
        translation: translatedMessage,
      } = await translate(messageContent, null, "en");

      const isVisionRequest = message.attachments.size > 0;
      const modelType = isVisionRequest ? "vision" : "text";

      let tools = [];
      let messages = [];

      if (isVisionRequest) {
        const attachment = message.attachments.first();
        messages.push({
          role: "user",
          content: [
            { type: "text", text: translatedMessage },
            { type: "image_url", image_url: { url: attachment.url } },
          ],
        });
      } else {
        if (!context[message.author.id]) {
          context[message.author.id] = [INITIAL_CONTEXT];
        }
        context[message.author.id].push({
          role: "user",
          content: translatedMessage,
        });
        context[message.author.id] = [
          INITIAL_CONTEXT,
          ...context[message.author.id].slice(-MAX_CONTEXT_LENGTH),
        ];
        messages = [...context[message.author.id]];
        tools = generateToolsFromCommands(message.client);
      }

      let response;
      let retries = 0;
      const maxRetries = models[modelType].length * 2; // Increase max retries
      let currentModel;

      while (retries < maxRetries) {
        currentModel = getAvailableModel(modelType);
        if (!currentModel) {
          console.log(
            "All models are on cooldown. Waiting for the next available model..."
          );
          await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
          continue;
        }

        console.log(`Attempting to use model: ${currentModel}`);

        try {
          response = await message.client.groq.chat.completions.create({
            model: currentModel,
            messages: messages,
            tools: isVisionRequest ? [] : tools,
            tool_choice: isVisionRequest ? "none" : "auto",
          });
          console.log(`Successfully got response from model: ${currentModel}`);
          break;
        } catch (error) {
          console.error(`Error with model ${currentModel}:`, error);
          if (await handleRateLimit(error, modelType, currentModel)) {
            retries++;
            console.log(
              `Retrying after rate limit (Attempt ${retries}/${maxRetries})`
            );
            continue;
          } else {
            throw error;
          }
        }
      }

      if (!response) {
        throw new Error(
          "Failed to get a response after trying all available models"
        );
      }

      let { content: aiContent = "", tool_calls: initialToolCalls = [] } =
        response.choices[0].message;
      let toolCalls = [...initialToolCalls];

      const toolCallRegex =
        /(<tool_call>\s*([\s\S]*?)\s*<\/tool_call>)|(<function(?:=|\s+name=")([^">]+)"?>(?:{[^<]+})?(?:<\/function>)?)/g;
      let match;
      while ((match = toolCallRegex.exec(aiContent)) !== null) {
        try {
          let toolCall = match[1]
            ? JSON.parse(
                match[2]
                  .trim()
                  .replace(/'/g, '"')
                  .replace(/(\w+):/g, '"$1":')
                  .replace(/,\s*([\]}])/g, "$1")
              )
            : parseXmlToolCall(match[0]);
          if (toolCall) {
            toolCalls.push(toolCall);
            aiContent = aiContent.replace(match[0], "");
          }
        } catch (error) {
          console.error("Error parsing tool call from text:", error);
        }
      }

      let commandExecuted = false;
      for (const toolCall of toolCalls) {
        const success = await executeToolCall(
          toolCall,
          message,
          processingMessage
        );
        if (success) {
          commandExecuted = true;
          break;
        }
      }

      if (aiContent.trim()) {
        const translatedResponse = await translateText(
          aiContent.trim(),
          originalLanguage
        );
        const debugInfo = `\n\n[Debug: Model used - ${currentModel}]`;
        await sendResponse(
          message,
          processingMessage,
          translatedResponse,
          debugInfo
        );
        context[message.author.id].push({
          role: "assistant",
          content: aiContent.trim(),
        });
      } else if (commandExecuted) {
        await sendResponse(
          message,
          processingMessage,
          `Command executed successfully.`,
          `\n\n[Debug: Model used - ${currentModel}]`
        );
      } else {
        await sendResponse(
          message,
          processingMessage,
          `No valid commands were executed.`,
          `\n\n[Debug: Model used - ${currentModel}]`
        );
      }
    } catch (error) {
      console.error("Error processing request:", error);
      await sendResponse(
        message,
        processingMessage,
        `An error occurred while processing your request.`,
        `\n\n[Debug: Error - ${error.message}]`
      );
    }
  },
};
