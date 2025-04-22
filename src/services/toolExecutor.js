import i18n from "../utils/newI18n.js";

// Helper functions for creating proxy and executing commands
function createAiProxy(message, subName, parsedArgs, effectiveLocale) {
  let commandMessage;
  let deferredPromise;
  let replyContent = null;
  let replyEmbeds = [];
  let replyAttachments = [];
  let replyComponents = [];
  let lastEditedReply = null;

  const proxy = {
    replied: false,
    deferred: false,
    ephemeral: false,
    commandName: null,
    options: {
      getSubcommand: () => subName || null,
      getString: (n) => parsedArgs[n]?.toString() || null,
      getInteger: (n) => {
        const v = parseInt(parsedArgs[n]);
        return isNaN(v) ? null : v;
      },
      getBoolean: (n) =>
        parsedArgs[n] === true ||
        parsedArgs[n]?.toString().toLowerCase() === "true",
      getNumber: (n) => {
        const v = parseFloat(parsedArgs[n]);
        return isNaN(v) ? null : v;
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
      getMember: (name) => {
        const value = parsedArgs[name];
        if (!value) return message.member;

        // Handle direct user IDs - if it's a valid snowflake
        if (/^\d{17,19}$/.test(value)) {
          return message.guild?.members.cache.get(value) || message.member;
        }

        // Handle mentions
        if (value.startsWith("<@") && value.endsWith(">")) {
          const userId = value.replace(/[<@!>]/g, "");
          return message.guild?.members.cache.get(userId) || message.member;
        }

        // Try to find by username as fallback
        const memberByName = message.guild?.members.cache.find(
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
          return message.guild?.channels.cache.get(value.replace(/[<#>]/g, ""));
        }
        return message.guild?.channels.cache.find(
          (c) => c.name.toLowerCase() === value.toLowerCase()
        );
      },
      getRole: (name) => {
        const value = parsedArgs[name];
        if (!value) return null;
        if (value.startsWith("<@&") && value.endsWith(">")) {
          return message.guild?.roles.cache.get(value.replace(/[<@&>]/g, ""));
        }
        return message.guild?.roles.cache.find(
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
            message.guild?.members.cache.get(id) ||
            message.guild?.roles.cache.get(id) ||
            message.client.users.cache.get(id)
          );
        }
        return null;
      },
    },
    user: message.author,
    member: message.member,
    guild: message.guild,
    guildId: message.guild?.id,
    channelId: message.channel?.id,
    channel: message.channel,
    client: message.client,
    locale: effectiveLocale,
    isChatInputCommand: () => true,
    isCommand: () => true,
    // Important properties for command context
    inGuild: () => !!message.guild,
    inCachedGuild: () => !!message.guild,
    inRawGuild: () => !!message.guild,
    // Improved reply function with support for embeds and files
    reply: async (options) => {
      if (proxy.replied || proxy.deferred) return proxy.followUp(options);

      replyContent = typeof options === "string" ? options : options.content;
      replyEmbeds = options.embeds || [];
      replyAttachments = options.files || [];
      replyComponents = options.components || [];

      const replyOptions = {
        content:
          typeof options === "string"
            ? options.substring(0, 2000)
            : options.content,
        embeds: options.embeds || [],
        files: options.files || [],
        components: options.components || [],
        allowedMentions: { repliedUser: false },
      };

      commandMessage = await message.reply(replyOptions);
      proxy.replied = true;
      return commandMessage;
    },
    // Improved editReply function with support for embeds and files
    editReply: async (options) => {
      if (!proxy.replied && !proxy.deferred) return proxy.reply(options);

      replyContent = typeof options === "string" ? options : options.content;
      replyEmbeds = options.embeds || replyEmbeds;
      replyAttachments = options.files || replyAttachments;
      replyComponents = options.components || replyComponents;

      const editOptions = {
        content:
          typeof options === "string"
            ? options.substring(0, 2000)
            : options.content,
        embeds: options.embeds || [],
        files: options.files || [],
        components: options.components || [],
      };

      lastEditedReply = await commandMessage?.edit(editOptions);
      return lastEditedReply;
    },
    // Improved deferReply to properly track state
    deferReply: async (options = {}) => {
      if (proxy.replied) return;

      proxy.deferred = true;
      // Instead of actually deferring (which we can't do with messages), we'll just
      // create a placeholder message that can be edited later
      const deferOptions = {
        content: "⏳ Processing...",
        allowedMentions: { repliedUser: false },
      };

      commandMessage = await message.reply(deferOptions);
      return commandMessage;
    },
    followUp: async (options) => {
      const followUpOptions =
        typeof options === "string" ? { content: options } : options;

      return message.channel.send(followUpOptions);
    },
    deleteReply: async () => commandMessage?.delete().catch(() => {}),
    fetchReply: async () => commandMessage,
    // Add method to retrieve final reply content and media
    getFinalReplyContent: () => {
      return {
        content: replyContent,
        embeds: replyEmbeds,
        attachments: replyAttachments,
        components: replyComponents,
        message: lastEditedReply || commandMessage,
      };
    },
  };
  return proxy;
}

async function executeCommand(target, aiProxy, effectiveLocale) {
  try {
    const response = await target.execute(aiProxy, i18n);

    // If the command directly replied by itself
    if (aiProxy.replied || aiProxy.deferred) {
      const replyData = aiProxy.getFinalReplyContent();
      // Return the full reply content
      return {
        success: true,
        response: null,
        commandReplied: true,
        replyContent: replyData.content,
        replyEmbeds: replyData.embeds,
        replyAttachments: replyData.attachments,
        replyComponents: replyData.components,
        replyMessage: replyData.message,
        hasComponents: replyData.components && replyData.components.length > 0,
      };
    }

    // If the command returned a value but didn't reply directly
    if (response != null) {
      return { success: true, response, commandReplied: false };
    }

    return {
      success: true,
      response: i18n.__(
        "events.ai.buttons.toolExec.successGeneric",
        effectiveLocale
      ),
      commandReplied: false,
    };
  } catch (err) {
    console.error("Error executing command:", err);
    const msg = err.message.includes("Missing Permissions")
      ? i18n.__("events.ai.toolExec.missingPermissions", effectiveLocale)
      : i18n.__(
          "events.ai.buttons.toolExec.errorGeneric",
          { error: err.message },
          effectiveLocale
        );
    return { success: false, response: msg, commandReplied: false };
  }
}

// Execute a single AI tool call by proxying to your Discord commands
export async function executeToolCall(toolCall, message, locale) {
  console.log(`Executing tool call:`, JSON.stringify(toolCall, null, 2));

  const { name, arguments: args } = toolCall.function;

  // Try to find command directly first without splitting
  let command = message.client.commands.get(name);
  let subName = null;

  // If not found, try the split approach as fallback
  if (!command) {
    const [commandName, ...subParts] = name.split("_");
    subName = subParts.join("_");
    command = message.client.commands.get(commandName);
    console.log(
      `Command not found directly. Trying split: command=${commandName}, subcommand=${
        subName || "none"
      }`
    );
  } else {
    console.log(`Command found directly: ${name}`);
  }

  // Determine locale
  let effectiveLocale = locale || message.guild?.preferredLocale || "en";
  effectiveLocale = effectiveLocale.split("-")[0].toLowerCase();
  if (!["en", "ru", "uk"].includes(effectiveLocale)) effectiveLocale = "en";
  i18n.setLocale(effectiveLocale);

  // Parse arguments
  let parsedArgs = {};
  if (typeof args === "string") {
    console.log(`Tool arguments provided as string: ${args}`);
    try {
      parsedArgs = JSON.parse(args);
      console.log(`Successfully parsed arguments:`, parsedArgs);
    } catch (e) {
      console.error(`Failed to parse tool arguments:`, e);
      return {
        success: false,
        response: i18n.__(
          "events.ai.toolExec.parseError",
          { command: name, args },
          effectiveLocale
        ),
        commandReplied: false,
      };
    }
  } else if (typeof args === "object" && args !== null) {
    console.log(`Tool arguments provided as object:`, args);
    parsedArgs = args;
  } else {
    console.log(`Tool arguments has unexpected type: ${typeof args}`);
  }

  // Find the command
  if (!command) {
    console.error(`Command not found: ${name}`);
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.commandNotFound",
        { command: name },
        effectiveLocale
      ),
      commandReplied: false,
    };
  }

  // Identify target execute function
  const target = subName ? command.subcommands?.[subName] : command;
  if (!target) {
    console.error(`Target not found: ${subName ? `${name}_${subName}` : name}`);
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.commandNotFound",
        { command: name },
        effectiveLocale
      ),
      commandReplied: false,
    };
  }

  // Properly handle data that could be a function
  let dataObj;
  if (typeof target.data === "function") {
    try {
      dataObj = target.data();
      console.log("Executed data function, got:", dataObj);
    } catch (err) {
      console.error("Error executing data function:", err);
      dataObj = {};
    }
  } else if (target.data?.toJSON) {
    dataObj = target.data.toJSON();
  } else {
    dataObj = target.data;
  }
  console.log(`Command data:`, dataObj);

  const options = (dataObj?.options || []).filter(
    (o) => o.type !== 1 && o.type !== 2
  );
  console.log(
    `Command options (excluding subcommands):`,
    options.map((o) => ({ name: o.name, type: o.type, required: !!o.required }))
  );

  // If AI passed parameters but command doesn't declare them, don't remove them
  // This handles commands not properly defining their options
  if (options.length === 0 && Object.keys(parsedArgs).length > 0) {
    console.log(
      `Command doesn't declare options but AI provided parameters. Using AI parameters directly.`
    );
    console.log(`Executing command with parameters:`, parsedArgs);
    const aiProxy = createAiProxy(
      message,
      subName,
      parsedArgs,
      effectiveLocale
    );
    return await executeCommand(target, aiProxy, effectiveLocale);
  }

  const required = options.filter((o) => o.required).map((o) => o.name);
  console.log(`Required parameters: ${required.join(", ")}`);

  // Remove unexpected params
  const valid = options.map((o) => o.name);
  const unexpectedParams = Object.keys(parsedArgs).filter(
    (k) => !valid.includes(k)
  );
  if (unexpectedParams.length) {
    console.warn(
      `Removing unexpected parameters: ${unexpectedParams.join(", ")}`
    );
  }

  Object.keys(parsedArgs).forEach((k) => {
    if (!valid.includes(k)) delete parsedArgs[k];
  });

  // Check missing
  const missing = required.filter((p) => !(p in parsedArgs));
  if (missing.length) {
    console.error(`Missing required parameters: ${missing.join(", ")}`);
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.missingParams",
        {
          command: name,
          missing: missing.join(","),
          required: required.join(","),
        },
        effectiveLocale
      ),
      commandReplied: false,
    };
  }

  console.log(`Final parameters after validation:`, parsedArgs);

  // Always send execution message for all commands
  let statusMessage = null;
  const commandDesc = dataObj?.description || name;
  let statusText = `🔄 Executing ${commandDesc}...`;

  // Include prompt in the status message if available
  if (parsedArgs.prompt) {
    // Truncate the prompt if it's too long
    const truncatedPrompt =
      parsedArgs.prompt.length > 50
        ? parsedArgs.prompt.substring(0, 47) + "..."
        : parsedArgs.prompt;
    statusText += ` (${truncatedPrompt})`;
  }

  try {
    statusMessage = await message.channel.send(statusText);
    console.log(
      `Sent status message for command execution: ${statusMessage.id}`
    );
  } catch (err) {
    console.error("Failed to send command execution status message:", err);
  }

  // Set commandName in proxy for better tracking
  const aiProxy = createAiProxy(message, subName, parsedArgs, effectiveLocale);
  aiProxy.commandName = subName
    ? `${command.data.name}_${subName}`
    : command.data.name;

  // Execute command
  const result = await executeCommand(target, aiProxy, effectiveLocale);

  // Clean up status message if command replied directly
  if (statusMessage && result.commandReplied) {
    try {
      await statusMessage.delete().catch(() => {});
      console.log(`Deleted status message after command completion`);

      // If the command reply has embeds, attachments, or components, don't force a text response
      if (
        result.replyEmbeds?.length ||
        result.replyAttachments?.length ||
        result.hasComponents
      ) {
        return {
          success: true,
          response: null,
          commandReplied: true,
          visualResponse: true,
          hasComponents: result.hasComponents,
        };
      }
    } catch (err) {
      console.error("Failed to delete status message:", err);
    }
  } else if (statusMessage && !result.commandReplied) {
    // Update status message with result if command didn't reply directly
    try {
      const successIcon = result.success ? "✅" : "❌";
      await statusMessage.edit(
        `${successIcon} ${commandDesc}: ${result.response || "Completed"}`
      );
      console.log(`Updated status message with command result`);
    } catch (err) {
      console.error("Failed to update status message:", err);
    }
  }

  return result;
}
