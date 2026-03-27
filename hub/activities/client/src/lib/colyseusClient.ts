import { Client, type Room } from "colyseus.js";

let clientSingleton: Client | null = null;

export function getColyseusEndpoint(): string | null {
  const rawUrl = import.meta.env.VITE_COLYSEUS_URL?.trim();
  if (!rawUrl) {
    return null;
  }

  try {
    return new URL(rawUrl).toString();
  } catch {
    return null;
  }
}

export function hasColyseusConfigured(): boolean {
  return Boolean(getColyseusEndpoint());
}

export function getColyseusClient(): Client {
  if (clientSingleton) {
    return clientSingleton;
  }

  const endpoint = getColyseusEndpoint();
  if (!endpoint) {
    throw new Error("Missing VITE_COLYSEUS_URL. Multiplayer is disabled for this build.");
  }

  clientSingleton = new Client(endpoint);
  return clientSingleton;
}

export async function joinOrCreateColyseusRoom<TState = unknown>(
  roomName: string,
  options: Record<string, unknown> = {}
): Promise<Room<TState>> {
  const client = getColyseusClient();
  return client.joinOrCreate<TState>(roomName, options);
}

export async function leaveColyseusRoom(room: Room | null | undefined) {
  if (!room) {
    return;
  }

  await room.leave();
}
