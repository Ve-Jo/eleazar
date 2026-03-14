type ToolParameterSchema = {
  type: string;
  description: string;
  enum?: Array<string | number>;
};

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParameterSchema>;
      required?: string[];
    };
  };
};

type CommandOption = {
  type?: number | string | { type?: number; name?: string };
  name: string;
  description?: string;
  required?: boolean;
  choices?: Array<{ name: string; value: string | number }>;
  minValue?: number;
  maxValue?: number;
  min_value?: number;
  max_value?: number;
  options?: CommandOption[];
};

type CommandDataShape = {
  name: string;
  description?: string;
  ai?: boolean;
  options?: CommandOption[];
  toJSON?: () => { options?: CommandOption[] };
};

type CommandShape = {
  data?: CommandDataShape | (() => CommandDataShape);
  execute?: (...args: unknown[]) => unknown;
  subcommands?: Record<string, CommandShape>;
  options?: CommandOption[];
};

type ClientWithCommands = {
  commands: Map<string, CommandShape>;
};

const typeMap: Record<string | number, string> = {
  3: "string",
  4: "integer",
  5: "boolean",
  6: "string",
  7: "string",
  8: "string",
  10: "number",
  11: "string",
  STRING: "string",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  USER: "string",
  CHANNEL: "string",
  ROLE: "string",
  NUMBER: "number",
  ATTACHMENT: "string",
  string: "string",
  integer: "integer",
  boolean: "boolean",
  user: "string",
  channel: "string",
  role: "string",
  number: "number",
  attachment: "string",
};

function getParameterType(optionType: CommandOption["type"]): string {
  let effectiveType: string | number | undefined =
    typeof optionType === "string" || typeof optionType === "number"
      ? optionType
      : undefined;

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

  if (effectiveType === undefined || !typeMap[effectiveType]) {
    console.log(
      `Unrecognized option type: ${JSON.stringify(optionType)}, defaulting to string`
    );
  }

  return effectiveType !== undefined ? typeMap[effectiveType] || "string" : "string";
}

function inspectCommandStructure(cmd: CommandShape, prefix: string): void {
  try {
    const hasFunctions = typeof cmd.execute === "function";
    const hasSubcommands = !!(cmd.subcommands && Object.keys(cmd.subcommands).length > 0);
    const dataType = cmd.data
      ? typeof cmd.data === "function"
        ? "function"
        : "object"
      : "none";

    console.log(
      `[INFO] ${prefix} structure: execute=${hasFunctions}, subcommands=${hasSubcommands}, data=${dataType}`
    );
  } catch (error) {
    console.error(`Error inspecting ${prefix}:`, error);
  }
}

function resolveOptions(target: CommandShape | { data?: CommandShape["data"]; options?: CommandOption[] }): CommandOption[] {
  if (target.data && typeof target.data !== "function" && Array.isArray(target.data.options)) {
    return target.data.options;
  }

  if (Array.isArray(target.options)) {
    return target.options;
  }

  if (target.data && typeof target.data === "function") {
    try {
      const builtData = target.data();
      if (Array.isArray(builtData.options)) {
        return builtData.options;
      }
    } catch (error) {
      const typedError = error as Error;
      console.error(`Error calling data function: ${typedError.message}`);
    }
  }

  if (target.data && typeof target.data !== "function" && typeof target.data.toJSON === "function") {
    try {
      const jsonData = target.data.toJSON();
      if (Array.isArray(jsonData.options)) {
        return jsonData.options;
      }
    } catch (error) {
      const typedError = error as Error;
      console.error(`Error calling data.toJSON: ${typedError.message}`);
    }
  }

  return [];
}

