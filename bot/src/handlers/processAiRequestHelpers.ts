import hubClient from "../api/hubClient.ts";

type MentionedRole = { name: string };
type RoleCacheLike = { map: (mapper: (role: MentionedRole) => string) => string[] };
type MemberLike = {
  nickname?: string | null;
  joinedAt?: Date | null;
  roles: { cache: RoleCacheLike };
};
type UserLike = { id: string; username: string; bot?: boolean };
type ChannelLike = {
  id?: string;
  name?: string;
  type?: unknown;
  isThread?: boolean;
  topic?: string | null;
  parent?: { name?: string | null } | null;
  messages?: { cache?: { size?: number } };
};
type GuildLike = {
  id?: string;
  name?: string;
  memberCount?: number;
  createdAt?: Date;
  members?: { fetch: (userId: string) => Promise<MemberLike & { user: UserLike } | null> };
};
type MessageLike = {
  id?: string;
  client: { user?: { id?: string } };
  author?: UserLike | null;
  member?: MemberLike | null;
  guild?: GuildLike | null;
  channel?: ChannelLike | null;
  mentions?: {
    users?: { size?: number; values?: () => Iterable<UserLike> };
    channels?: { size?: number; values?: () => Iterable<ChannelLike> };
  };
};

type UserPromptInfo = {
  id?: string;
  username?: string;
  nickname?: string;
  isBot?: boolean;
  roles?: string[];
  joinedAt?: string | null;
  joinedAtRelative?: string;
};

type ChannelPromptInfo = {
  id?: string;
  name?: string;
  type?: unknown;
  isThread?: boolean;
  isDM?: boolean;
  topic?: string | null;
  parentName?: string | null;
  messageCount?: number | string;
};

type ServerPromptInfo = {
  name?: string;
  memberCount?: number;
  createdAt?: string;
  createdAtRelative?: string;
  channelName?: string;
  isThread?: boolean;
  isDM?: boolean;
};

type ToolCall = {
  id: string;
  function: { name: string };
};

type ToolResultMessage = {
  tool_call_id: string;
  role: "tool";
  name: string;
  content: string;
};

type ToolExecutionRequest = {
  toolCall: ToolCall;
  messageContext: {
    guildId?: string;
    channelId?: string;
    userId?: string;
    messageId?: string;
  };
  userId: string;
};

type ToolExecutionResponse = {
  content?: string;
} | null;

type ToolExecutionClient = {
  processToolExecution?: (
    payload: ToolExecutionRequest
  ) => Promise<ToolExecutionResponse>;
};

type PromptSnapshot = {
  userInfo: UserPromptInfo;
  mentionedUsersInfo: UserPromptInfo[];
  mentionedChannelsInfo: ChannelPromptInfo[];
  serverInfo: ServerPromptInfo;
  currentChannelInfo: ChannelPromptInfo;
};

type VisionAttachmentLike = {
  name?: string;
  url?: string;
  contentType?: string | null;
};

type UserMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url?: string } }
    >;

function removeThinkTags(content: string | null | undefined): string | null | undefined {
  if (!content) {
    return content;
  }

  let cleanedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleanedContent = cleanedContent.replace(/< think>[\s\S]*?<\/ think>/gi, "");
  return cleanedContent.trim();
}

