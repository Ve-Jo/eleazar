import { Events } from "discord.js";
import initMusic from "../utils/music.ts";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.ts";
import StatusService from "../services/StatusService.ts";

type ClientLike = {
  user?: {
    tag?: string;
    id?: string;
  };
  commands?: Map<string, unknown>;
};

const event = {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientLike): Promise<void> {
    console.log(`Ready! Logged in as ${client.user?.tag || "unknown user"}`);

    if (client.commands) {
      await SlashCommandsHandler(client as any, client.commands as any);
    }

    await initMusic(client as any);
    StatusService.start(client as any);
  },
};

export default event;