function buildParameterSchema(option: CommandOption): ToolParameterSchema {
  let paramDesc = option.description || "";

  if (option.type === 6 || option.type === "USER" || option.name === "user") {
    paramDesc += " (Provide a user mention, user ID, or username)";
  } else if (option.type === 7 || option.type === "CHANNEL") {
    paramDesc += " (Provide a channel mention or channel name)";
  } else if (option.type === 8 || option.type === "ROLE") {
    paramDesc += " (Provide a role mention or role name)";
  }

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
    if (option.minValue !== undefined || option.min_value !== undefined) {
      rangeText += `Min: ${option.minValue !== undefined ? option.minValue : option.min_value}`;
      if (option.maxValue !== undefined || option.max_value !== undefined) {
        rangeText += ", ";
      }
    }
    if (option.maxValue !== undefined || option.max_value !== undefined) {
      rangeText += `Max: ${option.maxValue !== undefined ? option.maxValue : option.max_value}`;
    }
    rangeText += ")";
    paramDesc += rangeText;
  }

  if (option.choices && option.choices.length > 0) {
    paramDesc += ` (Choices: ${option.choices
      .map((choice) => `\`${choice.name}\` (\`${choice.value}\`)`)
      .join(", ")})`;
  }

  return {
    type: getParameterType(option.type),
    description: paramDesc,
    ...(option.choices && {
      enum: option.choices.map((choice) => choice.value),
    }),
  };
}

function generateToolsFromCommands(client: ClientWithCommands): ToolDefinition[] {
  console.log("[INFO] Scanning commands to build reference for AI guidance...");

  return Array.from(client.commands.values())
    .filter((command) => {
      if (!command.data) {
        return false;
      }

      if (typeof command.data === "function") {
        const builtData = command.data();
        return builtData.ai !== false;
      }

      return command.data.ai !== false;
    })
    .flatMap((command) => {
      const commandData =
        typeof command.data === "function" ? command.data() : command.data;

      if (!commandData) {
        return [];
      }

      console.log(`[INFO] Processing command: ${commandData.name}`);
      inspectCommandStructure(command, `Command ${commandData.name}`);

      const commandDefinitions: ToolDefinition[] = [];

      if (command.subcommands) {
        console.log(
          `[INFO] Command ${commandData.name} has subcommands:`,
          Object.keys(command.subcommands)
        );

        Object.entries(command.subcommands).forEach(([subcommandName, subcommand]) => {
          console.log(
            `[INFO] Processing subcommand: ${commandData.name}_${subcommandName}`
          );

          inspectCommandStructure(subcommand, `Subcommand ${subcommandName}`);

          const parameters: Record<string, ToolParameterSchema> = {};
          const required: string[] = [];
          const options = resolveOptions(subcommand);

          if (options.length > 0) {
            console.log(
              `[INFO] Found ${options.length} options for ${commandData.name}_${subcommandName}`
            );
          }

          console.log(`[INFO] Subcommand ${subcommandName} data:`, subcommand.data);

          options.forEach((option) => {
            parameters[option.name] = buildParameterSchema(option);
            if (option.required) {
              required.push(option.name);
            }
          });

          console.log(
            `[INFO] Generated properties for ${commandData.name}_${subcommandName}:`,
            parameters
          );
          console.log(
            `[INFO] Required params for ${commandData.name}_${subcommandName}:`,
            required
          );

          const subcommandData =
            typeof subcommand.data === "function" ? subcommand.data() : subcommand.data;

          const commandDef: ToolDefinition = {
            type: "function",
            function: {
              name: `${commandData.name}_${subcommandName}`,
              description:
                subcommandData?.description || `${subcommandName} subcommand of ${commandData.name}`,
              parameters: {
                type: "object",
                properties: parameters,
                required: required.length ? required : undefined,
              },
            },
          };

          console.log(`[INFO] Created definition for ${commandDef.function.name}`);
          commandDefinitions.push(commandDef);
        });
      }

      if (commandDefinitions.length === 0 && command.execute) {
        console.log(`[INFO] Creating definition for main command: ${commandData.name}`);

        const parameters: Record<string, ToolParameterSchema> = {};
        const required: string[] = [];
        const options = resolveOptions({ data: commandData, options: command.options }).filter(
          (option) => option.type !== 1
        );

        if (options.length > 0) {
          console.log(
            `[INFO] Found ${options.length} direct options in ${commandData.name}`
          );
        }

        options.forEach((option) => {
          parameters[option.name] = buildParameterSchema(option);
          if (option.required) {
            required.push(option.name);
          }
        });

        console.log(`[INFO] Generated properties for ${commandData.name}:`, parameters);
        console.log(`[INFO] Required params for ${commandData.name}:`, required);

        const commandDef: ToolDefinition = {
          type: "function",
          function: {
            name: commandData.name,
            description: commandData.description || `${commandData.name} command`,
            parameters: {
              type: "object",
              properties: parameters,
              required: required.length ? required : undefined,
            },
          },
        };

        console.log(`[INFO] Created definition for ${commandDef.function.name}`);
        commandDefinitions.push(commandDef);
      }

      return commandDefinitions;
    })
    .filter(Boolean);
}

export { getParameterType, generateToolsFromCommands };
