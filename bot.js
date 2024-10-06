import { Client, GatewayIntentBits, Events } from "discord.js";
import { loadCommands } from "./src/utils/loadCommands.js";
import { loadEvents } from "./src/utils/loadEvents.js";
import { Memer } from "memer.ts";

console.log("Starting bot...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = [];
client.events = [];

await loadCommands(client);
await loadEvents(client);

client.memer = new Memer();

await client.login(process.env.DISCORD_TOKEN);
