import { Events } from "discord.js";
import { translate } from "bing-translate-api";
import i18n from "../utils/newI18n.js";

// Configuration
const CONFIG = {
  models: {
    text: [
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "llama3-groq-70b-8192-tool-use-preview",
    ],
    vision: ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview"],
  },
  maxContextLength: 4,
  initialContext: {
    role: "system",
    content: `You are a AI assistant for discord bot named "Eleazar" and created by "@vejoy_". You answer all questions. You have tons of tools (commands) that you can execute for the user. But if user just want to talk with you, try to talk as natural and simplier to him as possible (and not with tons of text).`,
  },
};

// State management
const state = {
  modelCooldowns: { text: {}, vision: {} },
  userContexts: {},
};

// Helper functions
function getAvailableModel(modelType) {
  const now = Date.now();
  for (const model of CONFIG.models[modelType]) {
    if (
      !state.modelCooldowns[modelType][model] ||
      state.modelCooldowns[modelType][model] <= now
    ) {
      return model;
    }
  }
  return null;
}

function updateModelCooldown(modelType, modelName, retryAfter) {
  state.modelCooldowns[modelType][modelName] = Date.now() + retryAfter * 1000;
}

async function handleRateLimit(error, modelType, currentModel) {
  if (
    error.status === 429 ||
    error.error?.error?.code === "rate_limit_exceeded"
  ) {
    const retryAfter = error.headers?.["retry-after"] || 60;
    updateModelCooldown(modelType, currentModel, retryAfter);
    return true;
  }
  return false;
}

function generateToolsFromCommands(client) {
  return Array.from(client.commands.values())
    .filter((command) => command.data && command.data.ai !== false)
    .flatMap((command) => {
      const commandData = command.data;
      const tools = [];

      // Add the main command as a tool if it has an execute function
      if (command.execute) {
        tools.push({
          type: "function",
          function: {
            name: commandData.name,
            description: commandData.description,
            parameters: {
              type: "object",
              properties: generateParametersFromOptions(
                commandData.options || []
              ),
              required: (commandData.options || [])
                .filter((opt) => opt.required)
                .map((opt) => opt.name),
            },
          },
        });
      }

      // Add subcommands as tools
      if (command.subcommands) {
        Object.entries(command.subcommands).forEach(
          ([subcommandName, subcommand]) => {
            if (subcommand.data && subcommand.execute) {
              tools.push({
                type: "function",
                function: {
                  name: `${commandData.name}_${subcommandName}`,
                  description: subcommand.data.description,
                  parameters: {
                    type: "object",
                    properties: generateParametersFromOptions(
                      subcommand.data.options || []
                    ),
                    required: (subcommand.data.options || [])
                      .filter((opt) => opt.required)
                      .map((opt) => opt.name),
                  },
                },
              });
            }
          }
        );
      }

      return tools;
    });
}

function generateParametersFromOptions(options) {
  return options.reduce((params, option) => {
    params[option.name] = {
      type: getParameterType(option.type),
      description: option.description,
      ...(option.choices && {
        enum: option.choices.map((choice) => choice.value),
      }),
    };
    return params;
  }, {});
}

function getParameterType(optionType) {
  const typeMap = {
    3: "string", // STRING
    4: "integer", // INTEGER
    5: "boolean", // BOOLEAN
    6: "string", // USER
    7: "string", // CHANNEL
    8: "string", // ROLE
    10: "number", // NUMBER
  };
  return typeMap[optionType] || "string";
}

