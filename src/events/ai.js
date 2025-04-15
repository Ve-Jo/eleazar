import { Events } from "discord.js";
import { translate } from "bing-translate-api";
import i18n from "../utils/newI18n.js";
import { Memer } from "memer.ts"; // Import Memer for text_memer command
import Database from "../database/client.js";

// Configuration
const CONFIG = {
  models: {
    text: [
      /*"qwen-qwq-32b",*/
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
    ],
    vision: [
      /*"qwen-qwq-32b",*/
      "meta-llama/llama-4-maverick-17b-128e-instruct",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.2-90b-vision-preview",
      "llama-3.2-11b-vision-preview",
    ],
  },
  maxContextLength: 4,
  // Toggle AI's ability to use tools/commands
  enableTools: true,
  initialContext: {
    role: "system",
    content: `You are a natural and helpful AI assistant for a Discord bot named "Eleazar" created by "@vejoy_". 

CONVERSATION NOTICE:
- By default, assume the user just wants to have a casual conversation.
- In conversation, respond naturally, be helpful, and don't try to execute tools unless specifically asked.
- Keep your responses conversational, concise, and engaging.

TOOL USAGE NOTICE:
- Only run tools when the user clearly requests a specific task that requires tools.
- Examples of clear task requests: "show me my balance", "translate this text", "help me create a poll", etc.
- When you are running tool, make sure you're filling all the parameters correctly.

Do not mention tools, commands, or your internal processes to the user. Always answer in the same language as the user.`,
  },
};

// State management
const state = {
  modelCooldowns: { text: {}, vision: {} },
  userContexts: {},
};

