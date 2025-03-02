import { Events } from "discord.js";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.js";
import init from "../utils/music.js";
import Database from "../database/client.js";
// import PingService from "../services/PingService.js";

export default {
  name: Events.ClientReady,
  once: true,
  essential: true,
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
  },
};
