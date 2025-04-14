import { Events } from "discord.js";
import { translate } from "bing-translate-api";
import i18n from "../utils/newI18n.js";

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
  maxToolCallsPerTurn: 2,
  initialContext: {
    role: "system",
    content: `You are a friendly AI assistant for a Discord bot named "Eleazar" created by "@vejoy_". 

CONVERSATION MODE:
- By default, assume the user just wants to have a casual conversation.
- In conversation mode, respond naturally, be helpful, and don't try to execute commands unless specifically asked.
- Keep your responses conversational, concise, and engaging.

TOOL USAGE MODE:
- Only switch to tool usage mode when the user clearly requests a specific task that requires tools.
- Examples of clear task requests: "show me my balance", "translate this text", "help me create a poll", etc.
- When in tool usage mode, think step-by-step about what commands are needed and execute them.
- After completing tasks with tools, return to conversation mode.

Do not mention tools, commands, or your internal processes to the user. Just be natural and helpful.`,
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

  // Handle known parameter mapping issues
  // For example, AI might pass user_id when the command expects user
  if (parsedArgs.user_id && !parsedArgs.user) {
    console.log("Found user_id parameter, mapping to user parameter");
    parsedArgs.user = parsedArgs.user_id;
    delete parsedArgs.user_id;
  }

  // Command-specific parameter normalization
  if (
    commandName === "emotions" &&
    (subcommandName === "positive" || subcommandName === "negative")
  ) {
    // Emotions commands always need a user parameter
    console.log("Emotions command detected, ensuring proper user parameter");

    // Handle cases where the AI might provide target, target_user, etc. instead of user
    const possibleUserParams = [
      "target",
      "target_user",
      "targetUser",
      "target_id",
      "targetId",
    ];
    for (const param of possibleUserParams) {
      if (parsedArgs[param] && !parsedArgs.user) {
        console.log(`Found ${param} parameter, mapping to user parameter`);
        parsedArgs.user = parsedArgs[param];
        delete parsedArgs[param];
        break;
      }
    }

    // If still no user parameter and there's an emotion, try to infer the user is the message author
    if (!parsedArgs.user && parsedArgs.emotion) {
      console.log("No user parameter found, defaulting to message author");
      // DO NOT default to message author as the emotions command has a check against this
      // parsedArgs.user = message.author.id;
    }
  }

  // Ensure guild ID is available and valid
  if (!message.guild?.id) {
    console.error(
      "WARNING: No guild ID available in message object for AI command execution!"
    );
    // If we're in a DM, log this fact
    if (message.channel.type === 1) {
      // 1 is DM channel type
      console.log("Command is being executed in a DM channel");
    }
  } else {
    console.log(`Using guild ID: ${message.guild.id} for AI command execution`);
  }

  // Create the interaction object with all required properties
  const fakeInteraction = {
    commandName,
    user: message.author,
    guild: message.guild,
    guildId: message.guild?.id, // Explicitly provide guildId as a top-level property
    member: message.member,
    channel: message.channel,
    channelId: message.channel.id, // Explicitly provide channelId as a top-level property
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

  return fakeInteraction;
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
    const fakeInteraction = await createFakeInteraction(
      message,
      processingMessage,
      commandName,
      subcommandName,
      toolCall.function.arguments, // Use potentially cleaned arguments
      locale
    );

    // Validate guild ID - critical for database operations
    if (!fakeInteraction.guildId) {
      console.error(
        `ERROR: No guild ID in fakeInteraction for command ${commandName}`
      );
      if (message.guild?.id) {
        console.log(`Recovering guild ID from message: ${message.guild.id}`);
        fakeInteraction.guildId = message.guild.id;
        fakeInteraction.guild = message.guild;
      } else {
        return {
          success: false,
          response: `Error: This command requires a server (guild) to function. It cannot be used in DMs or when guild ID is unavailable.`,
        };
      }
    }

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

    // Perform pre-execution validation
    // For commands that operate on users, check if the user can be retrieved
    const commandOptions = subcommandName
      ? command.subcommands?.[subcommandName]?.data?.options
      : command.data?.options;

    const hasUserOption = commandOptions?.some(
      (opt) => opt.name === "user" && (opt.type === 6 || opt.type === "USER")
    );

    if (hasUserOption) {
      const userValue = fakeInteraction.options.getUser("user");
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

// Helper function to process a single turn of the agentic conversation
async function processAgenticTurn(
  client,
  message,
  processingMessage,
  currentMessages,
  effectiveLocale,
  tools,
  modelType,
  depth
) {
  if (depth > CONFIG.maxToolCallsPerTurn) {
    console.warn("Max tool call depth reached.");
    // Find the last assistant message to return
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === "assistant") {
        return currentMessages[i].content || "Reached maximum tool call depth.";
      }
    }
    return "Reached maximum tool call depth."; // Fallback
  }

  let response;
  let retries = 0;
  const maxRetries = CONFIG.models[modelType].length * 2; // Allow retrying each model once
  let currentModel;

  while (retries < maxRetries) {
    currentModel = getAvailableModel(modelType);
    if (!currentModel) {
      console.log("No models available, waiting...");
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before checking again
      // Simple retry increment, might need smarter logic if all models stay on cooldown
      retries++;
      continue;
    }

    console.log(
      `Attempting API call with model: ${currentModel}, Depth: ${depth}`
    );
    try {
      response = await client.groq.chat.completions.create({
        model: currentModel,
        messages: currentMessages,
        tools: tools,
        tool_choice: depth > 0 ? "auto" : "none",
      });
      break; // Success
    } catch (error) {
      console.error(`API Error with model ${currentModel}:`, error);
      if (await handleRateLimit(error, modelType, currentModel)) {
        console.log(
          `Rate limit hit for ${currentModel}. Cooldown updated. Retrying...`
        );
        retries++;
        continue; // Try next available model or wait
      }
      // If it's not a rate limit error, rethrow it
      throw error;
    }
  }

  if (!response) {
    throw new Error(
      "Failed to get a response after trying available models and retries."
    );
  }

  const messageResponse = response.choices[0].message;
  const aiContent = messageResponse.content;
  const toolCalls = messageResponse.tool_calls || [];

  // Add AI's response (thinking or final answer) to history
  if (aiContent || toolCalls.length > 0) {
    // Only add if there's content or tool calls requested
    currentMessages.push({
      role: "assistant",
      content: aiContent,
      tool_calls: toolCalls,
    });
  }

  if (toolCalls.length > 0) {
    console.log(`AI requested ${toolCalls.length} tool calls.`);
    const toolResultMessages = [];

    for (const toolCall of toolCalls) {
      console.log(`Executing tool: ${toolCall.function.name}`);
      // Log the raw argument data for debugging
      console.log(`Tool call raw arguments:`, toolCall.function.arguments);
      console.log(
        `Tool call arguments type: ${typeof toolCall.function.arguments}`
      );

      // It's crucial that executeToolCall can handle stringified JSON
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

      toolResultMessages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        // Ensure the response is stringified, even if it's already a string
        content:
          typeof toolResponse === "string"
            ? toolResponse
            : JSON.stringify(toolResponse),
      });
    }

    // Add tool results to history
    currentMessages.push(...toolResultMessages);

    // Call recursively for the next step
    response = await processAgenticTurn(
      client,
      message,
      processingMessage,
      currentMessages,
      effectiveLocale,
      tools,
      modelType,
      depth + 1
    );
  } else {
    // No tool calls, this is the final response
    console.log("No tool calls requested by AI. Final response:", aiContent);
    response = aiContent || "I have finished executing the requested actions."; // Provide a fallback if content is null
  }

  return response;
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
    const userLocale = message.guild?.preferredLocale || "en";
    // Normalize locale (e.g., 'en-US' -> 'en')
    const normalizedLocale = userLocale.split("-")[0].toLowerCase();
    // Fallback to 'en' if normalized locale isn't supported
    const effectiveLocale = ["en", "ru", "uk"].includes(normalizedLocale)
      ? normalizedLocale
      : "en";

    message.channel.sendTyping();
    const processingMessage = await message.channel.send(
      "Processing your request..."
    );

    try {
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

      console.log(`Generated ${tools.length} tools for AI to use. Tools data:`);
      console.log(JSON.stringify(tools, null, 2));

      // --- Start: Modified Agentic Flow ---

      let finalResponse = null;
      let modelUsed = null; // Keep track of the model used for the first call

      // Prepare for the first API call
      let firstCallRetries = 0;
      const firstCallMaxRetries = CONFIG.models[modelType].length * 2;

      while (firstCallRetries < firstCallMaxRetries) {
        const currentModel = getAvailableModel(modelType);
        if (!currentModel) {
          console.log("No models available for initial call, waiting...");
          await new Promise((resolve) => setTimeout(resolve, 5000));
          firstCallRetries++;
          continue;
        }
        modelUsed = currentModel; // Store the model being used

        console.log(`Attempting initial API call with model: ${currentModel}`);
        try {
          const initialApiResponse =
            await message.client.groq.chat.completions.create({
              model: currentModel,
              messages: initialMessages, // Use the prepared history + user message
              tools: tools,
              tool_choice: tools.length > 0 ? "auto" : "none",
            });

          const firstMessageResponse = initialApiResponse.choices[0].message;
          const initialAiContent = firstMessageResponse.content;
          const initialToolCalls = firstMessageResponse.tool_calls || [];

          // Add the first AI response to the history immediately
          if (initialAiContent || initialToolCalls.length > 0) {
            initialMessages.push({
              role: "assistant",
              content: initialAiContent,
              tool_calls: initialToolCalls,
            });
          }

          // Check if the first response requires tools
          if (initialToolCalls.length > 0) {
            console.log(
              `Initial response requested ${initialToolCalls.length} tool calls. Entering agentic loop.`
            );
            const toolResultMessages = [];

            // Execute the first set of tools
            for (const toolCall of initialToolCalls) {
              console.log(`Executing initial tool: ${toolCall.function.name}`);
              console.log(
                `Initial tool call raw arguments:`,
                toolCall.function.arguments
              );
              console.log(
                `Initial tool call arguments type: ${typeof toolCall.function
                  .arguments}`
              );

              const { success, response: toolResponse } = await executeToolCall(
                toolCall,
                message,
                processingMessage,
                effectiveLocale
              );

              console.log(
                `Initial tool ${toolCall.function.name} execution ${
                  success ? "succeeded" : "failed"
                }. Response:`,
                toolResponse
              );

              toolResultMessages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                content:
                  typeof toolResponse === "string"
                    ? toolResponse
                    : JSON.stringify(toolResponse),
              });
            }

            // Add tool results to history
            initialMessages.push(...toolResultMessages);

            // Now, call processAgenticTurn for potential further steps, starting at depth 1
            finalResponse = await processAgenticTurn(
              message.client,
              message,
              processingMessage,
              initialMessages, // Pass the updated history
              effectiveLocale,
              tools,
              modelType,
              1 // Start depth at 1 since the first turn is done
            );

            // After tool execution is complete, clear context except for system message
            if (CONFIG.initialContext) {
              console.log(
                "Tool execution complete. Clearing context except for system message."
              );
              state.userContexts[message.author.id] = [CONFIG.initialContext];
            } else {
              console.log("Tool execution complete. Clearing entire context.");
              state.userContexts[message.author.id] = [];
            }
          } else {
            // No tool calls in the initial response, treat it as a simple chat response
            console.log(
              "Initial response had no tool calls. Treating as chat."
            );
            finalResponse = initialAiContent || "Okay."; // Use the content directly
          }

          break; // Success, exit the retry loop
        } catch (error) {
          console.error(
            `API Error during initial call with model ${currentModel}:`,
            error
          );
          if (await handleRateLimit(error, modelType, currentModel)) {
            console.log(
              `Rate limit hit for ${currentModel}. Cooldown updated. Retrying initial call...`
            );
            firstCallRetries++;
            continue; // Try next available model or wait
          }
          // If it's not a rate limit error, throw it to the outer catch block
          throw error;
        }
      } // End of initial call retry loop

      if (finalResponse === null && firstCallRetries >= firstCallMaxRetries) {
        // This means we exhausted all models/retries on the *initial* call
        throw new Error(
          "Failed to get an initial response after trying available models and retries."
        );
      }

      // --- End: Modified Agentic Flow ---

      // Send the final response (either from chat or agentic loop)
      if (finalResponse) {
        await sendResponse(message, processingMessage, finalResponse);

        // Update user history (consistent logic as before)
        if (!isVisionRequest) {
          // 'initialMessages' contains the full trace up to the point before the last processAgenticTurn call
          // or just user -> assistant if it was treated as chat.
          // If agentic loop ran, processAgenticTurn returned the *final* AI content,
          // but the history ('initialMessages') might not have that very last message object yet.

          // Check if the final response content is already the last assistant message in history
          const lastMessageInHistory =
            initialMessages[initialMessages.length - 1];
          let needsFinalAssistantResponseAdded = true;

          if (
            lastMessageInHistory?.role === "assistant" &&
            lastMessageInHistory.content === finalResponse &&
            !lastMessageInHistory.tool_calls
          ) {
            // The final chat response or the last response from processAgenticTurn was already added correctly
            needsFinalAssistantResponseAdded = false;
          } else if (lastMessageInHistory?.role === "tool") {
            // The loop finished, but the final assistant message saying "Okay" or similar wasn't added
            needsFinalAssistantResponseAdded = true;
          }

          if (needsFinalAssistantResponseAdded) {
            // Add the final assistant message if it wasn't part of the trace already
            initialMessages.push({ role: "assistant", content: finalResponse });
          }

          // Now, prune the potentially updated initialMessages history
          state.userContexts[message.author.id] = initialMessages;
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
        }
      } else {
        // Handle cases where finalResponse is empty or null after the logic above
        await sendResponse(
          message,
          processingMessage,
          "Something went wrong, and I couldn't generate a final response."
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
