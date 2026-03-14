import processAiRequestImplementation from "./processAiRequestCore.ts";

type MessageAttachment = {
  name?: string;
  url?: string;
  contentType?: string | null;
};

type MessageLike = {
  id?: string;
  client?: unknown;
  channel?: {
    id?: string;
    name?: string;
    type?: unknown;
    topic?: string | null;
    parent?: { name?: string | null } | null;
    isThread?: boolean;
    sendTyping?: () => Promise<unknown> | void;
    send: (payload: unknown) => Promise<any>;
  } | null;
  author?: {
    id?: string;
    username?: string;
    bot?: boolean;
  } | null;
  member?: {
    nickname?: string | null;
    joinedAt?: Date | null;
    roles?: {
      cache?: {
        map: (mapper: (role: { name: string }) => string) => string[];
      };
    };
  } | null;
  guild?: {
    id?: string;
    name?: string;
    memberCount?: number;
    createdAt?: Date;
    members?: {
      fetch?: (userId: string) => Promise<unknown>;
    };
  } | null;
  mentions?: {
    users?: {
      size?: number;
      values?: () => Iterable<unknown>;
    };
    channels?: {
      size?: number;
      values?: () => Iterable<unknown>;
    };
  };
  attachments?: {
    size?: number;
    first?: () => MessageAttachment | undefined;
  };
};

type ProcessingMessageLike = {
  edit: (payload: unknown) => Promise<unknown>;
  delete?: () => Promise<unknown>;
  createMessageComponentCollector?: (options: unknown) => {
    on: (eventName: string, handler: (...args: any[]) => unknown) => void;
  };
};

type ProcessAiRequest = (
  message: MessageLike,
  userId: string,
  messageContent: string,
  isVisionRequest: boolean,
  processingMessage?: ProcessingMessageLike | null,
  effectiveLocale?: string
) => Promise<unknown>;

const processAiRequest = processAiRequestImplementation as ProcessAiRequest;

export type { MessageLike, ProcessingMessageLike, ProcessAiRequest };
export default processAiRequest;
