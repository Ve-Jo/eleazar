import fetch from "node-fetch";

type LavalinkServerConfig = {
  id: string;
  host: string;
  port: number;
  authorization: string;
  secure: boolean;
};

type DebouncedFunction<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel: () => void;
};

function loadLavalinkServers(): LavalinkServerConfig[] {
  const servers: LavalinkServerConfig[] = [];
  let serverIndex = 1;

  while (process.env[`LAVALINK_SERVER_${serverIndex}_ID`]) {
    const server: LavalinkServerConfig = {
      id: process.env[`LAVALINK_SERVER_${serverIndex}_ID`] || "",
      host: process.env[`LAVALINK_SERVER_${serverIndex}_HOST`] || "",
      port: parseInt(process.env[`LAVALINK_SERVER_${serverIndex}_PORT`] || "2333", 10),
      authorization:
        process.env[`LAVALINK_SERVER_${serverIndex}_AUTH`] || "youshallnotpass",
      secure: process.env[`LAVALINK_SERVER_${serverIndex}_SECURE`] === "true",
    };

    if (server.id && server.host) {
      servers.push(server);
    }

    serverIndex += 1;
  }

  if (servers.length === 0) {
    console.log(
      "No Lavalink servers configured in environment variables, using defaults"
    );
    return [
      {
        id: process.env.LAVALINK_DEFAULT_ID || "Default Node",
        host: process.env.LAVALINK_DEFAULT_HOST || "localhost",
        port: parseInt(process.env.LAVALINK_DEFAULT_PORT || "2333", 10),
        authorization: process.env.LAVALINK_DEFAULT_AUTH || "youshallnotpass",
        secure: process.env.LAVALINK_DEFAULT_SECURE === "true",
      },
    ];
  }

  return servers;
}

function debounce<TArgs extends unknown[]>(
  func: (...args: TArgs) => void,
  wait: number
): DebouncedFunction<TArgs> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const debounced = ((...args: TArgs) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as DebouncedFunction<TArgs>;

  debounced.cancel = () => {
    clearTimeout(timeout);
  };

  return debounced;
}

async function testServerConnection(
  node: LavalinkServerConfig
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `http${node.secure ? "s" : ""}://${node.host}:${node.port}/version`,
      {
        headers: {
          Authorization: node.authorization,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Server ${node.id} returned status ${response.status}`);
      return false;
    }

    const version = await response.text();
    if (!version) {
      console.error(`Server ${node.id} returned empty version`);
      return false;
    }

    return true;
  } catch (error) {
    const typedError = error as Error;
    console.error(`Failed to connect to server ${node.id}:`, typedError.message);
    return false;
  }
}

const LAVALINK_SERVERS = loadLavalinkServers();

export type { LavalinkServerConfig, DebouncedFunction };
export { loadLavalinkServers, debounce, testServerConnection, LAVALINK_SERVERS };
