/**
 * Tools utilities for scanning and organizing command information.
 * This is used to help the AI understand what commands are available
 * to guide users, but actual tool execution is disabled.
 */

import { state } from "../../ai.js";

// Map Discord option types to JSON Schema types
export function getParameterType(optionType) {
  const typeMap = {
    // Numeric types (Discord.js ApplicationCommandOptionType enum values)
    3: "string", // STRING
    4: "integer", // INTEGER
    5: "boolean", // BOOLEAN
    6: "string", // USER
    7: "string", // CHANNEL
    8: "string", // ROLE
    10: "number", // NUMBER
    11: "string", // ATTACHMENT

    // String types (for easier reference in code)
    STRING: "string",
    INTEGER: "integer",
    BOOLEAN: "boolean",
    USER: "string",
    CHANNEL: "string",
    ROLE: "string",
    NUMBER: "number",
    ATTACHMENT: "string",

    // Direct string values
    string: "string",
    integer: "integer",
    boolean: "boolean",
    user: "string",
    channel: "string",
    role: "string",
    number: "number",
    attachment: "string",
  };

  let effectiveType = optionType;

  if (
    typeof optionType === "object" &&
    optionType !== null &&
    typeof optionType.type === "number"
  ) {
    effectiveType = optionType.type;
  } else if (
    typeof optionType === "object" &&
    optionType !== null &&
    optionType.name
  ) {
    const typeName = optionType.name.toUpperCase();
    if (typeMap[typeName]) {
      return typeMap[typeName];
    }
  }

  if (!typeMap[effectiveType]) {
    console.log(
      `Unrecognized option type: ${JSON.stringify(
        optionType,
      )}, defaulting to string`,
    );
  }

  return typeMap[effectiveType] || "string";
}

/**
 * Generate command definitions from Discord commands.
 * This function scans all available commands and creates structured definitions
 * that help the AI understand what commands are available and their parameters.
 *
 * Note: While this function returns tool-like definitions, they are only used for the AI
 * to understand command structure and guide users, not for direct execution.
 *
 * @param {Object} client - Discord client with commands collection
 * @returns {Array} Array of command definitions
 */
export function generateToolsFromCommands(client) {
  console.log("[INFO] Scanning commands to build reference for AI guidance...");

  function inspectCommandStructure(cmd, prefix) {
    try {
      const hasFunctions = typeof cmd.execute === "function";
      const hasSubcommands =
        cmd.subcommands && Object.keys(cmd.subcommands).length > 0;
      const dataType = cmd.data
        ? typeof cmd.data === "function"
          ? "function"
          : "object"
        : "none";

      console.log(
        `[INFO] ${prefix} structure: execute=${hasFunctions}, subcommands=${hasSubcommands}, data=${dataType}`,
      );
    } catch (e) {
      console.error(`Error inspecting ${prefix}:`, e);
    }
  }

  return Array.from(client.commands.values())
    .filter((command) => command.data && command.data.ai !== false)
    .flatMap((command) => {
      const commandData = command.data;
      console.log(`[INFO] Processing command: ${commandData.name}`);

      // Debug the actual command structure
      inspectCommandStructure(command, `Command ${commandData.name}`);

      const commandDefinitions = [];

      // Check if command has subcommands in the subcommands object
      if (command.subcommands) {
        console.log(
          `[INFO] Command ${commandData.name} has subcommands:`,
          Object.keys(command.subcommands),
        );

        Object.entries(command.subcommands).forEach(
          ([subcommandName, subcommand]) => {
            console.log(
              `[INFO] Processing subcommand: ${commandData.name}_${subcommandName}`,
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
                `[INFO] Found ${options.length} options in subcommand.data.options`,
              );
            } else if (
              subcommand.options &&
              Array.isArray(subcommand.options)
            ) {
              options = subcommand.options;
              console.log(
                `[INFO] Found ${options.length} options in subcommand.options`,
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
                    `[INFO] Found ${options.length} options in built subcommand data`,
                  );
                }
              } catch (error) {
                console.error(
                  `Error calling subcommand.data function: ${error.message}`,
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
                    `[INFO] Found ${options.length} options in subcommand.data.toJSON()`,
                  );
                }
              } catch (error) {
                console.error(
                  `Error calling subcommand.data.toJSON: ${error.message}`,
                );
              }
            }

            // For debugging, log what the subcommand data contains
            console.log(
              `[INFO] Subcommand ${subcommandName} data:`,
              subcommand.data,
            );

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
              `[INFO] Generated properties for ${commandData.name}_${subcommandName}:`,
              parameters,
            );
            console.log(
              `[INFO] Required params for ${commandData.name}_${subcommandName}:`,
              required,
            );

            // Create the command definition
            const commandDef = {
              type: "function",
              function: {
                name: `${commandData.name}_${subcommandName}`,
                description:
                  (subcommand.data && subcommand.data.description) ||
                  `${subcommandName} subcommand of ${commandData.name}`,
                parameters: {
                  type: "object",
                  properties: parameters,
                  required: required.length ? required : undefined,
                },
              },
            };

            console.log(
              `[INFO] Created definition for ${commandDef.function.name}`,
            );
            commandDefinitions.push(commandDef);
          },
        );
      }

      // If no subcommands were found but the command has direct options, create a definition for the main command
      if (commandDefinitions.length === 0 && command.execute) {
        console.log(
          `[INFO] Creating definition for main command: ${commandData.name}`,
        );

        const parameters = {};
        const required = [];
        let options = [];

        // Try different ways of getting options
        if (commandData.options && Array.isArray(commandData.options)) {
          options = commandData.options.filter((opt) => opt.type !== 1); // Filter out subcommand options
          console.log(
            `[INFO] Found ${options.length} direct options in commandData.options`,
          );
        } else if (command.options && Array.isArray(command.options)) {
          options = command.options.filter((opt) => opt.type !== 1);
          console.log(
            `[INFO] Found ${options.length} direct options in command.options`,
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
                `[INFO] Found ${options.length} direct options in built command data`,
              );
            }
          } catch (error) {
            console.error(
              `Error calling commandData function: ${error.message}`,
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
                `[INFO] Found ${options.length} direct options in commandData.toJSON()`,
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
          `[INFO] Generated properties for ${commandData.name}:`,
          parameters,
        );
        console.log(
          `[INFO] Required params for ${commandData.name}:`,
          required,
        );

        // Create the command definition
        const commandDef = {
          type: "function",
          function: {
            name: commandData.name,
            description:
              commandData.description || `${commandData.name} command`,
            parameters: {
              type: "object",
              properties: parameters,
              required: required.length ? required : undefined,
            },
          },
        };

        console.log(
          `[INFO] Created definition for ${commandDef.function.name}`,
        );
        commandDefinitions.push(commandDef);
      }

      return commandDefinitions;
    })
    .filter((t) => t);
}
