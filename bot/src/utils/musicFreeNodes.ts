import fetch from "node-fetch";

const API_BASE_URL = "https://lavalink-list.ajieblogs.eu.org";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes to match API update interval

interface LavalinkListNode {
  "unique-id": string;
  identifier: string;
  host: string;
  port: number;
  password: string;
  secure: boolean;
  version: string; // "v3" | "v4"
}

interface CachedNodes {
  nodes: LavalinkListNode[];
  timestamp: number;
}

interface FreeNodeConfig {
  id: string;
  host: string;
  port: number;
  authorization: string;
  secure: boolean;
  version: string;
}

let nodeCache: CachedNodes | null = null;

/**
 * Fetch nodes from the Lavalink List API
 */
async function fetchNodesFromApi(): Promise<LavalinkListNode[]> {
  const preferSecure = process.env.LAVALINK_FREE_NODES_PREFER_SECURE !== "false";
  const endpoint = preferSecure
    ? `${API_BASE_URL}/SSL`
    : `${API_BASE_URL}/All`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "EleazarBot/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const nodes = (await response.json()) as LavalinkListNode[];
    return nodes;
  } catch (error) {
    console.error("Failed to fetch free Lavalink nodes:", error);
    return [];
  }
}

/**
 * Get cached nodes or fetch fresh ones if expired
 */
async function getCachedNodes(): Promise<LavalinkListNode[]> {
  const now = Date.now();

  if (nodeCache && now - nodeCache.timestamp < CACHE_TTL_MS) {
    return nodeCache.nodes;
  }

  const nodes = await fetchNodesFromApi();
  nodeCache = { nodes, timestamp: now };
  return nodes;
}

/**
 * Clear the node cache (useful for testing or forcing refresh)
 */
function clearNodeCache(): void {
  nodeCache = null;
}

/**
 * Filter nodes by Lavalink version
 * lavalink-client v2.x requires Lavalink v4
 */
function filterNodesByVersion(
  nodes: LavalinkListNode[],
  targetVersion: string
): LavalinkListNode[] {
  return nodes.filter((node) => node.version.toLowerCase() === targetVersion.toLowerCase());
}

/**
 * Test connection to a free node
 */
async function testFreeNodeConnection(node: FreeNodeConfig): Promise<boolean> {
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
      return false;
    }

    const version = await response.text();
    return version.length > 0;
  } catch {
    return false;
  }
}

/**
 * Convert API node format to bot's internal format
 */
function convertToConfigFormat(node: LavalinkListNode): FreeNodeConfig {
  return {
    id: node.identifier || node["unique-id"],
    host: node.host,
    port: node.port,
    authorization: node.password,
    secure: node.secure,
    version: node.version,
  };
}

/**
 * Get working free nodes matching the required Lavalink version
 * lavalink-client v2.x requires Lavalink v4
 */
async function getWorkingFreeNodes(
  targetVersion: string = "v4",
  maxNodes: number = 5
): Promise<FreeNodeConfig[]> {
  const freeNodesEnabled = process.env.LAVALINK_FREE_NODES_ENABLED === "true";
  if (!freeNodesEnabled) {
    return [];
  }

  const allNodes = await getCachedNodes();
  if (allNodes.length === 0) {
    return [];
  }

  const versionFiltered = filterNodesByVersion(allNodes, targetVersion);
  if (versionFiltered.length === 0) {
    console.warn(`No free ${targetVersion} nodes available from API`);
    return [];
  }

  const workingNodes: FreeNodeConfig[] = [];

  for (const node of versionFiltered) {
    if (workingNodes.length >= maxNodes) {
      break;
    }

    const config = convertToConfigFormat(node);
    const isWorking = await testFreeNodeConnection(config);

    if (isWorking) {
      workingNodes.push(config);
    }
  }

  if (workingNodes.length === 0) {
    console.warn("No working free nodes found after testing connections");
  } else {
    console.log(`Found ${workingNodes.length} working free ${targetVersion} nodes`);
  }

  return workingNodes;
}

/**
 * Get free nodes formatted for LavalinkManager node options
 */
async function getFreeNodeOptions(
  targetVersion: string = "v4",
  maxNodes: number = 5
): Promise<
  Array<{
    id: string;
    host: string;
    port: number;
    authorization: string;
    secure: boolean;
  }>
> {
  const nodes = await getWorkingFreeNodes(targetVersion, maxNodes);
  return nodes.map((node) => ({
    id: node.id,
    host: node.host,
    port: node.port,
    authorization: node.authorization,
    secure: node.secure,
  }));
}

export {
  getWorkingFreeNodes,
  getFreeNodeOptions,
  clearNodeCache,
  filterNodesByVersion,
  convertToConfigFormat,
  testFreeNodeConnection,
  getCachedNodes,
  fetchNodesFromApi,
};

export type { LavalinkListNode, FreeNodeConfig, CachedNodes };
