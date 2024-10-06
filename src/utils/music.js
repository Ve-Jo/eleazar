import { LavalinkManager } from "lavalink-client";
/*import { HttpsProxyAgent } from "https-proxy-agent";*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function init(client) {
  client.lavalink = new LavalinkManager({
    nodes: [
      /*{
        id: "testnode",
        host: "52.91.78.88",
        port: 2333,
        authorization: "123",
        secure: false,
      },*/
      {
        id: "local",
        host: "0.0.0.0",
        port: 2333,
        authorization: "123",
        secure: false,
      },
    ],
    sendToShard: (guildId, payload) =>
      client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: client.user.id,
      username: client.user.username,
    },
    autoSkip: true,
    playerOptions: {
      clientBasedPositionUpdateInterval: 150,
      defaultSearchPlatform: "ytmsearch",
      volumeDecrementer: 0.75,
      minAutoPlayMs: 10_000,
      //requesterTransformer: requesterTransformer,
      onDisconnect: {
        autoReconnect: false,
        destroyPlayer: true,
      },
      onEmptyQueue: {
        destroyAfterMs: 30_000,
        autoPlayFunction: autoPlayFunction,
      },
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
  });

  await client.lavalink.init({ ...client.user, shards: "auto" });

  const eventsPath = path.join(__dirname, "../events/music");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const eventModule = await import(filePath);

    if (
      eventModule.default &&
      typeof eventModule.default.execute === "function"
    ) {
      const eventName = path.parse(file).name;
      console.log(`Loaded event: ${eventName} (music player)`);
      client.lavalink.on(eventName, (...args) =>
        eventModule.default.execute(client, ...args)
      );
    } else {
      console.log(`Invalid event file: ${file}`);
    }
  }

  client.lavalink.nodeManager.on("connect", (node) => {
    console.log(`Node ${node.id} connected!`);
  });

  client.on("raw", (d) => client.lavalink.sendRawData(d));
}

export default init;