// Helper functions
function getAvailableModel(modelType) {
  // Simply return the first model in the list
  return CONFIG.models[modelType][0];
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
  console.log("Generating tools from commands...");

  return Array.from(client.commands.values())
    .filter((command) => command.data && command.data.ai !== false)
    .flatMap((command) => {
      const commandData = command.data;
      console.log(`Processing command: ${commandData.name}`);

      // Debug the actual command structure
      inspectCommandStructure(command, `Command ${commandData.name}`);

      const tools = [];

      // Check if command has subcommands in the subcommands object
      if (command.subcommands) {
        Object.entries(command.subcommands).forEach(
          ([subcommandName, subcommand]) => {
            console.log(
              `Processing subcommand from subcommands object: ${commandData.name}_${subcommandName}`
            );

            // Debug the subcommand structure
            inspectCommandStructure(subcommand, `Subcommand ${subcommandName}`);

            const parameters = {};
            const required = [];

            // Try different ways of getting options
            let options = [];

            // Check various paths where options might be stored
            if (
              subcommand.data &&
              subcommand.data.options &&
              Array.isArray(subcommand.data.options)
            ) {
              options = subcommand.data.options;
              console.log(
                `Found ${options.length} options in subcommand.data.options`
              );
            } else if (
              subcommand.options &&
              Array.isArray(subcommand.options)
            ) {
              options = subcommand.options;
              console.log(
                `Found ${options.length} options in subcommand.options`
              );
            } else if (
              subcommand.data &&
              typeof subcommand.data === "function"
            ) {
              // If data is a function, try to call it
              try {
                const builtData = subcommand.data();
                if (
                  builtData &&
                  builtData.options &&
                  Array.isArray(builtData.options)
                ) {
                  options = builtData.options;
                  console.log(
                    `Found ${options.length} options in built subcommand data`
                  );
                }
              } catch (error) {
                console.error(
                  `Error calling subcommand.data function: ${error.message}`
                );
              }
            } else if (subcommand.data && subcommand.data.toJSON) {
              // If data has toJSON method, try to use it
              try {
                const jsonData = subcommand.data.toJSON();
                if (
                  jsonData &&
                  jsonData.options &&
                  Array.isArray(jsonData.options)
                ) {
                  options = jsonData.options;
                  console.log(
                    `Found ${options.length} options in subcommand.data.toJSON()`
                  );
                }
              } catch (error) {
                console.error(
                  `Error calling subcommand.data.toJSON: ${error.message}`
                );
              }
            }

            // Process options if we found any
            options.forEach((option) => {
              // Create parameter definition
              let paramDesc = option.description || "";

              // Enhance description based on parameter type
              if (
                option.type === 6 ||
                option.type === "USER" ||
                option.name === "user"
              ) {
                paramDesc += " (Provide a user mention, user ID, or username)";
              } else if (option.type === 7 || option.type === "CHANNEL") {
                paramDesc += " (Provide a channel mention or channel name)";
              } else if (option.type === 8 || option.type === "ROLE") {
                paramDesc += " (Provide a role mention or role name)";
              }

              // Add min/max values for numeric options
              if (
                (option.type === 4 ||
                  option.type === "INTEGER" ||
                  option.type === 10 ||
                  option.type === "NUMBER") &&
                (option.minValue !== undefined ||
                  option.maxValue !== undefined ||
                  option.min_value !== undefined ||
                  option.max_value !== undefined)
              ) {
                let rangeText = " (";
                if (
                  option.minValue !== undefined ||
                  option.min_value !== undefined
                ) {
                  rangeText += `Min: ${
                    option.minValue !== undefined
                      ? option.minValue
                      : option.min_value
                  }`;
                  if (
                    option.maxValue !== undefined ||
                    option.max_value !== undefined
                  )
                    rangeText += ", ";
                }
                if (
                  option.maxValue !== undefined ||
                  option.max_value !== undefined
                ) {
                  rangeText += `Max: ${
                    option.maxValue !== undefined
                      ? option.maxValue
                      : option.max_value
                  }`;
                }
                rangeText += ")";
                paramDesc += rangeText;
              }

              // Add choices if available
              if (option.choices && option.choices.length > 0) {
                paramDesc += ` (Choices: ${option.choices
                  .map((c) => `\`${c.name}\` (\`${c.value}\`)`)
                  .join(", ")})`;
              }

              // Add parameter to properties
              parameters[option.name] = {
                type: getParameterType(option.type),
                description: paramDesc,
                ...(option.choices && {
                  enum: option.choices.map((choice) => choice.value),
                }),
              };

              // Add to required list if needed
              if (option.required) {
                required.push(option.name);
              }
            });

            console.log(
              `Generated properties for ${commandData.name}_${subcommandName}:`,
              parameters
            );
            console.log(
              `Required params for ${commandData.name}_${subcommandName}:`,
              required
            );

            // Create the tool
            tools.push({
              type: "function",
              function: {
                name: `${commandData.name}_${subcommandName}`,
                description:
                  (subcommand.data && subcommand.data.description) ||
                  `${subcommandName} subcommand of ${commandData.name}`,
                parameters: {
                  type: "object",
                  properties: parameters,
                  required: required,
                },
              },
            });
          }
        );
      }

      // If no subcommands were found but the command has direct options, create a tool for the main command
      if (tools.length === 0 && command.execute) {
        console.log(`Creating tool for main command: ${commandData.name}`);

        const parameters = {};
        const required = [];
        let options = [];

        // Try different ways of getting options
        if (commandData.options && Array.isArray(commandData.options)) {
          options = commandData.options.filter((opt) => opt.type !== 1); // Filter out subcommand options
          console.log(
            `Found ${options.length} direct options in commandData.options`
          );
        } else if (command.options && Array.isArray(command.options)) {
          options = command.options.filter((opt) => opt.type !== 1);
          console.log(
            `Found ${options.length} direct options in command.options`
          );
        } else if (typeof commandData === "function") {
          try {
            const builtData = commandData();
            if (
              builtData &&
              builtData.options &&
              Array.isArray(builtData.options)
            ) {
              options = builtData.options.filter((opt) => opt.type !== 1);
              console.log(
                `Found ${options.length} direct options in built command data`
              );
            }
          } catch (error) {
            console.error(
              `Error calling commandData function: ${error.message}`
            );
          }
        } else if (commandData.toJSON) {
          try {
            const jsonData = commandData.toJSON();
            if (
              jsonData &&
              jsonData.options &&
              Array.isArray(jsonData.options)
            ) {
              options = jsonData.options.filter((opt) => opt.type !== 1);
              console.log(
                `Found ${options.length} direct options in commandData.toJSON()`
              );
            }
          } catch (error) {
            console.error(`Error calling commandData.toJSON: ${error.message}`);
          }
        }

        // Process options if we found any
        options.forEach((option) => {
          // Create parameter definition
          let paramDesc = option.description || "";

          // Enhance description based on parameter type
          if (
            option.type === 6 ||
            option.type === "USER" ||
            option.name === "user"
          ) {
            paramDesc += " (Provide a user mention, user ID, or username)";
          } else if (option.type === 7 || option.type === "CHANNEL") {
            paramDesc += " (Provide a channel mention or channel name)";
          } else if (option.type === 8 || option.type === "ROLE") {
            paramDesc += " (Provide a role mention or role name)";
          }

          // Add min/max values for numeric options
          if (
            (option.type === 4 ||
              option.type === "INTEGER" ||
              option.type === 10 ||
              option.type === "NUMBER") &&
            (option.minValue !== undefined ||
              option.maxValue !== undefined ||
              option.min_value !== undefined ||
              option.max_value !== undefined)
          ) {
            let rangeText = " (";
            if (
              option.minValue !== undefined ||
              option.min_value !== undefined
            ) {
              rangeText += `Min: ${
                option.minValue !== undefined
                  ? option.minValue
                  : option.min_value
              }`;
              if (
                option.maxValue !== undefined ||
                option.max_value !== undefined
              )
                rangeText += ", ";
            }
            if (
              option.maxValue !== undefined ||
              option.max_value !== undefined
            ) {
              rangeText += `Max: ${
                option.maxValue !== undefined
                  ? option.maxValue
                  : option.max_value
              }`;
            }
            rangeText += ")";
            paramDesc += rangeText;
          }

          // Add choices if available
          if (option.choices && option.choices.length > 0) {
            paramDesc += ` (Choices: ${option.choices
              .map((c) => `\`${c.name}\` (\`${c.value}\`)`)
              .join(", ")})`;
          }

          // Add parameter to properties
          parameters[option.name] = {
            type: getParameterType(option.type),
            description: paramDesc,
            ...(option.choices && {
              enum: option.choices.map((choice) => choice.value),
            }),
          };

          // Add to required list if needed
          if (option.required) {
            required.push(option.name);
          }
        });

        console.log(
          `Generated properties for ${commandData.name}:`,
          parameters
        );
        console.log(`Required params for ${commandData.name}:`, required);

        // Create the tool
        tools.push({
          type: "function",
          function: {
            name: commandData.name,
            description:
              commandData.description || `${commandData.name} command`,
            parameters: {
              type: "object",
              properties: parameters,
              required: required,
            },
          },
        });
      }

      return tools;
    });
}

function getParameterType(optionType) {
  const typeMap = {
    // Numeric types (Discord.js ApplicationCommandOptionType enum values)
    3: "string", // STRING
    4: "integer", // INTEGER
    5: "boolean", // BOOLEAN
    6: "string", // USER
    7: "string", // CHANNEL
    8: "string", // ROLE
    10: "number", // NUMBER

    // String types (for easier reference in code)
    STRING: "string",
    INTEGER: "integer",
    BOOLEAN: "boolean",
    USER: "string",
    CHANNEL: "string",
    ROLE: "string",
    NUMBER: "number",

    // Direct string values
    string: "string",
    integer: "integer",
    boolean: "boolean",
    user: "string",
    channel: "string",
    role: "string",
    number: "number",
  };

  // Add special handling for options where the type is an object with a name property
  if (typeof optionType === "object" && optionType !== null) {
    if (optionType.name) {
      const typeName = optionType.name.toUpperCase();
      if (typeMap[typeName]) {
        return typeMap[typeName];
      }
    }
  }

  // Log unrecognized types for debugging
  if (!typeMap[optionType]) {
    console.log(
      `Unrecognized option type: ${optionType}, defaulting to string`
    );
  }

  return typeMap[optionType] || "string";
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
    guildId: message.guild?.id || "NO_GUILD_ID", // Log guild ID for debugging
  });

  const command = message.client.commands.get(commandName);
  if (!command) {
    return { success: false, response: `Command "${commandName}" not found.` };
  }

  // Validate arguments
  let validationError = null;

  // Check if command requires arguments
  const commandObject = subcommandName
    ? command.subcommands?.[subcommandName]
    : command;

  const commandOptions = commandObject?.data?.options || [];

  // Special handling for certain command types
  // Games always require guild context
  if (
    commandName === "games" ||
    commandName === "economy" ||
    (subcommandName === "work" && commandName === "economy")
  ) {
    if (!message.guild?.id) {
      return {
        success: false,
        response: `Error: Game and economy commands can only be used in servers, not in DMs.`,
      };
    }
  }

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
          response: `Invalid arguments format: ${e.message}. Expected a JSON object string. Arguments received: ${args}`,
        };
      }
    } else if (typeof args === "object" && args !== null) {
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
          parsedArgs.receiver.toLowerCase() === "my bank" ||
          parsedArgs.receiver.toLowerCase() === '"bank"' ||
          parsedArgs.receiver.toLowerCase() === '"my bank"')
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
        `Unexpected parameters detected for ${name}: ${unexpectedParams.join(
          ", "
        )}. Allowed: ${validParams.join(", ")}. Received: ${JSON.stringify(
          parsedArgs
        )}`
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
        response: `Missing required parameters for command ${name}: ${missingParams.join(
          ", "
        )}. Required: ${requiredParams.join(", ")}. Received: ${JSON.stringify(
          parsedArgs
        )}`,
      };
    }
  }

  try {
    // Create a proxy for command execution that integrates with the existing command system
    const aiCommandProxy = {
      isChatInputCommand: () => true,
      isCommand: () => true,
      options: {
        getSubcommand: () => subcommandName,
      },
      commandName,
      user: message.author,
      member: message.member,
      guild: message.guild,
      guildId: message.guild?.id,
      channel: message.channel,
      channelId: message.channel.id,
      client: message.client,
      locale: locale || message.guild?.preferredLocale || "en",
      reply: async (content) => processingMessage.edit(content),
      editReply: async (content) => processingMessage.edit(content),
      deferReply: async () => processingMessage.edit("Processing..."),
      followUp: async (content) => message.channel.send(content),
      deferred: false,
      replied: false,
      ephemeral: false,
    };

    // Add options getters that directly use the parsed arguments
    let parsedArgs = {};
    if (typeof args === "string") {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        console.error("Error parsing arguments:", e);
        parsedArgs = {};
      }
    } else if (typeof args === "object" && args !== null) {
      parsedArgs = args;
    }

    // Create option getters for the command
    const optionGetters = {
      getString: (name) => parsedArgs[name]?.toString() || null,
      getInteger: (name) =>
        parsedArgs[name] ? parseInt(parsedArgs[name]) : null,
      getBoolean: (name) =>
        parsedArgs[name] === true || parsedArgs[name] === "true",
      getNumber: (name) =>
        parsedArgs[name] ? parseFloat(parsedArgs[name]) : null,
      getUser: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;

        // Handle direct user IDs - if it's a valid snowflake
        if (/^\d{17,19}$/.test(value)) {
          return message.client.users.cache.get(value);
        }

        // Handle mentions
        if (value.startsWith("<@") && value.endsWith(">")) {
          return message.client.users.cache.get(value.replace(/[<@!>]/g, ""));
        }

        // Try to find by username
        return message.client.users.cache.find(
          (u) =>
            u.username.toLowerCase() === value.toLowerCase().replace("@", "")
        );
      },
      getMember: (name) => {
        const value = parsedArgs[name];
        if (!value) return message.member;

        // Handle direct user IDs - if it's a valid snowflake
        if (/^\d{17,19}$/.test(value)) {
          return message.guild.members.cache.get(value) || message.member;
        }

        // Handle mentions
        if (value.startsWith("<@") && value.endsWith(">")) {
          const userId = value.replace(/[<@!>]/g, "");
          return message.guild.members.cache.get(userId) || message.member;
        }

        // Try to find by username as fallback
        const memberByName = message.guild.members.cache.find(
          (member) =>
            member.user.username.toLowerCase() ===
            value.toLowerCase().replace("@", "")
        );

        return memberByName || message.member;
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
    };

    // Add option getters to the proxy
    aiCommandProxy.options = {
      ...aiCommandProxy.options,
      ...optionGetters,
    };

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
    let response;

    // Perform pre-execution validation
    // For commands that operate on users, check if the user can be retrieved
    const commandOptions = subcommandName
      ? command.subcommands?.[subcommandName]?.data?.options
      : command.data?.options;

    const hasUserOption = commandOptions?.some(
      (opt) => opt.name === "user" && (opt.type === 6 || opt.type === "USER")
    );

    if (hasUserOption) {
      const userValue = aiCommandProxy.options.getUser("user");
      if (!userValue) {
        console.log("User option exists but getUser('user') returned null");
        const rawUserValue =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments).user
            : toolCall.function.arguments.user;
        console.log(`Raw user value: ${rawUserValue}`);

        // If this user parameter is required, return an error instead of proceeding
        const isUserRequired = commandOptions?.some(
          (opt) => opt.name === "user" && opt.required
        );

        if (isUserRequired) {
          return {
            success: false,
            response: `Could not find a valid user with the provided value: ${rawUserValue}. Please use a valid user mention, user ID, or username.`,
          };
        }
      }
    }

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
        aiCommandProxy,
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
      response = await command.execute(aiCommandProxy, i18n);
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

    // Determine the locale for this interaction
    let effectiveLocale = "en"; // Default to English
    try {
      // 1. Try fetching the user's saved locale from the database
      const userDbLocale = await Database.getUserLocale(
        message.guild?.id,
        message.author.id
      );
      if (userDbLocale && ["en", "ru", "uk"].includes(userDbLocale)) {
        effectiveLocale = userDbLocale;
        console.log(
          `Using saved locale for ${message.author.tag}: ${effectiveLocale}`
        );
      } else {
        // 2. Fallback to guild preferred locale if user locale isn't set or invalid
        const guildLocale = message.guild?.preferredLocale;
        if (guildLocale) {
          // Normalize locale (e.g., 'en-US' -> 'en')
          const normalizedGuildLocale = guildLocale.split("-")[0].toLowerCase();
          // Use guild locale if it's supported
          if (["en", "ru", "uk"].includes(normalizedGuildLocale)) {
            effectiveLocale = normalizedGuildLocale;
            console.log(
              `Using guild locale for ${message.author.tag}: ${effectiveLocale}`
            );
          }
        }
        // 3. If neither user nor guild locale is valid/available, 'en' remains the default.
      }
    } catch (dbError) {
      console.error(
        `Error fetching user locale for ${message.author.id}, defaulting to 'en':`,
        dbError
      );
      // Keep default 'en' on database error
    }

    message.channel.sendTyping();
    const processingMessage = await message.channel.send(
      "Processing your request..."
    );

    try {
      // Determine if this is a vision request based on attachments
      const isVisionRequest = message.attachments.size > 0;
      const modelType = isVisionRequest ? "vision" : "text";

      // Initialize or update user context
      if (!state.userContexts[message.author.id]) {
        state.userContexts[message.author.id] = [];
        // Add initial system context if defined
        if (CONFIG.initialContext) {
          state.userContexts[message.author.id].push(CONFIG.initialContext);
        }
      }

      // Select relevant history, respecting maxContextLength
      // Calculate how many messages to keep besides the initial context (if any)
      const historyStartIndex = CONFIG.initialContext ? 1 : 0;
      const historyToKeep =
        state.userContexts[message.author.id].slice(historyStartIndex);
      const prunedHistory = historyToKeep.slice(-CONFIG.maxContextLength); // Keep the last N messages

      const initialMessages = [
        // Add initial context back if it exists
        ...(CONFIG.initialContext
          ? [state.userContexts[message.author.id][0]]
          : []),
        ...prunedHistory, // Add the pruned history
      ];

      // Add current user message
      if (isVisionRequest) {
        initialMessages.push({
          role: "user",
          content: [
            { type: "text", text: messageContent },
            {
              type: "image_url",
              image_url: { url: message.attachments.first().url },
            },
          ],
        });
      } else {
        initialMessages.push({ role: "user", content: messageContent });
      }

      // Only provide tools to the AI if enableTools is true and not a vision request
      const tools =
        isVisionRequest || !CONFIG.enableTools
          ? []
          : generateToolsFromCommands(message.client);

      console.log(`Generated ${tools.length} tools for AI to use.`);
      console.log(JSON.stringify(tools, null, 2));

      // Get the model to use
      const currentModel = getAvailableModel(modelType);
      console.log(`Making API call with model: ${currentModel}`);

      let response;
      try {
        response = await message.client.groq.chat.completions.create({
          model: currentModel,
          messages: initialMessages,
          tools: tools,
          tool_choice: tools.length > 0 ? "auto" : "none",
        });
      } catch (error) {
        console.error(`API Error with model ${currentModel}:`, error);
        throw error;
      }

      const messageResponse = response.choices[0].message;
      const aiContent = messageResponse.content;
      const toolCalls = messageResponse.tool_calls || [];

      let finalResponse = aiContent;

      // If there are tool calls, process them
      if (toolCalls.length > 0) {
        console.log(`AI requested ${toolCalls.length} tool calls.`);

        // Process tool calls
        for (const toolCall of toolCalls) {
          console.log(`Executing tool: ${toolCall.function.name}`);

          const { success, response: toolResponse } = await executeToolCall(
            toolCall,
            message,
            processingMessage,
            effectiveLocale
          );

          console.log(
            `Tool ${toolCall.function.name} execution ${
              success ? "succeeded" : "failed"
            }. Response:`,
            toolResponse
          );

          // Add tool result to the response
          if (!success) {
            finalResponse = toolResponse;
          } else if (typeof toolResponse === "string") {
            finalResponse = toolResponse;
          } else {
            finalResponse = JSON.stringify(toolResponse);
          }
        }
      } else {
        // Check if the AI tried to use a "fake" tool in text format
        const fakeToolCall = detectFakeToolCalls(aiContent);
        if (fakeToolCall) {
          console.log(
            `Detected fake tool call in AI response: ${fakeToolCall.name}`
          );

          // Create a proper tool call from the fake one
          const properToolCall = {
            function: {
              name: fakeToolCall.name,
              arguments: JSON.stringify(fakeToolCall.args),
            },
          };

          // Execute the real tool
          const { success, response: toolResponse } = await executeToolCall(
            properToolCall,
            message,
            processingMessage,
            effectiveLocale
          );

          console.log(
            `Converted fake tool ${fakeToolCall.name} execution ${
              success ? "succeeded" : "failed"
            }. Response:`,
            toolResponse
          );

          // Replace the fake tool text with the real response
          // First remove the fake tool call syntax completely
          let cleanedResponse = aiContent.replace(fakeToolCall.fullMatch, "");
          // Then add the real tool response
          finalResponse =
            cleanedResponse.trim() +
            (cleanedResponse.trim() ? "\n\n" : "") +
            (typeof toolResponse === "string"
              ? toolResponse
              : JSON.stringify(toolResponse));

          // Clear context when a fake tool call is detected to prevent this behavior from repeating
          console.log("Clearing context due to fake tool call detection");
          if (CONFIG.initialContext) {
            state.userContexts[message.author.id] = [CONFIG.initialContext];
          } else {
            state.userContexts[message.author.id] = [];
          }
        }
      }

      // Send the final response
      if (finalResponse) {
        await sendResponse(message, processingMessage, finalResponse);

        // Add the conversation to context for future reference
        if (CONFIG.initialContext) {
          state.userContexts[message.author.id] = [
            CONFIG.initialContext,
            { role: "user", content: messageContent },
            { role: "assistant", content: finalResponse },
          ];
        } else {
          state.userContexts[message.author.id] = [
            { role: "user", content: messageContent },
            { role: "assistant", content: finalResponse },
          ];
        }

        // Trim history if needed
        const currentHistory = state.userContexts[message.author.id];
        const historyStartIndex = CONFIG.initialContext ? 1 : 0;
        if (
          currentHistory.length - historyStartIndex >
          CONFIG.maxContextLength
        ) {
          state.userContexts[message.author.id] = [
            ...(CONFIG.initialContext ? [currentHistory[0]] : []),
            ...currentHistory.slice(-CONFIG.maxContextLength),
          ];
        }
      } else {
        await sendResponse(
          message,
          processingMessage,
          "I didn't have a response for that."
        );
      }
    } catch (error) {
      console.error("Error processing request:", error);
      await sendResponse(
        message,
        processingMessage,
        `An error occurred while processing your request.`
      );
    }
  },
};

// Add this helper function at the top
function inspectCommandStructure(obj, label, maxDepth = 2) {
  console.log(`\n======= INSPECTING: ${label} =======`);

  // Function to safely stringify circular structures
  function safeStringify(obj, depth = 0) {
    if (depth > maxDepth) return "[Max Depth Reached]";
    if (typeof obj !== "object" || obj === null) return obj;

    const result = {};
    for (const key in obj) {
      if (
        key === "client" ||
        key === "guild" ||
        key === "commands" ||
        key === "cache"
      ) {
        result[key] = "[Circular Reference]";
      } else if (typeof obj[key] === "function") {
        result[key] = "[Function]";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        result[key] = safeStringify(obj[key], depth + 1);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }

  const safeObj = safeStringify(obj);
  console.log(JSON.stringify(safeObj, null, 2));
  console.log(`======= END INSPECTION: ${label} =======\n`);
}

// Function to detect fake tool calls in text
function detectFakeToolCalls(text) {
  if (!text) return null;

  // Pattern for detecting HTML-like tags with attributes
  // This will match patterns like <command param="value" param2="value2"></command>
  const tagPattern =
    /<([a-zA-Z0-9_]+)([^>]*?)>(.*?)<\/\1>|<([a-zA-Z0-9_]+)([^>]*?)\/?>/g;

  // Pattern for extracting attributes from matched tag
  const attrPattern = /([a-zA-Z0-9_]+)=["']([^"']*)["']/g;

  const matches = Array.from(text.matchAll(tagPattern));

  if (matches.length === 0) return null;

  // Check all matches and return the first valid one
  for (const match of matches) {
    // Extract the tag name - either from the opening/closing pair or self-closing tag
    const tagName = match[1] || match[4];
    // Extract the attributes part - either from opening/closing pair or self-closing tag
    const attributesText = match[2] || match[5];
    // Extract the full match
    const fullMatch = match[0];

    // Skip if this doesn't look like a command
    if (!tagName) continue;

    // Check if the tag name exists as a command or command_subcommand pattern
    // First, get all available commands from the client.commands collection
    const allCommands = [];
    const validCommandPattern =
      /(filters|economy|music|counting|emotions|images|help|ai)(_[a-zA-Z0-9_]+)?/;

    // Skip common HTML tags and formatting tags that are not commands
    const commonTags = [
      "div",
      "span",
      "p",
      "a",
      "img",
      "function",
      "code",
      "pre",
      "b",
      "i",
      "u",
      "strong",
      "em",
      "br",
      "hr",
    ];
    if (commonTags.includes(tagName.toLowerCase())) continue;

    // Only process tags that match our command pattern or are known commands
    if (!validCommandPattern.test(tagName)) continue;

    // Extract attributes as key-value pairs
    const attributes = {};
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attributesText)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }

    console.log(
      `Detected potential fake tool: ${tagName} with attributes:`,
      attributes
    );

    // Return information about the fake tool call
    return {
      name: tagName,
      args: attributes,
      fullMatch: fullMatch,
    };
  }

  return null;
}
