import { Events } from "discord.js";
import { translate } from "bing-translate-api";
import i18n from "../utils/newI18n.js";

// Configuration
const CONFIG = {
  models: {
    text: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"],
    vision: ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview"],
  },
  maxContextLength: 4,
  initialContext: {
    role: "system",
    content: `You are a AI assistant for discord bot named "Eleazar" and created by "@vejoy_". You answer all questions. You have tons of tools (commands) that you can execute for the user. But if user just want to talk with you, try to talk as natural and simplier to him as possible (and not with tons of text).

When using command tools, always choose the most appropriate command for the user's request. Always include all required parameters and only the parameters that are defined for that specific command. Special values like "all" and "half" should be passed as strings when mentioned by users.`,
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
        const commandDescription = enhanceCommandDescription(
          commandData.name,
          "",
          commandData.description
        );

        tools.push({
          type: "function",
          function: {
            name: commandData.name,
            description: commandDescription,
            parameters: {
              type: "object",
              properties: generateParametersFromOptions(
                commandData.options || [],
                commandData.name,
                ""
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
              const subcommandDescription = enhanceCommandDescription(
                commandData.name,
                subcommandName,
                subcommand.data.description
              );

              tools.push({
                type: "function",
                function: {
                  name: `${commandData.name}_${subcommandName}`,
                  description: subcommandDescription,
                  parameters: {
                    type: "object",
                    properties: generateParametersFromOptions(
                      subcommand.data.options || [],
                      commandData.name,
                      subcommandName
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

// Helper function to enhance command descriptions
function enhanceCommandDescription(commandName, subcommandName, description) {
  // Special case for certain commands
  if (commandName === "economy") {
    if (subcommandName === "deposit") {
      return `${description}. Moves money from your wallet to your bank account. Use "all" or "half" as amount to deposit everything or half of your balance.`;
    } else if (subcommandName === "withdraw") {
      return `${description}. Moves money from your bank account to your wallet. Use "all" or "half" as amount to withdraw everything or half of your bank balance.`;
    } else if (subcommandName === "transfer") {
      return `${description}. Transfers money from your wallet to another user. Requires both amount and receiver (user mention or ID).`;
    }
  }

  return description;
}

function generateParametersFromOptions(options, commandName, subcommandName) {
  return options.reduce((params, option) => {
    // Enhanced description for specific parameters
    let enhancedDescription = option.description;

    if (commandName === "economy") {
      if (option.name === "amount") {
        if (subcommandName === "deposit" || subcommandName === "withdraw") {
          enhancedDescription = `${option.description}. You can use "all" or "half" as special values.`;
        }
      } else if (option.name === "receiver" && subcommandName === "transfer") {
        enhancedDescription = `${option.description}. Must be a valid user mention or ID, NOT "bank".`;
      }
    }

    params[option.name] = {
      type: getParameterType(option.type),
      description: enhancedDescription,
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
  // Handle args which can be either a string that needs parsing or an already parsed object
  let parsedArgs = {};

  if (args) {
    console.log(`Creating fake interaction with args type: ${typeof args}`);

    if (typeof args === "string") {
      // If it's an empty string or just whitespace, treat as empty object
      if (!args.trim()) {
        console.log("Args is empty string, using empty object");
      } else {
        try {
          parsedArgs = JSON.parse(args);
          console.log("Successfully parsed args string to object:", parsedArgs);
        } catch (e) {
          console.error("Error parsing command arguments:", e);
          // Try to extract values from malformed JSON
          try {
            // Create a simple object parser for key-value pairs that might be in a malformed format
            const argPairs = args.replace(/[{}]/g, "").split(",");
            argPairs.forEach((pair) => {
              const [key, value] = pair
                .split(":")
                .map((s) => s.trim().replace(/"/g, ""));
              if (key && value) {
                parsedArgs[key] = value;
              }
            });
            console.log("Extracted args from malformed JSON:", parsedArgs);
          } catch (ex) {
            console.error("Failed to extract args from string:", ex);
          }
        }
      }
    } else if (typeof args === "object") {
      parsedArgs = args;
      console.log("Using args object directly:", parsedArgs);
    }
  } else {
    console.log("No args provided, using empty object");
  }

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

  // Add debug logging
  console.log(`Executing tool call:`, {
    commandName,
    subcommandName,
    args: JSON.stringify(args),
    argsType: typeof args,
  });

  const command = message.client.commands.get(commandName);
  if (!command) {
    return { success: false, response: `Command "${commandName}" not found.` };
  }

  // Validate arguments
  let validationError = null;

  // Check if command requires arguments
  const commandOptions =
    subcommandName && command.subcommands?.[subcommandName]
      ? command.subcommands[subcommandName].data?.options
      : command.data?.options;

  if (commandOptions && commandOptions.length > 0) {
    // Check for required parameters
    const requiredParams = commandOptions
      .filter((opt) => opt.required)
      .map((opt) => opt.name);

    // Parse args if it's a string
    let parsedArgs = {};
    if (typeof args === "string") {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        return {
          success: false,
          response: `Invalid arguments format: ${e.message}`,
        };
      }
    } else if (typeof args === "object") {
      parsedArgs = args;
    }

    // Detect common misuse patterns
    if (commandName === "economy") {
      // Check for deposit/transfer confusion
      if (subcommandName === "deposit" && parsedArgs.receiver) {
        return {
          success: false,
          response: `The deposit command doesn't take a 'receiver' parameter. If you're trying to deposit money to your bank, just use economy_deposit with an amount. If you're trying to send money to another user, use economy_transfer instead.`,
        };
      }
      // Check for withdrawal/transfer confusion
      if (subcommandName === "withdraw" && parsedArgs.receiver) {
        return {
          success: false,
          response: `The withdraw command doesn't take a 'receiver' parameter. If you're trying to withdraw money from your bank, just use economy_withdraw with an amount.`,
        };
      }
      // Check for transfer to "bank"
      if (
        subcommandName === "transfer" &&
        parsedArgs.receiver &&
        (parsedArgs.receiver.toLowerCase() === "bank" ||
          parsedArgs.receiver.toLowerCase() === "my bank")
      ) {
        return {
          success: false,
          response: `To transfer money to your bank account, use the economy_deposit command instead of economy_transfer.`,
        };
      }
    }

    // Check for unexpected parameters
    const validParams = commandOptions.map((opt) => opt.name);
    const unexpectedParams = Object.keys(parsedArgs).filter(
      (param) => !validParams.includes(param)
    );

    if (unexpectedParams.length > 0) {
      console.log(
        `Unexpected parameters detected: ${unexpectedParams.join(", ")}`
      );

      // Remove unexpected parameters
      unexpectedParams.forEach((param) => {
        delete parsedArgs[param];
      });

      // Replace the args with the cleaned version
      if (typeof args === "string") {
        toolCall.function.arguments = JSON.stringify(parsedArgs);
      } else {
        toolCall.function.arguments = parsedArgs;
      }

      console.log(`Cleaned parameters:`, parsedArgs);
    }

    // Check for missing required parameters
    const missingParams = requiredParams.filter((param) => !parsedArgs[param]);

    if (missingParams.length > 0) {
      return {
        success: false,
        response: `Missing required parameters: ${missingParams.join(", ")}`,
      };
    }
  }

  try {
    const fakeInteraction = await createFakeInteraction(
      message,
      processingMessage,
      commandName,
      subcommandName,
      toolCall.function.arguments, // Use potentially cleaned arguments
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
      // Set locale for i18n
      i18n.setLocale(effectiveLocale);

      // Register any localizations if present
      if (command.subcommands[subcommandName].localization_strings) {
        i18n.registerLocalizations(
          "commands",
          `${commandName}.${subcommandName}`,
          command.subcommands[subcommandName].localization_strings
        );
      }

      // Execute the subcommand
      response = await command.subcommands[subcommandName].execute(
        fakeInteraction,
        i18n
      );
    }
    // Regular command without subcommands
    else if (command.execute) {
      // Set locale for i18n
      i18n.setLocale(effectiveLocale);

      // Register any localizations if present
      if (command.localization_strings) {
        i18n.registerLocalizations(
          "commands",
          commandName,
          command.localization_strings
        );
      }

      // Execute the command
      response = await command.execute(fakeInteraction);
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
        console.log(`Processing tool call: ${toolCall.function.name}`);

        // Log the raw argument data for debugging
        console.log(`Tool call raw arguments:`, toolCall.function.arguments);
        console.log(
          `Tool call arguments type: ${typeof toolCall.function.arguments}`
        );

        // Handle string arguments that need to be parsed to objects
        if (typeof toolCall.function.arguments === "string") {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            toolCall.function.arguments = parsedArgs;
            console.log(`Parsed string arguments to object:`, parsedArgs);
          } catch (e) {
            console.error(`Failed to parse arguments as JSON: ${e.message}`);
            // Continue with the string version
          }
        }

        const { success, response } = await executeToolCall(
          toolCall,
          message,
          processingMessage,
          originalLanguage
        );

        if (success) {
          commandExecuted = true;
          toolCallResponse = response;
          console.log(`Command executed successfully`);
          break; // Stop after first successful command execution
        } else {
          // If command failed, add the error response
          toolCallResponse = response;
          console.log(`Command execution failed: ${response}`);
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