async function createFakeInteraction(
  message,
  processingMessage,
  commandName,
  subcommandName,
  args,
  locale
) {
  const parsedArgs = args ? JSON.parse(args) : {};

  return {
    commandName,
    user: message.author,
    guild: message.guild,
    member: message.member,
    channel: message.channel,
    client: message.client,
    reply: async (content) => processingMessage.edit(content),
    editReply: async (content) => processingMessage.edit(content),
    deferReply: async () => processingMessage.edit("Processing..."),
    followUp: async (content) => message.channel.send(content),
    options: {
      getSubcommand: () => subcommandName,
      getString: (name) => parsedArgs[name]?.toString() || null,
      getInteger: (name) =>
        parsedArgs[name] ? parseInt(parsedArgs[name]) : null,
      getBoolean: (name) =>
        parsedArgs[name] === true || parsedArgs[name] === "true",
      getMember: (name) => {
        const value = parsedArgs[name];
        if (!value) return message.member;
        if (value.startsWith("<@") && value.endsWith(">")) {
          const userId = value.replace(/[<@!>]/g, "");
          return message.guild.members.cache.get(userId) || message.member;
        }
        return message.member;
      },
      getUser: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        if (value.startsWith("<@") && value.endsWith(">")) {
          return message.client.users.cache.get(value.replace(/[<@!>]/g, ""));
        }
        return message.client.users.cache.find(
          (u) =>
            u.username.toLowerCase() === value.toLowerCase().replace("@", "")
        );
      },
      getChannel: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        if (value.startsWith("<#") && value.endsWith(">")) {
          return message.guild.channels.cache.get(value.replace(/[<#>]/g, ""));
        }
        return message.guild.channels.cache.find(
          (c) => c.name.toLowerCase() === value.toLowerCase()
        );
      },
      getRole: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        if (value.startsWith("<@&") && value.endsWith(">")) {
          return message.guild.roles.cache.get(value.replace(/[<@&>]/g, ""));
        }
        return message.guild.roles.cache.find(
          (r) => r.name.toLowerCase() === value.toLowerCase()
        );
      },
      getNumber: (name) =>
        parsedArgs[name] ? parseFloat(parsedArgs[name]) : null,
      getAttachment: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        return message.attachments.find((a) => a.id === value);
      },
      getMentionable: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        if (value.startsWith("<@") && value.endsWith(">")) {
          const id = value.replace(/[<@!>]/g, "");
          return (
            message.guild.members.cache.get(id) ||
            message.guild.roles.cache.get(id) ||
            message.client.users.cache.get(id)
          );
        }
        return null;
      },
    },
    locale,
    isChatInputCommand: () => true,
    isCommand: () => true,
    deferred: false,
    replied: false,
    ephemeral: false,
  };
}

async function executeToolCall(toolCall, message, processingMessage, locale) {
  const { name, arguments: args } = toolCall.function;
  const [commandName, ...subcommandParts] = name.split("_");
  const subcommandName = subcommandParts.join("_");

  const command = message.client.commands.get(commandName);
  if (!command) {
    return { success: false, response: `Command "${commandName}" not found.` };
  }

  try {
    const fakeInteraction = await createFakeInteraction(
      message,
      processingMessage,
      commandName,
      subcommandName,
      args,
      locale
    );

    // Set locale based on user or guild preferences
    let effectiveLocale = locale || message.guild?.preferredLocale || "en";

    // Normalize locale (replacing hyphens, ensuring it's a supported locale)
    if (effectiveLocale.includes("-")) {
      effectiveLocale = effectiveLocale.split("-")[0].toLowerCase();
    }

    // If locale is not supported, fall back to en
    if (!["en", "ru", "uk"].includes(effectiveLocale)) {
      console.log(
        `Locale ${effectiveLocale} not supported, falling back to en`
      );
      effectiveLocale = "en";
    }

    console.log(
      `Setting locale to ${effectiveLocale} for user ${message.author.tag}`
    );
    i18n.setLocale(effectiveLocale);

    // Create context-specific i18n for this command
    let commandI18n;
    let response;

    // If this is a subcommand
    if (subcommandName && command.subcommands?.[subcommandName]) {
      // Get category from command or use command name as category
      const category = command.data?.category || commandName;

      // Create context-aware i18n for the subcommand
      console.log(`Creating context for ${category}.${subcommandName}`);
      commandI18n = i18n.createContextI18n(
        "commands",
        `${category}`,
        effectiveLocale
      );

      // Register any localizations if present
      if (command.subcommands[subcommandName].localization_strings) {
        i18n.registerLocalizations(
          "commands",
          `${category}`,
          command.subcommands[subcommandName].localization_strings
        );
      }

      // Execute the subcommand
      response = await command.subcommands[subcommandName].execute(
        fakeInteraction,
        commandI18n
      );
    }
    // Regular command without subcommands
    else if (command.execute) {
      // Get category from command or use command name as category
      const category = command.data?.category || commandName;

      // Create context-aware i18n for the command
      commandI18n = i18n.createContextI18n(
        "commands",
        category,
        effectiveLocale
      );

      // Register any localizations if present
      if (command.localization_strings) {
        i18n.registerLocalizations(
          "commands",
          category,
          command.localization_strings
        );
      }

      // Execute the command
      response = await command.execute(fakeInteraction, commandI18n);
    } else {
      return {
        success: false,
        response: "Command execution method not found.",
      };
    }

    return {
      success: true,
      response: response || "Command executed successfully.",
    };
  } catch (error) {
    console.error(`Error executing command ${name}:`, error);
    return {
      success: false,
      response: `Error executing command: ${error.message}`,
    };
  }
}

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

  if (inCodeBlock && !chunks[chunks.length - 1].endsWith("```")) {
    chunks[chunks.length - 1] += "\n```";
  }

  return chunks;
}

