import i18n from "../utils/newI18n.js";
import { MessageFlags } from "discord.js";

// Helper functions for creating proxy and executing commands
function createAiProxy(message, subName, parsedArgs, effectiveLocale) {
  // Internal state to store the intended reply
  let finalReplyState = {
    content: null,
    embeds: [],
    files: [],
    components: [],
    flags: null,
  };
  let isV2ReplyState = false; // Track V2 state

  const proxy = {
    replied: false, // Indicates if reply() or editReply() was called
    deferred: false, // Indicates if deferReply() was called
    ephemeral: false, // Ephemeral not really possible with message replies
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
        if (/^\d{17,19}$/.test(value)) {
          return message.client.users.cache.get(value);
        }
        if (value.startsWith("<@") && value.endsWith(">")) {
          return message.client.users.cache.get(value.replace(/[<@!>]/g, ""));
        }
        return message.client.users.cache.find(
          (u) =>
            u.username.toLowerCase() === value.toLowerCase().replace("@", "")
        );
      },
      getMember: (name) => {
        const value = parsedArgs[name];
        if (!value) return message.member;
        if (/^\d{17,19}$/.test(value)) {
          return message.guild?.members.cache.get(value) || message.member;
        }
        if (value.startsWith("<@") && value.endsWith(">")) {
          const userId = value.replace(/[<@!>]/g, "");
          return message.guild?.members.cache.get(userId) || message.member;
        }
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
    inGuild: () => !!message.guild,
    inCachedGuild: () => !!message.guild,
    inRawGuild: () => !!message.guild,
    deferReply: async (options = {}) => {
      if (proxy.replied) return Promise.resolve(); // Already replied
      proxy.deferred = true;
      proxy.ephemeral = options.ephemeral || false;
      console.log("aiProxy: deferReply called.");
      // We resolve immediately as no message is sent here
      return Promise.resolve();
    },
    reply: async (options) => {
      // If deferred, just store the state and mark as replied.
      if (proxy.deferred) {
        console.log("aiProxy: reply called while deferred. Storing state.");
        finalReplyState = {
          content: typeof options === "string" ? options : options.content,
          embeds: options.embeds || [],
          files: options.files || [],
          components: options.components || [],
          flags: options.flags, // Store the flags
        };
        isV2ReplyState = finalReplyState.flags === MessageFlags.IsComponentsV2;
        proxy.replied = true; // Mark that a reply was intended
        return Promise.resolve(); // Resolve as no message is sent yet
      }

      // --- Original immediate reply logic (less likely path now) ---
      console.log(
        "aiProxy: reply called directly (not deferred). Sending message."
      );
      if (proxy.replied) return proxy.followUp(options); // Fallback to followUp if somehow called twice

      const replyOptions = {
        content: typeof options === "string" ? options : options.content,
        embeds: options.embeds || [],
        files: options.files || [],
        components: options.components || [],
        allowedMentions: { repliedUser: false },
        flags: options.flags,
      };
      isV2ReplyState = options.flags === MessageFlags.IsComponentsV2;
      if (isV2ReplyState) delete replyOptions.content; // Remove content for V2

      try {
        const commandMessage = await message.reply(replyOptions);
        proxy.replied = true;
        // Store the state even for direct replies
        finalReplyState = { ...replyOptions };
        return commandMessage;
      } catch (error) {
        console.error("aiProxy: Error during direct reply:", error);
        throw error; // Re-throw
      }
    },
    editReply: async (options) => {
      // If deferred, just update the stored state.
      if (proxy.deferred) {
        console.log(
          "aiProxy: editReply called while deferred. Updating stored state."
        );
        finalReplyState = {
          content: typeof options === "string" ? options : options.content,
          embeds: options.embeds || [],
          files: options.files || [],
          components: options.components || [],
          flags: options.flags, // Store the flags
        };
        isV2ReplyState = finalReplyState.flags === MessageFlags.IsComponentsV2;
        proxy.replied = true; // Mark that a reply was intended
        return Promise.resolve(); // Resolve as no message is sent yet
      }

      // --- Original edit logic (only if reply was called directly before) ---
      console.log("aiProxy: editReply called (not deferred). Attempting edit.");
      if (!proxy.replied) {
        console.warn(
          "aiProxy: editReply called before reply. Attempting direct reply."
        );
        // If edit is called before reply somehow, treat it as a reply
        return proxy.reply(options);
      }

      const editOptions = {
        content: typeof options === "string" ? options : options.content,
        embeds: options.embeds || [],
        files: options.files || [],
        components: options.components || [],
        flags: options.flags,
      };
      isV2ReplyState = options.flags === MessageFlags.IsComponentsV2;
      if (isV2ReplyState) delete editOptions.content; // Remove content for V2

      // We need the message object from the *direct* reply here, which isn't stored
      // This path is problematic and less likely with the new flow.
      // For now, we'll assume this path won't be hit often.
      // A proper fix would require storing the message object from direct replies.
      console.warn(
        "aiProxy: editReply on a direct (non-deferred) reply is not fully supported."
      );
      // Store the state anyway
      finalReplyState = { ...editOptions };
      return Promise.resolve(); // Cannot reliably edit without message object
    },
    followUp: async (options) => {
      console.log("aiProxy: followUp called.");
      const followUpOptions =
        typeof options === "string" ? { content: options } : options;
      // Ensure content is removed if V2 flag is present
      if (followUpOptions.flags === MessageFlags.IsComponentsV2) {
        delete followUpOptions.content;
      }
      return message.channel.send(followUpOptions);
    },
    deleteReply: async () => {
      console.warn(
        "aiProxy: deleteReply is not supported in the new deferred flow."
      );
      return Promise.resolve();
    },
    fetchReply: async () => {
      console.warn(
        "aiProxy: fetchReply is not supported in the new deferred flow."
      );
      return Promise.resolve(null);
    },
    getFinalReplyContent: () => {
      console.log(
        "aiProxy: getFinalReplyContent called. Returning stored state:",
        finalReplyState
      );
      return {
        ...finalReplyState,
        wasRepliedOrDeferred: proxy.replied || proxy.deferred, // Indicate if *any* reply action was taken
        isV2: isV2ReplyState, // Return the tracked V2 state
      };
    },
  };
  return proxy;
}

