import i18n from "../utils/newI18n.js";
import {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ContainerBuilder,
} from "discord.js";

// Helper functions for creating proxy and executing commands
function createAiProxy(
  message,
  commandMessage, // Receive the deferred message object
  subName,
  parsedArgs,
  effectiveLocale
) {
  let isV2ReplyState = false; // Track V2 state internally (based on LAST edit)
  let initialReplySent = !!commandMessage; // Track if the initial reply/defer was sent (now based on passed message)

  const proxy = {
    _isAiProxy: true, // Add flag to identify proxy context
    replied: false, // User-facing replied state
    deferred: initialReplySent, // Deferred state is true if commandMessage exists
    ephemeral: false, // Will be set if needed during command execution
    withheldData: null, // Store withheld legacy data for V2 edits
    wasV2Edit: false, // Track if the last edit was a V2-only edit
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

    // Defer Reply: Now just sets flags, actual defer is outside.
    deferReply: async (options = {}) => {
      // If already replied/deferred (based on commandMessage existence), do nothing
      if (proxy.replied || proxy.deferred)
        return Promise.resolve(commandMessage);
      // Mark as deferred and set ephemeral if needed
      proxy.deferred = true;
      proxy.ephemeral = options.ephemeral || false;
      // No message sending here anymore
      console.log(`aiProxy: deferReply called (will be handled externally)`);
      return Promise.resolve(undefined); // Return undefined as message is handled externally
    },

    // reply: If deferred (commandMessage exists), edits the placeholder. Otherwise, sends a new reply.
    reply: async (options) => {
      // This logic handles editing the initial defer message
      if (!commandMessage) {
        console.error(
          "aiProxy: reply called but no initial commandMessage exists (deferral failed externally)."
        );
        throw new Error(
          "Cannot reply because the initial deferral message is missing."
        );
      }
      if (proxy.replied) {
        // If already replied, subsequent calls should probably be editReply, but let's warn and proceed
        console.warn("aiProxy: reply called after already replied. Editing...");
        return proxy.editReply(options);
      }

      console.log(
        `aiProxy: reply attempting to edit deferred message ${commandMessage?.id}`
      );
      proxy.replied = true;
      proxy.withheldData = null; // Reset withheld data
      proxy.wasV2Edit = false; // Reset V2 edit flag

      // Determine if incoming is V1 or V2
      const isIncomingV2 =
        (typeof options !== "string" &&
          options.flags === MessageFlags.IsComponentsV2) ||
        (typeof options !== "string" &&
          options.components?.[0] instanceof ContainerBuilder);
      isV2ReplyState = isIncomingV2; // Update state based on this edit

      const hasContent = typeof options === "string" || options.content;
      const hasEmbeds =
        typeof options !== "string" && options.embeds?.length > 0;
      const hasFiles = typeof options !== "string" && options.files?.length > 0;
      const hasLegacyFields = hasContent || hasEmbeds || hasFiles;

      let editOptions = {};
      let withheld = {};

      if (isIncomingV2 && hasLegacyFields) {
        console.log(
          "aiProxy: Detected V2 components with legacy fields. Separating edit."
        );
        proxy.wasV2Edit = true;
        // Edit with only V2 components
        editOptions = {
          components:
            typeof options !== "string" ? options.components || [] : [],
          flags: MessageFlags.IsComponentsV2,
          // Clear potentially conflicting fields
          content: undefined,
          embeds: undefined,
          files: undefined,
          attachments: [], // Ensure attachments are cleared explicitly for edits
        };
        // Withhold legacy fields
        if (hasContent)
          withheld.content =
            typeof options === "string" ? options : options.content;
        if (hasEmbeds) withheld.embeds = options.embeds;
        if (hasFiles) withheld.files = options.files;
        proxy.withheldData = Object.keys(withheld).length > 0 ? withheld : null;
        console.log("aiProxy: Withheld data:", proxy.withheldData);
      } else {
        // Normal V1 or V2-only edit
        editOptions = {
          content: typeof options === "string" ? options : options.content,
          embeds: typeof options !== "string" ? options.embeds || [] : [],
          files: typeof options !== "string" ? options.files || [] : [],
          components:
            typeof options !== "string" ? options.components || [] : [],
          flags: isIncomingV2 ? MessageFlags.IsComponentsV2 : undefined,
          attachments: [], // Ensure attachments are cleared explicitly for edits
          // allowedMentions is not valid for edits
        };
        // Clear conflicting fields if it's purely V2
        if (isIncomingV2) {
          editOptions.content = undefined;
          editOptions.embeds = undefined;
          editOptions.files = undefined;
        }
      }

      try {
        console.log(
          `aiProxy: Editing message ${commandMessage.id} with options:`,
          JSON.stringify(editOptions)
        );
        const editedMessage = await commandMessage.edit(editOptions);
        console.log(
          `aiProxy: reply successfully edited message ${commandMessage.id}`
        );
        return editedMessage;
      } catch (error) {
        console.error(
          `aiProxy: Error editing reply for message ${commandMessage.id}:`,
          error,
          "Edit options:",
          editOptions
        );
        proxy.replied = false; // Reset replied status on error
        proxy.wasV2Edit = false;
        proxy.withheldData = null;
        throw error;
      }
    },

    // editReply: Edits the message sent by deferReply or reply.
    editReply: async (options) => {
      if (!commandMessage) {
        console.error(
          "aiProxy: editReply called but no initial commandMessage exists (deferral failed externally)."
        );
        throw new Error(
          "Cannot edit reply because the initial deferral message is missing."
        );
      }
      if (!proxy.replied && !proxy.deferred) {
        // This case should ideally not happen if deferReply is called first,
        // but handle it defensively.
        console.warn(
          "aiProxy: editReply called before initial reply/defer. Attempting reply."
        );
        return proxy.reply(options); // Treat it as the first reply
      }

      console.log(
        `aiProxy: editReply attempting to edit message ${commandMessage.id}`
      );
      proxy.replied = true; // Mark as replied if not already
      proxy.withheldData = null; // Reset withheld data
      proxy.wasV2Edit = false; // Reset V2 edit flag

      // Determine if incoming is V1 or V2
      const isIncomingV2 =
        (typeof options !== "string" &&
          options.flags === MessageFlags.IsComponentsV2) ||
        (typeof options !== "string" &&
          options.components?.[0] instanceof ContainerBuilder);
      isV2ReplyState = isIncomingV2; // Update state based on this edit

      const hasContent = typeof options === "string" || options.content;
      const hasEmbeds =
        typeof options !== "string" && options.embeds?.length > 0;
      const hasFiles = typeof options !== "string" && options.files?.length > 0;
      const hasLegacyFields = hasContent || hasEmbeds || hasFiles;

      let editOptions = {};
      let withheld = {};

      if (isIncomingV2 && hasLegacyFields) {
        console.log(
          "aiProxy: Detected V2 components with legacy fields in editReply. Separating edit."
        );
        proxy.wasV2Edit = true;
        // Edit with only V2 components
        editOptions = {
          components:
            typeof options !== "string" ? options.components || [] : [],
          flags: MessageFlags.IsComponentsV2,
          // Clear potentially conflicting fields
          content: undefined,
          embeds: undefined,
          files: undefined,
          attachments: [], // Ensure attachments are cleared explicitly for edits
        };
        // Withhold legacy fields
        if (hasContent)
          withheld.content =
            typeof options === "string" ? options : options.content;
        if (hasEmbeds) withheld.embeds = options.embeds;
        if (hasFiles) withheld.files = options.files;
        proxy.withheldData = Object.keys(withheld).length > 0 ? withheld : null;
        console.log(
          "aiProxy: Withheld data for editReply:",
          proxy.withheldData
        );
      } else {
        // Normal V1 or V2-only edit
        editOptions = {
          content: typeof options === "string" ? options : options.content,
          embeds: typeof options !== "string" ? options.embeds || [] : [],
          files: typeof options !== "string" ? options.files || [] : [],
          components:
            typeof options !== "string" ? options.components || [] : [],
          flags: isIncomingV2 ? MessageFlags.IsComponentsV2 : undefined,
          attachments: [], // Ensure attachments are cleared explicitly for edits
          // allowedMentions is not valid for edits
        };
        // Clear conflicting fields if it's purely V2
        if (isIncomingV2) {
          editOptions.content = undefined;
          editOptions.embeds = undefined;
          editOptions.files = undefined;
        }
      }

      try {
        console.log(
          `aiProxy: Editing message ${commandMessage.id} with options:`,
          JSON.stringify(editOptions)
        );
        const editedMessage = await commandMessage.edit(editOptions);
        console.log(
          `aiProxy: editReply successfully edited message ${commandMessage.id}`
        );
        return editedMessage;
      } catch (error) {
        console.error(
          `aiProxy: Error editing reply for message ${commandMessage.id}:`,
          error,
          "Edit options:",
          editOptions
        );
        // Don't reset replied status here, as an edit was attempted after an initial reply/defer
        proxy.wasV2Edit = false;
        proxy.withheldData = null;
        throw error;
      }
    },

    // followUp: Sends a new message in the channel.
    followUp: async (options) => {
      // Follow-up should send a completely new message, respecting V1/V2 separation if needed internally by the caller
      // For simplicity, we assume the caller provides a valid payload.
      // If the caller needs to send V2 + legacy, they should call followUp twice.
      const isIncomingV2 =
        (typeof options !== "string" &&
          options.flags === MessageFlags.IsComponentsV2) ||
        (typeof options !== "string" &&
          options.components?.[0] instanceof ContainerBuilder);

      const followUpOptions = {
        content: typeof options === "string" ? options : options.content,
        embeds: typeof options !== "string" ? options.embeds || [] : [],
        files: typeof options !== "string" ? options.files || [] : [],
        components: typeof options !== "string" ? options.components || [] : [],
        flags: isIncomingV2 ? MessageFlags.IsComponentsV2 : undefined,
        ephemeral: options.ephemeral || proxy.ephemeral, // Inherit ephemeral state potentially
        // Allowed mentions might be desirable here depending on use case
        // allowedMentions: { parse: ['users', 'roles', 'everyone'] },
      };

      // Clear conflicting fields if it's purely V2
      if (isIncomingV2) {
        followUpOptions.content = undefined;
        followUpOptions.embeds = undefined;
        // Keep files for V2 followUp? API might allow this for new messages. Test needed.
        // followUpOptions.files = undefined;
      }

      try {
        console.log(`aiProxy: Sending followUp`);
        // Use message.channel.send for follow-ups, as interaction.followUp has limitations
        // Make sure the channel object exists
        if (!message.channel) {
          console.error(
            "aiProxy: Cannot send followUp, message.channel is null."
          );
          throw new Error("Channel not available for followUp.");
        }
        const sentMessage = await message.channel.send(followUpOptions);
        console.log(`aiProxy: followUp sent message ${sentMessage?.id}`);
        return sentMessage;
      } catch (error) {
        console.error("aiProxy: Error sending followUp:", error);
        throw error;
      }
    },

    // deleteReply/fetchReply remain mostly the same, operating on commandMessage
    deleteReply: async () => {
      if (commandMessage && commandMessage.deletable) {
        try {
          await commandMessage.delete();
          console.log(`aiProxy: Deleted reply message ${commandMessage.id}`);
          commandMessage = null; // Clear reference
          proxy.replied = false; // Reset state
          proxy.deferred = false;
          initialReplySent = false;
          return Promise.resolve();
        } catch (error) {
          console.error(
            `aiProxy: Failed to delete reply message ${commandMessage?.id}:`,
            error
          );
          // Don't throw, just log the error
          return Promise.resolve();
        }
      } else {
        console.warn(
          `aiProxy: deleteReply called but no deletable message exists.`
        );
        return Promise.resolve();
      }
    },
    fetchReply: async () => {
      if (commandMessage) {
        // Re-fetch to ensure the object is up-to-date
        try {
          commandMessage = await message.channel.messages.fetch(
            commandMessage.id
          );
          console.log(`aiProxy: Fetched reply message ${commandMessage.id}`);
          return commandMessage;
        } catch (error) {
          console.error(
            `aiProxy: Failed to fetch reply message ${commandMessage?.id}:`,
            error
          );
          commandMessage = null; // Clear reference if fetch fails
          return null;
        }
      }
      console.warn(`aiProxy: fetchReply called but no message exists.`);
      return null;
    },

    // getFinalReplyContent is removed
  };
  return proxy;
}