async function sendResponse(message, processingMessage, content) {
  const sanitizedContent = content
    .replace(/<@[!&]?\d+>/g, "no_mention")
    .replace(/@everyone/gi, "no_mention")
    .replace(/@here/gi, "no_mention");

  const chunks = splitMessage(sanitizedContent);
  await processingMessage.edit(chunks[0]);

  for (let i = 1; i < chunks.length; i++) {
    await message.channel.send(chunks[i]);
  }
}

// Main event handler
export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.mentions.users.has(message.client.user.id)) return;

    const messageContent = message.content
      .replace(`<@${message.client.user.id}>`, "")
      .trim();

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

      // Initialize or update user context
      if (!state.userContexts[message.author.id]) {
        state.userContexts[message.author.id] = [CONFIG.initialContext];
      }

      const messages = isVisionRequest
        ? [
            {
              role: "user",
              content: [
                { type: "text", text: translatedMessage },
                {
                  type: "image_url",
                  image_url: { url: message.attachments.first().url },
                },
              ],
            },
          ]
        : [
            ...state.userContexts[message.author.id],
            { role: "user", content: translatedMessage },
          ].slice(-CONFIG.maxContextLength - 1);

      const tools = isVisionRequest
        ? []
        : generateToolsFromCommands(message.client);

      let response;
      let retries = 0;
      const maxRetries = CONFIG.models[modelType].length * 2;
      let currentModel;

      while (retries < maxRetries) {
        currentModel = getAvailableModel(modelType);
        if (!currentModel) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }

        try {
          response = await message.client.groq.chat.completions.create({
            model: currentModel,
            messages,
            tools,
            tool_choice: isVisionRequest ? "none" : "auto",
          });
          break;
        } catch (error) {
          if (await handleRateLimit(error, modelType, currentModel)) {
            retries++;
            continue;
          }
          throw error;
        }
      }

      if (!response) {
        throw new Error(
          "Failed to get a response after trying all available models"
        );
      }

      const { content: aiContent = "", tool_calls = [] } =
        response.choices[0].message;
      let commandExecuted = false;
      let toolCallResponse = "";

      // Process all tool calls, not just the last one
      for (const toolCall of tool_calls) {
        const { success, response } = await executeToolCall(
          toolCall,
          message,
          processingMessage,
          originalLanguage
        );
        if (success) {
          commandExecuted = true;
          toolCallResponse = response;
          break; // Stop after first successful command execution
        }
      }

      if (aiContent.trim() || toolCallResponse) {
        let finalResponse = aiContent.trim();
        if (toolCallResponse) {
          finalResponse +=
            (finalResponse ? "\n\n" : "") +
            `Tool response: ${toolCallResponse}`;
        }

        const translatedResponse = await translate(
          finalResponse,
          "en",
          originalLanguage
        );
        await sendResponse(
          message,
          processingMessage,
          translatedResponse.translation
        );

        if (!isVisionRequest) {
          state.userContexts[message.author.id].push({
            role: "assistant",
            content: finalResponse,
          });
          if (
            state.userContexts[message.author.id].length >
            CONFIG.maxContextLength + 1
          ) {
            state.userContexts[message.author.id] = [
              CONFIG.initialContext,
              ...state.userContexts[message.author.id].slice(
                -CONFIG.maxContextLength
              ),
            ];
          }
        }
      } else if (commandExecuted) {
        await sendResponse(
          message,
          processingMessage,
          "Command executed successfully."
        );
      } else {
        await sendResponse(
          message,
          processingMessage,
          "No valid commands were executed."
        );
      }
    } catch (error) {
      console.error("Error processing request:", error);
      await sendResponse(
        message,
        processingMessage,
        `An error occurred while processing your request.\n\n[Debug: Error - ${error.message}]`
      );
    }
  },
};