async function executeCommand(target, aiProxy, effectiveLocale) {
  try {
    // Execute the command. It will use the proxy's methods which now store state.
    const response = await target.execute(aiProxy, i18n);

    // Check if the command *intended* to reply (called proxy.reply/editReply/deferReply)
    const intendedReply = aiProxy.replied || aiProxy.deferred;

    // If the command returned a value AND didn't intend to reply via proxy
    if (response != null && !intendedReply) {
      return { success: true, response: response, commandIntendedReply: false };
    }

    // If the command intended to reply OR returned nothing (implicit success)
    return {
      success: true,
      response: intendedReply
        ? null
        : i18n.__("events.ai.buttons.toolExec.successGeneric", effectiveLocale), // Provide generic success only if no reply was intended *and* no response value given
      commandIntendedReply: intendedReply,
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
    // Indicate no reply was successfully prepared by the command on error
    return { success: false, response: msg, commandIntendedReply: false };
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
        commandReplied: false, // No reply sent
        visualResponse: false,
        isV2Reply: false,
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
      commandReplied: false, // No reply sent
      visualResponse: false,
      isV2Reply: false,
    };
  }

  // Identify target execute function
  const target = subName ? command.subcommands?.[subName] : command;
  if (!target || !target.execute) {
    // Check for execute method
    console.error(
      `Target execute function not found: ${
        subName ? `${commandName}_${subName}` : commandName
      }`
    );
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.commandNotFound", // Or a more specific error
        { command: name },
        effectiveLocale
      ),
      commandReplied: false, // No reply sent
      visualResponse: false,
      isV2Reply: false,
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
    // No validation needed here if no options are defined
  } else {
    // Remove unexpected params if options are defined
    const valid = options.map((o) => o.name);
    const unexpectedParams = Object.keys(parsedArgs).filter(
      (k) => !valid.includes(k)
    );
    if (unexpectedParams.length) {
      console.warn(
        `Removing unexpected parameters: ${unexpectedParams.join(", ")}`
      );
      Object.keys(parsedArgs).forEach((k) => {
        if (!valid.includes(k)) delete parsedArgs[k];
      });
    }

    // Check missing required params
    const required = options.filter((o) => o.required).map((o) => o.name);
    console.log(`Required parameters: ${required.join(", ")}`);
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
        visualResponse: false,
        isV2Reply: false,
      };
    }
  }

  console.log(`Final parameters after validation:`, parsedArgs);

  // Create the proxy
  const aiProxy = createAiProxy(message, subName, parsedArgs, effectiveLocale);
  aiProxy.commandName = subName
    ? `${command.data.name}_${subName}`
    : command.data.name;

  // Execute the command - this populates the proxy's internal state
  const execResult = await executeCommand(target, aiProxy, effectiveLocale);

  // Now, get the final intended reply state from the proxy
  const finalReplyData = aiProxy.getFinalReplyContent();

  let finalMessage = null;
  let sentReply = false;

  // Check if the command intended to reply and prepared some content/visuals
  if (
    execResult.success &&
    finalReplyData.wasRepliedOrDeferred &&
    (finalReplyData.content ||
      finalReplyData.embeds?.length ||
      finalReplyData.files?.length ||
      finalReplyData.components?.length)
  ) {
    // Construct the final payload to send
    const sendOptions = {
      content: finalReplyData.content,
      embeds: finalReplyData.embeds,
      files: finalReplyData.files,
      components: finalReplyData.components,
      allowedMentions: { repliedUser: false }, // Don't ping original user
    };

    if (finalReplyData.isV2) {
      sendOptions.flags = MessageFlags.IsComponentsV2;
      delete sendOptions.content; // Ensure content is removed for V2
    }

    try {
      console.log("Sending final command reply:", sendOptions);
      finalMessage = await message.channel.send(sendOptions);
      sentReply = true;
    } catch (sendError) {
      console.error("Error sending final command reply:", sendError);
      // If sending failed, fall back to sending the error text
      execResult.success = false;
      execResult.response = i18n.__(
        "events.ai.buttons.toolExec.errorGeneric",
        { error: sendError.message },
        effectiveLocale
      );
    }
  }

  // If execution failed OR command didn't intend to reply but returned a text response
  if (!execResult.success || (!sentReply && execResult.response)) {
    try {
      console.log("Sending fallback/error response:", execResult.response);
      await message.channel.send(execResult.response);
    } catch (fallbackError) {
      console.error("Error sending fallback/error message:", fallbackError);
    }
  }

  // Determine the final return value for processAiRequest
  const visualResponse = !!(
    finalReplyData.embeds?.length ||
    finalReplyData.files?.length ||
    finalReplyData.components?.length
  );

  return {
    success: execResult.success,
    // Return null response if we sent a visual reply, otherwise return error/status text
    response: execResult.success && sentReply ? null : execResult.response,
    commandReplied: sentReply, // Indicate if a reply was actually sent
    visualResponse: visualResponse && sentReply, // Visual only if successfully sent
    isV2Reply: finalReplyData.isV2 && sentReply, // V2 only if successfully sent
  };
}