// Execute Command - Executes the command, returns success/response/intendedReply
async function executeCommand(target, aiProxy, effectiveLocale) {
  try {
    // --- Execute the actual command function ---
    const responseFromCommand = await target.execute(aiProxy, i18n);

    // --- Determine the outcome based on proxy state ---
    const commandIntendedReply = aiProxy.replied || aiProxy.deferred; // Did the command call reply/editReply or defer?

    // Determine the text response to send back to the AI
    let responseText = null;
    if (!commandIntendedReply) {
      // If the command didn't intend to reply itself, use its return value or a generic success message
      responseText =
        responseFromCommand != null
          ? responseFromCommand
          : i18n.__(
              "events.ai.buttons.toolExec.successGeneric",
              effectiveLocale
            );
    } else if (aiProxy.withheldData?.content) {
      // If data was withheld, use that as the primary textual response
      responseText = aiProxy.withheldData.content;
    } else if (
      !aiProxy.wasV2Edit &&
      !aiProxy.withheldData?.embeds &&
      !aiProxy.withheldData?.files
    ) {
      // If it was a normal reply/edit without withheld visual elements,
      // and the command didn't return anything explicit, assume success without text output
      responseText = responseFromCommand; // Use command return value if any
    } // Otherwise (V2 edit or withheld visual), responseText remains null

    console.log(
      `executeCommand: commandIntendedReply=${commandIntendedReply}, wasV2Edit=${
        aiProxy.wasV2Edit
      }, withheldData=${!!aiProxy.withheldData}, responseFromCommand=${responseFromCommand}, responseText=${responseText}`
    );

    return {
      success: true,
      response: responseText, // Textual response for AI
      commandIntendedReply: commandIntendedReply,
      wasV2Edit: aiProxy.wasV2Edit, // Pass V2 edit status
      withheldData: aiProxy.withheldData, // Pass withheld data
    };
  } catch (err) {
    console.error("Error executing command via proxy:", err);
    const msg = err.message.includes("Missing Permissions")
      ? i18n.__("events.ai.toolExec.missingPermissions", effectiveLocale)
      : i18n.__(
          "events.ai.buttons.toolExec.errorGeneric",
          { error: err.message },
          effectiveLocale
        );
    return {
      success: false,
      response: msg,
      commandIntendedReply: false,
      wasV2Edit: false,
      withheldData: null,
    };
  }
}