function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears > 1 ? "s" : ""} ago`;
}

async function getUserInfoForPrompt(message: MessageLike): Promise<{
  userInfo: UserPromptInfo;
  mentionedUsersInfo: UserPromptInfo[];
  mentionedChannelsInfo: ChannelPromptInfo[];
  serverInfo: ServerPromptInfo;
  currentChannelInfo: ChannelPromptInfo;
}> {
  const author = message.author;
  const mentions = message.mentions?.users;
  const channelMentions = message.mentions?.channels;
  let userInfo: UserPromptInfo = {};
  const mentionedUsersInfo: UserPromptInfo[] = [];
  const mentionedChannelsInfo: ChannelPromptInfo[] = [];
  let serverInfo: ServerPromptInfo = {};
  let currentChannelInfo: ChannelPromptInfo = {};

  if (author) {
    userInfo = {
      id: author.id,
      username: author.username,
      nickname: message.member?.nickname || author.username,
      isBot: author.bot,
      roles: message.member?.roles.cache.map((role) => role.name) || [],
      joinedAt: message.member?.joinedAt ? message.member.joinedAt.toISOString() : null,
      joinedAtRelative: message.member?.joinedAt
        ? getRelativeTimeString(message.member.joinedAt)
        : "unknown time",
    };
  }

  if (mentions && (mentions.size || 0) > 0 && typeof mentions.values === "function") {
    await Promise.all(
      Array.from(mentions.values()).map(async (user) => {
        if (user.id === message.client.user?.id) return;
        const member = message.guild?.members?.fetch
          ? await message.guild.members.fetch(user.id).catch(() => null)
          : null;

        if (member) {
          mentionedUsersInfo.push({
            id: user.id,
            username: user.username,
            nickname: member.nickname || user.username,
            isBot: user.bot,
            roles: member.roles.cache.map((role) => role.name) || [],
            joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
            joinedAtRelative: member.joinedAt
              ? getRelativeTimeString(member.joinedAt)
              : "unknown time",
          });
        }
      })
    );
  }

  if (message.channel) {
    currentChannelInfo = {
      id: message.channel.id,
      name: message.channel.name,
      type: message.channel.type,
      isThread: message.channel.isThread,
      isDM: message.channel.type === "DM",
      topic: message.channel.topic || "No topic set",
      parentName: message.channel.parent ? message.channel.parent.name : null,
      messageCount: message.channel.messages?.cache?.size || "unknown",
    };
  }

  if (channelMentions && (channelMentions.size || 0) > 0 && typeof channelMentions.values === "function") {
    Array.from(channelMentions.values()).forEach((channel) => {
      mentionedChannelsInfo.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        isThread: channel.isThread,
        isDM: channel.type === "DM",
        topic: channel.topic || "No topic set",
        parentName: channel.parent ? channel.parent.name : null,
      });
    });
  }

  if (message.guild && message.channel) {
    serverInfo = {
      name: message.guild.name,
      memberCount: message.guild.memberCount,
      createdAt: message.guild.createdAt?.toISOString(),
      createdAtRelative: message.guild.createdAt
        ? getRelativeTimeString(message.guild.createdAt)
        : undefined,
      channelName: message.channel.name,
      isThread: !!message.channel.isThread,
      isDM: message.channel.type === "DM",
    };
  }

  return {
    userInfo,
    mentionedUsersInfo,
    mentionedChannelsInfo,
    serverInfo,
    currentChannelInfo,
  };
}

async function processToolCallsThroughHub(
  toolCalls: ToolCall[],
  message: MessageLike,
  userId: string
): Promise<ToolResultMessage[]> {
  const toolResults: ToolResultMessage[] = [];
  const maybeToolClient = hubClient as unknown as ToolExecutionClient;
  const processToolExecution =
    typeof maybeToolClient.processToolExecution === "function"
      ? maybeToolClient.processToolExecution.bind(maybeToolClient)
      : null;

  for (const toolCall of toolCalls) {
    try {
      console.log(
        `[processAiRequest] Executing tool through hub: ${toolCall.function.name}`
      );

      if (!processToolExecution) {
        throw new Error("Tool execution is not available on hubClient");
      }

      const toolResult = await processToolExecution({
        toolCall,
        messageContext: {
          guildId: message.guild?.id,
          channelId: message.channel?.id,
          userId: message.author?.id,
          messageId: message.id,
        },
        userId,
      });

      if (toolResult) {
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: toolResult.content || "Tool executed successfully",
        });
      }
    } catch (error) {
      const typedError = error as Error;
      console.error(
        `[processAiRequest] Error executing tool ${toolCall.function.name}:`,
        error
      );
      toolResults.push({
        tool_call_id: toolCall.id,
        role: "tool",
        name: toolCall.function.name,
        content: `Error executing tool: ${typedError.message}`,
      });
    }
  }

  return toolResults;
}

function buildEnhancedSystemPrompt(promptSnapshot: PromptSnapshot): string {
  const {
    userInfo,
    mentionedUsersInfo,
    mentionedChannelsInfo,
    serverInfo,
    currentChannelInfo,
  } = promptSnapshot;

  let enhancedSystemPrompt =
    "You are a helpful AI assistant integrated with Discord. Be friendly, informative, and adapt your responses to the Discord context.";

  enhancedSystemPrompt += `\n\nUSER INFORMATION:
- You are currently talking to ${userInfo.nickname} (username: ${userInfo.username})
- User ID: ${userInfo.id}
- Joined server: ${userInfo.joinedAtRelative}
- Roles: ${userInfo.roles?.join(", ") || "none"}`;

  enhancedSystemPrompt += `\n\nCURRENT CHANNEL:
- Name: #${currentChannelInfo.name}
- Type: ${
    currentChannelInfo.isThread
      ? "Thread"
      : currentChannelInfo.isDM
        ? "Direct Message"
        : "Text Channel"
  }
- Topic: ${currentChannelInfo.topic || "No topic set"}
${
  currentChannelInfo.parentName
    ? `- Parent: ${currentChannelInfo.parentName}`
    : ""
}`;

  if (mentionedUsersInfo.length > 0) {
    enhancedSystemPrompt += `\n\nMENTIONED USERS:`;
    mentionedUsersInfo.forEach((user) => {
      enhancedSystemPrompt += `
- ${user.nickname} (username: ${user.username})
  - User ID: ${user.id}
  - Joined server: ${user.joinedAtRelative}
  - Roles: ${user.roles?.join(", ") || "none"}`;
    });
  }

  if (mentionedChannelsInfo.length > 0) {
    enhancedSystemPrompt += `\n\nMENTIONED CHANNELS:`;
    mentionedChannelsInfo.forEach((channel) => {
      enhancedSystemPrompt += `
- #${channel.name}
  - Type: ${
    channel.isThread
      ? "Thread"
      : channel.isDM
        ? "Direct Message"
        : "Text Channel"
  }
  - Topic: ${channel.topic || "No topic set"}
  ${channel.parentName ? `- Parent: ${channel.parentName}` : ""}`;
    });
  }

  if (serverInfo.name) {
    enhancedSystemPrompt += `\n\nSERVER CONTEXT:
- Server: ${serverInfo.name}
- Members: ${serverInfo.memberCount}
- Server created: ${serverInfo.createdAtRelative}`;
  }

  return enhancedSystemPrompt;
}

function buildUserMessageContent(
  messageContent: string,
  isVisionRequest: boolean,
  attachment?: VisionAttachmentLike
): UserMessageContent {
  if (isVisionRequest && attachment) {
    if (attachment.contentType?.startsWith("image/")) {
      return [
        { type: "text", text: messageContent },
        { type: "image_url", image_url: { url: attachment.url } },
      ];
    }

    return `${messageContent}\n(Attached file: ${attachment.name})`;
  }

  return messageContent;
}

export {
  removeThinkTags,
  getRelativeTimeString,
  getUserInfoForPrompt,
  processToolCallsThroughHub,
  buildEnhancedSystemPrompt,
  buildUserMessageContent,
};
