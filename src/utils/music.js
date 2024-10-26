import { LavalinkManager } from "lavalink-client";
/*import { HttpsProxyAgent } from "https-proxy-agent";*/
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import autoPlayFunction from "../handlers/MusicAutoplay";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function init(client) {
  try {
    console.log("Initializing Lavalink Manager...");
    client.lavalink = new LavalinkManager({
      nodes: [
        {
          id: "lightsout",
          host: "lavalink4.lightsout.in",
          port: 40069,
          authorization: "LightsoutOwnsElves",
          secure: false,
        },
        {
          id: "jirayu",
          host: "lavalink.jirayu.net",
          port: 13592,
          authorization: "youshallnotpass",
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
        clientBasedPositionUpdateInterval: 1000,
        defaultSearchPlatform: "ytmsearch",
        volumeDecrementer: 0.75,
        minAutoPlayMs: 10_000,
        onDisconnect: {
          autoReconnect: false,
          destroyPlayer: true,
        },
        onEmptyQueue: {
          destroyAfterMs: 30_000,
          autoPlayFunction: async (player) => {
            try {
              console.log("Autoplay triggered from onEmptyQueue");

              const lastPlayedTrack = player.get("lastPlayedTrack");
              console.log(
                "Last played track:",
                lastPlayedTrack ? lastPlayedTrack.info.title : "None"
              );

              if (!lastPlayedTrack) {
                console.log("No last played track found, cannot autoplay");
                return null;
              }

              const result = await autoPlayFunction(player, lastPlayedTrack);
              if (!result || result.length === 0) {
                console.log("No tracks found for autoplay");
                return null;
              }
              console.log("Autoplay found tracks:", result.length);

              // Add all found tracks to the queue
              await player.queue.add(result);
              console.log("Added autoplay tracks to queue");

              // Return the first track to start playing
              return result[0];
            } catch (error) {
              console.error("Error in autoplay function:", error);
              return null;
            }
          },
        },
      },
      queueOptions: {
        maxPreviousTracks: 25,
      },
    });

    console.log(
      "LavalinkManager instance created. Attaching event listeners..."
    );

    client.lavalink.nodeManager.on("connect", (node) => {
      console.log(`Node ${node.id} connected successfully!`);
    });

    client.lavalink.nodeManager.on("disconnect", (node, reason) => {
      console.error(`Node ${node.id} disconnected. Reason:`, reason);
    });

    client.lavalink.nodeManager.on("error", (node, error) => {
      console.error(`Error on node ${node.id}:`, error);
    });

    console.log("Event listeners attached. Initializing Lavalink...");

    await client.lavalink.init({ ...client.user, shards: "auto" });

    console.log("Lavalink initialized. Attempting to connect to nodes...");

    // Attempt to connect to all nodes
    for (const [nodeId, node] of client.lavalink.nodeManager.nodes) {
      try {
        console.log(`Attempting to connect to node: ${nodeId}`);
        await node.connect();
        console.log(`Successfully connected to node: ${nodeId}`);
      } catch (error) {
        console.error(`Failed to connect to node ${nodeId}:`, error);
      }
    }

    console.log(
      "Connection attempts completed. Checking for connected nodes..."
    );

    // Wait for a short time to allow nodes to connect
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const connectedNodes = Array.from(
      client.lavalink.nodeManager.nodes.values()
    ).filter((node) => node.connected);
    console.log(`Connected nodes:`, connectedNodes);
    console.log(`Number of connected nodes: ${connectedNodes.length}`);

    if (connectedNodes.length === 0) {
      console.error(
        "No Lavalink nodes are connected. Please check your Lavalink server and configuration."
      );
      throw new Error("No Lavalink nodes connected");
    }

    console.log("Lavalink initialization completed successfully.");

    client.lavalink.on("trackStart", (player, track) => {
      player.set("lastPlayedTrack", track);
      console.log(`Now playing: ${track.info.title}`);
    });

    client.lavalink.on("queueEnd", (player) => {
      console.log("Queue ended, triggering autoplay");
      player.play(); // This will trigger the onEmptyQueue autoPlayFunction
    });

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

    console.log("Lavalink initialization completed successfully.");

    client.on("raw", (d) => client.lavalink.sendRawData(d));
  } catch (error) {
    console.error("Error initializing Lavalink:", error);
    throw error;
  }
}

export default init;
