import { testServerConnection } from "./musicHelpers.ts";

type LavalinkServerConfig = {
  id: string;
  host: string;
  port: number;
  authorization: string;
  secure: boolean;
};

type PlayerLike = {
  guildId: string;
  node: { id: string };
  queue: {
    current?: unknown;
  };
  position?: number;
  playing?: boolean;
  setNode: (nodeId: string) => Promise<unknown>;
  play: (payload?: unknown) => Promise<unknown>;
};

type LavalinkNodeLike = {
  id: string;
  connected?: boolean;
};

type LavalinkLike = {
  players: Map<string, PlayerLike> | { values: () => Iterable<PlayerLike>; filter: (predicate: (player: PlayerLike) => boolean) => Iterable<PlayerLike> };
  nodeManager: {
    nodes: {
      values: () => Iterable<LavalinkNodeLike>;
    };
    createNode: (server: LavalinkServerConfig) => Promise<LavalinkNodeLike>;
  };
  isInitialized?: boolean;
};

type ClientLike = {
  lavalink: LavalinkLike;
};

function getPlayersIterable(players: ClientLike["lavalink"]["players"]): PlayerLike[] {
  if (players instanceof Map) {
    return Array.from(players.values());
  }

  if (typeof (players as any).values === "function") {
    return Array.from((players as any).values());
  }

  return [];
}

async function migratePlayersToNode(
  players: Iterable<PlayerLike>,
  newNode: LavalinkNodeLike
): Promise<void> {
  for (const player of players) {
    try {
      const currentTrack = player.queue.current;
      const position = player.position;
      const playing = player.playing;

      await player.setNode(newNode.id);

      if (currentTrack && playing) {
        await player.play({
          track: currentTrack,
          options: { startTime: position },
        });
      }

      console.log(`Migrated player ${player.guildId} to node ${newNode.id}`);
    } catch (error) {
      console.error(`Failed to migrate player ${player.guildId}:`, error);
    }
  }
}

async function handleNodeDisconnectCore(
  client: ClientLike,
  disconnectedNode: LavalinkNodeLike,
  servers: LavalinkServerConfig[]
): Promise<boolean> {
  try {
    const allPlayers = getPlayersIterable(client.lavalink.players);
    const affectedPlayers = allPlayers.filter(
      (player) => player.node.id === disconnectedNode.id
    );

    for (const server of servers) {
      if (server.id === disconnectedNode.id) {
        continue;
      }

      const isWorking = await testServerConnection(server);
      if (!isWorking) {
        continue;
      }

      console.log(`Connecting to alternative server ${server.id}`);
      const newNode = await client.lavalink.nodeManager.createNode(server);
      await migratePlayersToNode(affectedPlayers, newNode);
      return true;
    }

    console.error("No alternative servers available!");
    return false;
  } catch (error) {
    console.error("Error handling node disconnect:", error);
    return false;
  }
}

async function handleNodeErrorCore(
  client: ClientLike,
  node: LavalinkNodeLike,
  error: Error,
  servers: LavalinkServerConfig[]
): Promise<boolean> {
  if (!error.message.includes("connect") && !error.message.includes("timeout")) {
    return false;
  }

  const allPlayers = getPlayersIterable(client.lavalink.players);
  const affectedPlayers = allPlayers.filter((player) => player.node.id === node.id);

  for (const server of servers) {
    if (server.id === node.id) {
      continue;
    }

    const isWorking = await testServerConnection(server);
    if (!isWorking) {
      continue;
    }

    console.log(`Switching to backup node ${server.id} due to error`);
    const newNode = await client.lavalink.nodeManager.createNode(server);
    for (const player of affectedPlayers) {
      try {
        await player.setNode(newNode.id);
      } catch (migrateError) {
        console.error(`Failed to migrate player ${player.guildId}:`, migrateError);
      }
    }

    return true;
  }

  return false;
}

async function runNodeHealthCheck(
  client: ClientLike,
  servers: LavalinkServerConfig[]
): Promise<void> {
  try {
    if (!client.lavalink?.isInitialized) {
      return;
    }

    console.log("Performing periodic Lavalink node health check");
    const currentNodes = Array.from(client.lavalink.nodeManager.nodes.values());
    if (currentNodes.length === 0) {
      return;
    }

    const currentPlayers = getPlayersIterable(client.lavalink.players);
    if (currentPlayers.length === 0) {
      return;
    }

    const healthResults = await Promise.all(
      servers.map(async (server) => ({
        server,
        isWorking: await testServerConnection(server).catch(() => false),
      }))
    );

    const workingServers = healthResults
      .filter((result) => result.isWorking)
      .map((result) => result.server);

    if (workingServers.length === 0) {
      console.log("No working Lavalink servers found during health check");
      return;
    }

    const connectedNodes = currentNodes.filter((node) => node.connected);
    if (connectedNodes.length > 0) {
      return;
    }

    console.log(
      "All current nodes disconnected, attempting to connect to a working server"
    );
    const primaryWorkingServer = workingServers[0];
    if (!primaryWorkingServer) {
      return;
    }
    const newNode = await client.lavalink.nodeManager.createNode(
      primaryWorkingServer
    );
    console.log(`Connected to new node: ${newNode.id}`);
    await migratePlayersToNode(currentPlayers, newNode);
  } catch (error) {
    console.error("Error in node health check:", error);
  }
}

export {
  getPlayersIterable,
  migratePlayersToNode,
  handleNodeDisconnectCore,
  handleNodeErrorCore,
  runNodeHealthCheck,
};