// Main execution logic
export async function executeToolCall(toolCall, message, locale) {
  console.log(`Executing tool call:`, JSON.stringify(toolCall, null, 2));

  const { name, arguments: args } = toolCall.function;

  // --- Refined Command/Target Finding Logic ---
  let command = null;
  let target = null;
  let subName = null;
  let commandName = name; // Use full name by default

  const directCommand = message.client.commands.get(name);
  if (directCommand && typeof directCommand.execute === "function") {
    console.log(`Command found directly by full name: ${name}`);
    target = directCommand;
    command = directCommand;
    const parts = name.split("_");
    if (parts.length > 1) {
      commandName = parts[0];
      subName = parts.slice(1).join("_");
    }
  } else {
    console.log(`Command not found directly by name ${name}. Trying split.`);
    const parts = name.split("_");
    commandName = parts[0];
    subName = parts.length > 1 ? parts.slice(1).join("_") : null;
    command = message.client.commands.get(commandName);

    if (command && subName) {
      console.log(
        `Found base command ${commandName}. Checking for subcommand ${subName}.`
      );
      if (
        command.subcommands &&
        typeof command.subcommands[subName]?.execute === "function"
      ) {
        target = command.subcommands[subName];
        console.log(`Found target execute in command.subcommands.${subName}`);
      } else {
        console.log(
          `Subcommand ${subName} not found or has no execute in command.subcommands.`
        );
      }
    } else if (command && !subName && typeof command.execute === "function") {
      console.log(`Using base command ${commandName}'s execute method.`);
      target = command;
    }
  }
  // --- End Refined Logic ---

  // Determine locale
  let effectiveLocale = locale || message.guild?.preferredLocale || "en";
  effectiveLocale = effectiveLocale.split("-")[0].toLowerCase();
  if (!["en", "ru", "uk"].includes(effectiveLocale)) effectiveLocale = "en";
  i18n.setLocale(effectiveLocale);

  // Parse arguments
  let parsedArgs = {};
  if (typeof args === "string") {
    try {
      parsedArgs = JSON.parse(args);
    } catch (e) {
      console.error(`Failed to parse tool arguments:`, e);
      return {
        success: false,
        response: i18n.__(
          "events.ai.toolExec.parseError",
          { command: name, args: e.message },
          effectiveLocale
        ),
        commandReplied: false,
        visualResponse: false,
        isV2Reply: false,
        withheldData: null,
        wasV2Edit: false,
      };
    }
  } else if (typeof args === "object" && args !== null) {
    parsedArgs = args;
  }

  // Validate Target
  if (!target || typeof target.execute !== "function") {
    console.error(
      `Target execute function ultimately not found for tool: ${name}`
    );
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.commandNotFound",
        { command: name },
        effectiveLocale
      ),
      commandReplied: false,
      visualResponse: false,
      isV2Reply: false,
      withheldData: null,
      wasV2Edit: false,
    };
  }

  // Parameter validation
  let dataObj;
  if (typeof target.data === "function") {
    try {
      dataObj = target.data();
    } catch (err) {
      dataObj = {};
    }
  } else if (target.data?.toJSON) {
    dataObj = target.data.toJSON();
  } else {
    dataObj = target.data;
  }
  const options = (dataObj?.options || []).filter(
    (o) => o.type !== 1 && o.type !== 2
  );
  if (options.length > 0) {
    const valid = options.map((o) => o.name);
    Object.keys(parsedArgs).forEach((k) => {
      if (!valid.includes(k)) {
        console.warn(`Removing unexpected parameter: ${k} for tool ${name}`);
        delete parsedArgs[k];
      }
    });
    const required = options.filter((o) => o.required).map((o) => o.name);
    const missing = required.filter((p) => !(p in parsedArgs));
    if (missing.length) {
      console.error(
        `Missing required parameters for ${name}: ${missing.join(", ")}`
      );
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
        withheldData: null,
        wasV2Edit: false,
      };
    }
  } else if (Object.keys(parsedArgs).length > 0) {
    console.log(
      `Command ${name} has no options defined, but received parameters. Using them directly.`
    );
  }

  // --- Defer Reply Externally ---
  let commandMessage = null;
  let isEphemeral = false; // Track ephemeral status for potential follow-ups
  try {
    // Check if the target command *might* defer (look for deferReply usage potentially, or assume all might)
    // For now, assume deferral is standard for AI tools unless explicitly opted out.
    // We need a way to determine if the command intends to be ephemeral *before* deferring.
    // This might require adding metadata to the command definition.
    // Let's assume non-ephemeral deferral for now.
    const deferOptions = {
      content: "⏳ Processing tool...",
      allowedMentions: { repliedUser: false },
      fetchReply: true, // Need the message object
      ephemeral: false, // Default to non-ephemeral
    };
    console.log(`executeToolCall: Attempting deferReply for tool ${name}`);
    commandMessage = await message.reply(deferOptions);
    console.log(`executeToolCall: Deferred reply sent: ${commandMessage?.id}`);
    // Check if the command *actually* intended to be ephemeral later via proxy.ephemeral
  } catch (deferError) {
    console.error(
      `executeToolCall: Failed to defer reply for tool ${name}:`,
      deferError
    );
    // If defer fails, we cannot proceed with the standard proxy flow
    return {
      success: false,
      response: i18n.__(
        "events.ai.toolExec.deferError",
        { command: name, error: deferError.message },
        effectiveLocale
      ),
      commandReplied: false, // Command didn't get a chance to reply
      visualResponse: false,
      isV2Reply: false,
      withheldData: null,
      wasV2Edit: false,
    };
  }
  // --- End Defer Reply ---

  // Create the proxy, passing the deferred message
  const aiProxy = createAiProxy(
    message,
    commandMessage,
    subName,
    parsedArgs,
    effectiveLocale
  );
  aiProxy.commandName = name; // Set command name on proxy if needed

  // Execute the command - populates proxy state and performs edits/replies internally
  const execResult = await executeCommand(target, aiProxy, effectiveLocale);

  // Update ephemeral status if command set it
  isEphemeral = aiProxy.ephemeral;

  // --- Handle Withheld Data ---
  // If the edit was V2 and legacy data was withheld, send it via followUp
  let followUpSent = false;
  if (execResult.success && execResult.wasV2Edit && execResult.withheldData) {
    console.log(
      `executeToolCall: Sending withheld data via followUp:`,
      execResult.withheldData
    );
    try {
      const followUpOptions = {
        ...execResult.withheldData, // Contains content, embeds, files
        ephemeral: isEphemeral,
        // We might want to suppress mentions here depending on the source
        allowedMentions: { parse: [] },
      };
      await message.channel.send(followUpOptions); // Use channel.send for reliability
      followUpSent = true;
      console.log(`executeToolCall: Successfully sent withheld data followUp.`);
    } catch (followUpError) {
      console.error(
        `executeToolCall: Error sending withheld data followUp:`,
        followUpError
      );
      // If sending withheld data fails, we should probably report an error state back
      // Overwrite the success result
      execResult.success = false;
      execResult.response = i18n.__(
        "events.ai.toolExec.followUpError",
        { command: name, error: followUpError.message },
        effectiveLocale
      );
      // Clear withheld data as it failed to send
      execResult.withheldData = null;
      execResult.wasV2Edit = false; // Reset V2 flag as the follow-up failed
    }
  }
  // --- End Handle Withheld Data ---

  // Determine final visual/reply status
  const commandRepliedSuccessfully =
    execResult.success && execResult.commandIntendedReply;
  // Visual response is true if the command replied successfully AND it wasn't a V2 edit OR if a follow-up was sent
  const visualResponse = commandRepliedSuccessfully || followUpSent;
  // isV2Reply is true ONLY if a V2 edit was successfully performed (and no follow-up error occurred)
  const isV2Reply = execResult.success && execResult.wasV2Edit;

  // --- Send Fallback/Error Message if Necessary ---
  // Send an error/status message ONLY if:
  // 1. Execution failed (execResult.success is false)
  // 2. Execution succeeded BUT the command didn't intend to reply itself AND didn't return any specific text response.
  //    (This avoids sending generic success if the command handled its own reply).
  if (
    !execResult.success ||
    (execResult.success &&
      !execResult.commandIntendedReply &&
      execResult.response)
  ) {
    try {
      console.log(
        "executeToolCall: Sending fallback/error/status message:",
        execResult.response
      );
      // Use followUp if the initial defer was successful, otherwise reply
      const fallbackOptions = {
        content: execResult.response,
        ephemeral: isEphemeral,
      };
      if (commandMessage) {
        await message.channel.send(fallbackOptions); // Use channel.send
      } else {
        await message.reply(fallbackOptions); // Should only happen if initial defer failed AND we somehow got here
      }
    } catch (fallbackError) {
      console.error(
        "executeToolCall: Error sending fallback/error/status message:",
        fallbackError
      );
    }
  }

  console.log(
    `executeToolCall Result: success=${execResult.success}, response=${
      execResult.response
    }, commandReplied=${commandRepliedSuccessfully}, visualResponse=${visualResponse}, isV2Reply=${isV2Reply}, wasV2Edit=${
      execResult.wasV2Edit
    }, withheldData=${!!execResult.withheldData}`
  );

  // Return final status based on actual outcome
  return {
    success: execResult.success,
    // Only return text response to AI if command succeeded AND it wasn't a visual response OR if it failed
    response: execResult.success && visualResponse ? null : execResult.response,
    commandReplied: commandRepliedSuccessfully, // Did the command logic intend to and successfully reply/edit?
    visualResponse: visualResponse, // Was there a visual element sent (original reply/edit or followUp)?
    isV2Reply: isV2Reply, // Was the *final state* determined by a V2-component-only edit?
    withheldData: execResult.withheldData, // Return withheld data for potential further use (e.g., logging)
    wasV2Edit: execResult.wasV2Edit, // Explicitly return if the V2 edit path was taken
  };
}
