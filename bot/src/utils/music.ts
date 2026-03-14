import initImplementation from "./musicBootstrapCore.ts";

type DiscordClientLike = {
  user?: {
    id?: string;
    username?: string;
  };
  lavalink?: unknown;
  guilds?: unknown;
  channels?: unknown;
  on?: (eventName: string, listener: (...args: any[]) => unknown) => unknown;
};

type MusicInit = (client: DiscordClientLike) => Promise<void>;

const init = initImplementation as MusicInit;

export type { DiscordClientLike, MusicInit };
export default init;
