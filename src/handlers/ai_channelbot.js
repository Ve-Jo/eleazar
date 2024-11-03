import { Events } from "discord.js";
import { translate } from "bing-translate-api";

let models = {
  text: ["llama-3.2-90b-text-preview", "llama-3.1-70b-versatile"],
};

const MAX_CONTEXT_LENGTH = 10;
const INITIAL_CONTEXT = {
  role: "system",
  content: `You are a bot called "ELEAZAR" that can chat with people. You'll be given a chat window (in the user role) and also you're already maked tool executions (in assistant), use them both as contexts. You can send a reply to the any of the user messages, send a new message in the channel, react to a any message. Only use tools when replying, at least one. Or if there's no your need to answer (or if there's no ask for you) you can skip until the next message will appear on the chat window. Or skip until the specific time. All youre previously executed tools will be in the assistant context as well.`,
};

let included_channels = ["1301850888205369425"];
let context = {};

let tools = [
  {
    type: "function",
    function: {
      name: "reply_to_message",
      description:
        "Reply to a specific message in the channel after an optional delay",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "The ID of the message to reply to",
            enum: [],
          },
          content: {
            type: "array",
            items: { type: "string" },
            description:
              "An array of message contents to send as separate messages",
          },
          delay: {
            type: "number",
            description: "Delay in milliseconds before replying (optional)",
          },
        },
        required: ["message_id", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "just_send_in_channel",
      description:
        "Send messages in the channel without replying to any specific message after an optional delay",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "array",
            items: { type: "string" },
            description:
              "An array of message contents to send as separate messages",
          },
          delay: {
            type: "number",
            description: "Delay in milliseconds before sending (optional)",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "react_on_message",
      description:
        "Add reactions to a specific message after an optional delay. Check if the reactions already exist before adding.",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "The ID of the message to react to",
            enum: [], // This will be dynamically populated
          },
          emojis: {
            type: "array",
            items: {
              type: "string",
              pattern:
                "^[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]$",
            },
            description:
              "An array of emojis to react with (only actual emoji characters are allowed)",
          },
          delay: {
            type: "number",
            description: "Delay in milliseconds before reacting (optional)",
          },
        },
        required: ["message_id", "emojis"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skip_untill_next_message",
      description: "Skip processing until the next message is received",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "skip_untill_cooldown",
      description:
        "Rerun the message processing after a specified cooldown period",
      parameters: {
        type: "object",
        properties: {
          cooldown: {
            type: "number",
            description: "Cooldown period in milliseconds before rerunning",
          },
        },
        required: ["cooldown"],
      },
    },
  },
];

export default async function AiChannelBot(client) {
  if (!context[included_channels[0]]) {
    for (let channel of included_channels) {
      let channelObj = client.channels.cache.get(channel);
      if (!channelObj) {
        console.error(`Channel ${channel} not found`);
        continue;
      }
      let messages = await channelObj.messages.fetch({
        limit: MAX_CONTEXT_LENGTH - 1,
      });
      context[channel] = [
        INITIAL_CONTEXT,
        {
          role: "assistant",
          content: messages
            .map((message) =>
              message.author.bot
                ? `Reactions: ${getReactionsString(message)}`
                : ""
            )
            .filter(Boolean)
            .join("\n"),
        },
        {
          role: "user",
          content: messages
            .map(
              (message) =>
                `[${message.id}] ${message.createdAt.toISOString()} @${
                  message.author.username
                } > ${formatMessageContent(message, client)}\n`
            )
            .join("\n"),
        },
      ].filter((msg) => msg.content !== "");
      if (messages.size > 0) {
        let lastMessage = messages.last();
        context[channel].pop();
        await processMessage(client, lastMessage);
      }
    }
    console.log("AI Channel Bot initialized");
    console.log(JSON.stringify(context, null, 2));
  }

  client.on(Events.MessageCreate, async (message) => {
    await processMessage(client, message);
  });
}

