/**
 * Unified Discord interaction types for the bot.
 * Centralizes UserLike, GuildLike, InteractionLike, and related types
to eliminate duplication across command files.
 */

export type UserLike = {
  id: string;
  tag?: string;
  username: string;
  displayName: string;
  displayAvatarURL: (options?: Record<string, unknown>) => string;
  bot?: boolean;
  user?: UserLike; // For nested user properties in some commands
  locale?: string; // For lavalink search user locale
};

export type GuildLike = {
  id: string;
  name: string;
  iconURL: (options?: Record<string, unknown>) => string | null;
  members?: {
    fetch: (userId: string) => Promise<UserLike>;
    fetchMe?: () => Promise<{
      roles: {
        highest: {
          comparePositionTo: (role: { id: string; name: string }) => number;
        };
      };
    }>;
  };
  roles?: {
    fetch: (roleId: string) => Promise<{ name: string; hexColor: string } | null>;
  };
  channels?: {
    create?: (options: { name: string; type: unknown; parent?: string | null }) => Promise<{ id: string; name: string; type: unknown; parentId?: string | null }>;
  };
};

export type TranslatorLike = {
  __: (key: string, vars?: Record<string, unknown>) => Promise<string | unknown>;
  getLocale?: () => string;
  setLocale?: (locale: string) => void;
  getUserLocale?: () => string;
};

export type MessageLike = {
  editable?: boolean;
  components?: unknown[];
  id?: string;
  channel?: {
    id?: string;
    name?: string;
    messages?: {
      fetch: (messageId: string) => Promise<{
        components: unknown[];
        edit: (payload: unknown) => Promise<unknown>;
      }>;
    };
  };
  edit: (payload: unknown) => Promise<unknown>;
  createMessageComponentCollector: (options: Record<string, unknown>) => {
    on: (event: string, handler: (...args: any[]) => void | Promise<void>) => void;
    stop?: (reason?: string) => void;
  };
  awaitMessageComponent?: (options: Record<string, unknown>) => Promise<unknown>;
};

// Common types used across commands
export type MemberManagerLike = {
  fetch: (userId: string) => Promise<UserLike>;
};

export type ImageData = {
  image: string;
  category: string;
  emotion?: unknown;
  description?: unknown;
};

export type CollectorLike = {
  on: (event: string, callback: (...args: any[]) => Promise<void> | void) => void;
  stop?: (reason?: string) => void;
};

export type FetchedMessageLike = {
  components: unknown[];
  edit: (payload: unknown) => Promise<unknown>;
};

export type ExtendedMessageLike = MessageLike & {
  channel?: {
    messages: {
      fetch: (messageId: string) => Promise<FetchedMessageLike>;
    };
  };
  createMessageComponentCollector: (options: Record<string, unknown>) => CollectorLike;
};

export type ClientLike = {
  user: {
    displayAvatarURL: (options?: Record<string, unknown>) => string;
  };
  users?: {
    fetch: (userId: string) => Promise<UserLike | null>;
  };
};

export type InteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  locale?: string;
  guildId: string;
  channelId?: string; // For lavalink player text channel
  guild: GuildLike;
  user: UserLike;
  member?: UserLike & {
    permissions?: {
      has: (permission: bigint) => boolean;
    };
    voice?: {
      channelId?: string;
    };
  };
  channel?: { id: string; name?: string } | null;
  client?: {
    users: {
      fetch: (userId: string) => Promise<UserLike | { send?: (payload: unknown) => Promise<unknown>; username?: string; displayAvatarURL: (options?: Record<string, unknown>) => string } | null>;
    };
    user?: {
      displayAvatarURL: (options?: Record<string, unknown>) => string;
    };
    guilds?: {
      cache: {
        get: (guildId: string) => {
          channels: {
            cache: {
              get: (channelId: string) => { send?: (payload: unknown) => Promise<unknown> } | undefined;
            };
          };
        } | undefined;
      };
    };
    lavalink?: {
      nodeManager: {
        nodes: {
          size: number;
        };
      };
      createPlayer: (options: {
        guildId: string;
        voiceChannelId?: string;
        textChannelId?: string;
      }) => Promise<{
        playing?: boolean;
        options: {
          maxPlaylistSize?: number;
        };
        queue: {
          add: (track: unknown | unknown[]) => void;
        };
        connect: () => Promise<void>;
        search: (query: { query: string }, user: { locale?: string }) => Promise<{
          loadType: "error" | "empty" | "playlist" | "track" | string;
          tracks: { info: { title: string } }[];
          playlist: { name: string };
          exception?: { message?: string };
        }>;
        play: () => Promise<void>;
      }>;
    };
  };
  inGuild?: () => boolean;
  customId?: string;
  values?: string[];
  options: {
    getString?: (name: string) => string | null;
    getMember?: (name: string) => UserLike | null;
    getUser?: (name: string) => (UserLike & { bot?: boolean }) | null;
    getNumber?: (name: string) => number | null;
    getInteger?: (name: string) => number | null;
    getBoolean?: (name: string) => boolean | null;
    getChannel?: (name: string) => { id: string } | null;
    getRole?: (name: string) => { id: string; name: string } | null;
    getAttachment?: (name: string) => { url: string; contentType?: string | null; size: number; name?: string | null } | null;
    getSubcommand?: () => string;
    getSubcommandGroup?: () => string;
    [key: string]: ((name: string) => unknown) | undefined;
  };
  deferReply: (payload?: { ephemeral?: boolean }) => Promise<unknown>;
  deferUpdate?: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<MessageLike | ExtendedMessageLike | unknown>;
  reply: (payload: unknown) => Promise<unknown>;
  followUp?: (payload: unknown) => Promise<unknown>;
  deleteReply?: () => Promise<unknown>;
  fetchReply?: () => Promise<unknown>;
  update?: (payload: unknown) => Promise<unknown>;
  awaitMessageComponent?: (options: Record<string, unknown>) => Promise<unknown>;
};

export type ComponentInteractionLike = {
  replied?: boolean;
  deferred?: boolean;
  customId: string;
  values: string[];
  user: { id: string };
  update: (payload: unknown) => Promise<unknown>;
  reply: (payload: unknown) => Promise<unknown>;
  followUp: (payload: unknown) => Promise<unknown>;
  deferUpdate: () => Promise<unknown>;
  editReply: (payload: unknown) => Promise<unknown>;
};
