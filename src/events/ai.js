import { Events } from "discord.js";
import { translate } from "bing-translate-api";

const MODEL = "llama-3.1-70b-versatile";
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
    const result = await translate(text, null, targetLang);
    return result.translation;
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

      const tools = generateToolsFromCommands(message.client);
      console.log(tools);
      const response = await message.client.groq.chat.completions.create({
        model: MODEL,
        messages: context[message.author.id],
        tools: tools,
        tool_choice: "auto",
      });

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
        await processingMessage.edit(translatedResponse);
        context[message.author.id].push({
          role: "assistant",
          content: aiContent.trim(),
        });
      } else if (commandExecuted) {
        /*await processingMessage.edit("Command executed successfully.");*/
      } else {
        /*await processingMessage.edit("No valid commands were executed.");*/
      }
    } catch (error) {
      console.error("Error processing request:", error);
      await processingMessage.edit(
        "An error occurred while processing your request."
      );
    }
  },
};