async function processMessage(client, message) {
  if (!message || !message.channel || !message.channel.id) {
    console.error("Invalid message object:", message);
    return;
  }
  if (!included_channels.includes(message.channel.id)) return;
  if (message.author.bot) return;

  const userContent = `[${message.id}] ${message.createdAt.toISOString()} @${
    message.author.username
  } > ${formatMessageContent(message, client)}`;

  if (!context[message.channel.id]) {
    context[message.channel.id] = [INITIAL_CONTEXT];
  }

  if (
    context[message.channel.id].length > 1 &&
    context[message.channel.id][context[message.channel.id].length - 1].role ===
      "user"
  ) {
    context[message.channel.id][
      context[message.channel.id].length - 1
    ].content += `\n${userContent}`;
  } else {
    context[message.channel.id].push({
      role: "user",
      content: userContent,
    });
  }

  if (
    context[message.channel.id].length === 1 ||
    context[message.channel.id][1].role !== "assistant"
  ) {
    context[message.channel.id].splice(1, 0, {
      role: "assistant",
      content: "",
    });
  }

  context[message.channel.id] = context[message.channel.id].slice(
    0,
    MAX_CONTEXT_LENGTH
  );

  // Update the enum for message_id in tools
  const messageIds = context[message.channel.id]
    .filter((msg) => msg.role === "user")
    .flatMap((msg) => msg.content.split("\n"))
    .map((line) => line.split("]")[0].slice(1));
  tools.forEach((tool) => {
    if (tool.function.parameters.properties.message_id) {
      tool.function.parameters.properties.message_id.enum = messageIds;
    }
  });

  // Log the updated tools
  console.log("Updated tools:");
  console.log(JSON.stringify(tools, null, 2));

  console.log("Context");
  console.log(JSON.stringify(context[message.channel.id], null, 2));

  let response = await message.client.groq.chat.completions.create({
    model: models.text[0],
    messages: context[message.channel.id],
    tools,
    tool_choice: "auto",
  });

  const aiResponse = response.choices[0].message;
  if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
    for (const toolCall of aiResponse.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`Executing AI tool: ${toolName}`);
      console.log("Tool arguments:", JSON.stringify(toolArgs, null, 2));

      const executeToolWithDelay = async (toolFunction) => {
        if (toolArgs.delay) {
          console.log(
            `Waiting for ${toolArgs.delay}ms before executing the tool`
          );
          await message.channel.sendTyping();
          const startTime = Date.now();
          while (Date.now() - startTime < toolArgs.delay) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            await message.channel.sendTyping();
          }
        }
        await toolFunction();
        return true;
      };

      switch (toolName) {
        case "reply_to_message":
          if (
            await executeToolWithDelay(async () => {
              console.log(`Replying to message ${toolArgs.message_id}`);
              const replyMessage = await message.channel.messages.fetch(
                toolArgs.message_id
              );
              for (const content of toolArgs.content) {
                await replyMessage.reply(content);
              }
            })
          ) {
            context[message.channel.id][1].content += `\n[REPLY to ${
              toolArgs.message_id
            }] ${toolArgs.content.join(" | ")} | Reactions: None\n`;
          }
          break;
        case "just_send_in_channel":
          if (
            await executeToolWithDelay(async () => {
              console.log("Sending messages in channel");
              for (const content of toolArgs.content) {
                const sentMessage = await message.channel.send(content);
                context[message.channel.id][1].content += `\n[${
                  sentMessage.id
                }] ${sentMessage.createdAt.toISOString()} @${
                  client.user.username
                } > ${content} | Reactions: None\n`;
              }
            })
          ) {
            // Context updates are now handled inside the executeToolWithDelay function
          }
          break;
        case "react_on_message":
          if (
            await executeToolWithDelay(async () => {
              console.log(
                `Reacting to message ${
                  toolArgs.message_id
                } with emojis ${toolArgs.emojis.join(", ")}`
              );
              const reactMessage = await message.channel.messages.fetch(
                toolArgs.message_id
              );
              for (const emoji of toolArgs.emojis) {
                if (
                  /^[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]$/u.test(
                    emoji
                  )
                ) {
                  const existingReaction =
                    reactMessage.reactions.cache.get(emoji);
                  if (!existingReaction) {
                    await reactMessage.react(emoji);
                    console.log(
                      `Added reaction ${emoji} to message ${toolArgs.message_id}`
                    );
                  } else {
                    console.log(
                      `Reaction ${emoji} already exists on message ${toolArgs.message_id}`
                    );
                  }
                } else {
                  console.log(`Invalid emoji: ${emoji}`);
                }
              }
              // Update the context with the new reaction information
              const updatedReactions = getReactionsString(reactMessage);
              context[message.channel.id][1].content = context[
                message.channel.id
              ][1].content
                .split("\n")
                .map((line) => {
                  if (line.startsWith(`[${toolArgs.message_id}]`)) {
                    return line.replace(
                      /\| Reactions:.*/,
                      `| Reactions: ${updatedReactions}`
                    );
                  }
                  return line;
                })
                .join("\n");
            })
          ) {
            context[message.channel.id][1].content += `\n[REACTION to ${
              toolArgs.message_id
            }] Added ${toolArgs.emojis.join(", ")}\n`;
          }
          break;
        case "skip_untill_next_message":
          console.log("Skipping until next message");
          // Do nothing, wait for the next message
          break;
        case "skip_untill_cooldown":
          console.log(`Skipping for ${toolArgs.cooldown}ms before rerunning`);
          setTimeout(() => processMessage(client, message), toolArgs.cooldown);
          break;
        default:
          console.log(`Unknown tool: ${toolName}`);
      }
    }
  } else if (aiResponse.content) {
    await message.channel.sendTyping();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sentMessage = await message.channel.send(aiResponse.content);
    context[message.channel.id][1].content += `\n[${
      sentMessage.id
    }] ${sentMessage.createdAt.toISOString()} @${client.user.username} > ${
      aiResponse.content
    } | Reactions: None`;
  }

  context[message.channel.id] = context[message.channel.id].slice(
    0,
    MAX_CONTEXT_LENGTH
  );
}

function getReactionsString(message) {
  if (message.reactions.cache.size === 0) {
    return "None";
  }
  return message.reactions.cache
    .map((reaction) => `${reaction.emoji.name}:${reaction.count}`)
    .join(", ");
}

function formatMessageContent(message, client) {
  let content = message.content;
  // Replace all user mentions with their usernames
  const userMentionRegex = /<@!?(\d+)>/g;
  content = content.replace(userMentionRegex, (match, userId) => {
    const user = client.users.cache.get(userId);
    return user ? `@${user.username}` : match;
  });
  // Replace all role mentions with their names
  const roleMentionRegex = /<@&(\d+)>/g;
  content = content.replace(roleMentionRegex, (match, roleId) => {
    const role = message.guild.roles.cache.get(roleId);
    return role ? `@${role.name}` : match;
  });
  // Replace all channel mentions with their names
  const channelMentionRegex = /<#(\d+)>/g;
  content = content.replace(channelMentionRegex, (match, channelId) => {
    const channel = client.channels.cache.get(channelId);
    return channel ? `#${channel.name}` : match;
  });
  return content;
}
