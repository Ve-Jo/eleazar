import { Events } from "discord.js";
import { translate } from "bing-translate-api";

let models = {
  text: [
    "llama-3.2-90b-text-preview",
    "llama-3.1-70b-versatile",
    "llama3-groq-70b-8192-tool-use-preview",
  ],
  vision: ["llama-3.2-90b-vision-preview", "llama-3.2-11b-vision-preview"],
};

let modelCooldowns = {
  text: {},
  vision: {},
};

const MAX_CONTEXT_LENGTH = 4;
const INITIAL_CONTEXT = {
  role: "system",
  content: `You are a discord bot called "Eleazar". You have tons of tools (commands) that you can execute for the user. If user just want to talk with you, try to talk as natural to him as possible.`,
};

let context = {};

function generateToolsFromCommands(client) {
  return Array.from(client.commands.values())
    .filter((command) => command.data && command.data.ai !== false)
    .flatMap((command) => {
      if (
        command.data.options &&
        command.data.options.some(
          (opt) => opt.toJSON && opt.toJSON().type === 1
        )
      ) {
        return command.data.options
          .filter((subcommand) => subcommand.ai !== false)
          .map((subcommand) => createToolObject(command.data.name, subcommand));
      }
      return [createToolObject(command.data.name, command.data)];
    });
}

