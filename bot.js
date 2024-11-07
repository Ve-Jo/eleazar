import { Client, GatewayIntentBits, Options, Partials } from "discord.js";
import { loadCommands } from "./src/utils/loadCommands.js";
import { loadEvents } from "./src/utils/loadEvents.js";
import { Memer } from "memer.ts";
import { AutomaticSpeechRecognition, TextToImage } from "deepinfra";
import Groq from "groq-sdk";
import Replicate from "replicate";

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
  presence: { status: "online" },
  partials: [
    /*Partials.Message, Partials.Channel, Partials.GuildMember*/
  ],
  sweepers: {
    messages: {
      interval: 30000,
      lifetime: 60000,
      filter: () => (message) => message.author.id !== client.user.id,
    },
    users: {
      interval: 30000,
      filter: () => (user) =>
        !client.guilds.cache.some((guild) => guild.members.cache.has(user.id)),
    },
    guildMembers: {
      interval: 30000,
      filter: () => () => true,
    },
  },
});

setInterval(() => {
  const now = Date.now();
  client.channels.cache.forEach((channel) => {
    if (channel.messages) {
      channel.messages.cache.sweep((message) => {
        const lifetime =
          message.author.id === client.user.id ? 60 * 1000 : 60 * 1000;
        return now - message.createdTimestamp > lifetime;
      });
    }
  });
  console.log("Manual message sweep completed");
}, 60 * 1000);

client.commands = new Map();
client.events = new Map();

await loadCommands(client);
await loadEvents(client);

client.memer = new Memer();

client.groq = new Groq({
  apiKey: process.env.GROQ_API,
});

client.replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

client.deepinfra = {
  whisper: new AutomaticSpeechRecognition(
    "openai/whisper-large-v3-turbo",
    process.env.DEEPINFRA_API_KEY
  ),
  flux_schnell: new TextToImage(
    "black-forest-labs/FLUX-1-schnell",
    process.env.DEEPINFRA_API_KEY
  ),
};

await client.login(process.env.DISCORD_TOKEN);

/*startResourceMonitor(5000);*/

/*function clearCaches() {
  client.users.cache.sweep(() => true);
  client.guilds.cache.forEach((guild) => {
    guild.roles.cache.sweep(() => true);
    guild.channels.cache.sweep(() => true);
  });
  console.log("Caches cleared");
}

setInterval(clearCaches, 30000);*/
