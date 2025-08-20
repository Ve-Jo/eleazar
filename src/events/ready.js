import { Events } from "discord.js";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.js";
import init from "../utils/music.js";
import StatusService from "../services/StatusService.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    try {
      await init(client);
    } catch (error) {
      console.error("Failed to initialize music:", error);
    }

    await SlashCommandsHandler(client, client.commands);

    // Start ping service
    //PingService.start(client);

    // Start status service
    StatusService.start(client);
  },
};