function createToolObject(commandName, commandData) {
  const parameters = {};
  if (commandData.options) {
    commandData.options.forEach((option) => {
      if (option.required) {
        parameters[option.name] = {
          type: option.type === "INTEGER" ? "number" : "string",
          description: option.description,
        };

        if (option.choices) {
          parameters[option.name].enum = option.choices.map(
            (choice) => choice.value
          );
        }
      }
    });
  }

  // Get the correct description
  let description = commandData.description;
  if (commandData.toJSON) {
    const jsonData = commandData.toJSON();
    description = jsonData.description || description;
  }

  return {
    type: "function",
    function: {
      name: commandData.name
        ? `${commandName}_${commandData.name}`
        : commandName,
      description: description,
      parameters: {
        type: "object",
        properties: parameters,
        required: Object.keys(parameters),
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
  const parts = name.split("_");
  let commandName, subcommandName;

  if (parts.length > 1) {
    commandName = parts[0];
    subcommandName = parts.slice(1).join("_");
  } else {
    commandName = name;
    subcommandName = null;
  }

  const command = message.client.commands.get(commandName);

  if (!command) return { success: false, response: null };

  try {
    const fakeInteraction = await createFakeInteraction(
      message,
      processingMessage,
      commandName,
      subcommandName,
      args || "{}" // Pass "{}" if args is falsy
    );

    if (!fakeInteraction.guild || !fakeInteraction.member) {
      await processingMessage.edit(
        "This command can only be used in a server."
      );
      return {
        success: false,
        response: "This command can only be used in a server.",
      };
    }

    // Log information about the user being passed to the command
    const userOption = fakeInteraction.options.getUser("user");
    console.log(
      "User being passed to command:",
      userOption ? `${userOption.tag} (${userOption.id})` : "No user provided"
    );

    const response = await command.execute(fakeInteraction);
    return {
      success: true,
      response: response || "Command executed successfully.",
    };
  } catch (error) {
    console.error(`Error executing command ${name}:`, error);
    await processingMessage.edit(`Error executing command: ${error.message}`);
    return {
      success: false,
      response: `Error executing command: ${error.message}`,
    };
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
  const parsedArgs = args ? JSON.parse(args) : {};
  return {
    data: [{ name: subcommandName, value: args }],
    getSubcommand: () => subcommandName,
    getString: (name) => parsedArgs[name] || null,
    getInteger: (name) =>
      parsedArgs[name] ? parseInt(parsedArgs[name]) : null,
    getBoolean: (name) => parsedArgs[name] === "true",
    getUser: (name) => {
      if (parsedArgs[name]) {
        if (
          parsedArgs[name].startsWith("<@") &&
          parsedArgs[name].endsWith(">")
        ) {
          const userId = parsedArgs[name].replace(/[<@!>]/g, "");
          return message.client.users.cache.get(userId) || message.author;
        }
        // If it's a username, try to find the user in the guild
        const user = message.guild.members.cache.find(
          (member) =>
            member.user.username.toLowerCase() ===
            parsedArgs[name].replace("@", "").toLowerCase()
        );
        return user ? user.user : message.author;
      }
      return message.author;
    },
    getMember: (name) => {
      if (parsedArgs[name]) {
        if (
          parsedArgs[name].startsWith("<@") &&
          parsedArgs[name].endsWith(">")
        ) {
          const userId = parsedArgs[name].replace(/[<@!>]/g, "");
          return message.guild.members.cache.get(userId) || message.member;
        }
        // If it's a username, try to find the member in the guild
        return (
          message.guild.members.cache.find(
            (member) =>
              member.user.username.toLowerCase() ===
              parsedArgs[name].replace("@", "").toLowerCase()
          ) || message.member
        );
      }
      return message.member;
    },
    getChannel: (name) =>
      parsedArgs.channel
        ? message.guild.channels.cache.get(parsedArgs.channel)
        : message.channel,
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

      // Initialize context for the user if it doesn't exist
      if (!context[message.author.id]) {
        context[message.author.id] = [INITIAL_CONTEXT];
      }

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
          console.log(JSON.stringify(tools, null, 2));
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
      let debugInfo = `\n\n[Debug: Model used - ${currentModel}]`;
      let toolCallResponse = "";

      // Only process the last tool call
      if (toolCalls.length > 0) {
        const lastToolCall = toolCalls[toolCalls.length - 1];

        // Add debug information for all tool calls
        toolCalls.forEach((toolCall, index) => {
          debugInfo += `\n[Debug: AI suggested tool ${index + 1} of ${
            toolCalls.length
          }: "${toolCall.function.name}"]`;
        });

        // Add detailed debug information about the last tool call
        const parts = lastToolCall.function.name.split("_");
        const commandName = parts[0];
        const subcommandName =
          parts.length > 1 ? parts.slice(1).join("_") : null;

        const command = message.client.commands.get(commandName);

        debugInfo += `\n\n[Debug: Executing last tool call: "${lastToolCall.function.name}"]`;
        debugInfo += `\n  Command: ${commandName}`;
        if (command && command.data) {
          debugInfo += `\n  Command Description: ${command.data.description}`;
        }

        if (subcommandName) {
          debugInfo += `\n  Subcommand: ${subcommandName}`;
          debugInfo += `\n  Subcommand Description: ${lastToolCall.function.description}`;
        } else {
          debugInfo += `\n  Description: ${lastToolCall.function.description}`;
        }

        debugInfo += `\n  Parameters:`;

        const params = JSON.parse(lastToolCall.function.arguments);
        const requiredParams =
          lastToolCall.function?.parameters?.required || [];

        if (Object.keys(params).length > 0) {
          for (const [key, value] of Object.entries(params)) {
            debugInfo += `\n    ${key}: ${value}`;
          }

          // Add information about available enums (choices) for parameters
          if (
            lastToolCall.function.parameters &&
            lastToolCall.function.parameters.properties
          ) {
            for (const [paramName, paramDetails] of Object.entries(
              lastToolCall.function.parameters.properties
            )) {
              if (paramDetails.enum) {
                debugInfo += `\n  Available choices for ${paramName}:`;
                paramDetails.enum.forEach((choice) => {
                  debugInfo += `\n    - ${choice}`;
                });
              }
            }
          }
        } else {
          debugInfo += `\n    No parameters provided`;
        }

        debugInfo += `\n  Raw arguments: ${lastToolCall.function.arguments}`;

        const { success, response } = await executeToolCall(
          lastToolCall,
          message,
          processingMessage
        );
        if (success) {
          commandExecuted = true;
          toolCallResponse = response;
          debugInfo += `\n  Result: Command executed successfully`;
          debugInfo += `\n  Response: ${response}`;
        } else {
          debugInfo += `\n  Result: Command execution failed`;
          debugInfo += `\n  Error: ${response}`;
        }
      }

      if (aiContent.trim() || toolCallResponse) {
        let finalResponse = aiContent.trim();
        if (toolCallResponse) {
          finalResponse +=
            (finalResponse ? "\n\n" : "") +
            `Tool response: ${toolCallResponse}`;
        }
        const translatedResponse = await translateText(
          finalResponse,
          originalLanguage
        );
        await sendResponse(
          message,
          processingMessage,
          translatedResponse,
          debugInfo
        );
        // Update context for both text and vision requests
        context[message.author.id].push({
          role: "assistant",
          content: finalResponse,
        });
        // Ensure context doesn't exceed MAX_CONTEXT_LENGTH
        if (context[message.author.id].length > MAX_CONTEXT_LENGTH + 1) {
          context[message.author.id] = [
            INITIAL_CONTEXT,
            ...context[message.author.id].slice(-MAX_CONTEXT_LENGTH),
          ];
        }
      } else if (commandExecuted) {
        await sendResponse(
          message,
          processingMessage,
          `Command executed successfully.`,
          debugInfo
        );
      } else {
        await sendResponse(
          message,
          processingMessage,
          `No valid commands were executed.`,
          debugInfo
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
