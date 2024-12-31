import { Events } from "discord.js";
import { SlashCommandsHandler } from "../handlers/SlashCommandsHandler.js";
import init from "../utils/music.js";
import EconomyEZ from "../utils/economy.js";
import { startResourceMonitor } from "../runners/resourseMonitor.js";
import AiChannelBot from "../handlers/ai_channelbot.js";
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

    // Initialize the new economy system
    try {
      await EconomyEZ.testDatabaseConnection();
      console.log("Economy system initialized successfully");
    } catch (error) {
      console.error("Failed to initialize economy system:", error);
    }

    startResourceMonitor(200, client);
    // AiChannelBot(client);
  },
};
