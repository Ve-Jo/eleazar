import { Events } from "discord.js";
import initMusic from "../utils/music.ts";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.ts";
import StatusService from "../services/StatusService.ts";
import { cleanupEmptyVoiceRoomsForGuild } from "./voiceRooms.ts";
import { getShardId, isLeaderShard } from "../services/runtimeRedis.ts";

type ClientLike = {
  user?: {
    tag?: string;
    id?: string;
  };
  guilds?: {
    fetch: (id?: string) => Promise<{ id: string; channels?: unknown } | Map<string, { id: string }>>;
  };
  guildsFetch?: () => Promise<Map<string, { id: string }>>;
  guildsResolver?: () => Promise<Array<{ id: string }>>;
  guildsCache?: Map<string, { id: string }>;
  commands?: Map<string, unknown>;
};

const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientLike): Promise<void> {
    const shardId = getShardId(client);
    const leader = isLeaderShard(client);

    console.log(
      `Ready! Logged in as ${client.user?.tag || "unknown user"} (shard=${shardId}, leader=${leader})`
    );

    if (leader && client.commands) {
      await SlashCommandsHandler(client as any, client.commands as any);
    }

    await initMusic(client as any);
    StatusService.start(client as any);

    const guildCollection = await client.guilds?.fetch?.().catch(() => null);
    const guildEntries =
      guildCollection && guildCollection instanceof Map ? Array.from(guildCollection.values()) : [];
    await Promise.all(
      guildEntries.map(async (guildEntry) => {
        try {
          const fullGuild = await client.guilds?.fetch?.(guildEntry.id).catch(() => null);
          if (!fullGuild || !("channels" in fullGuild) || !fullGuild.channels) {
            return;
          }
          await cleanupEmptyVoiceRoomsForGuild(fullGuild as any);
        } catch (error) {
          console.warn("Voice room cleanup failed:", error);
        }
      })
    );
  },
};

export default event;
