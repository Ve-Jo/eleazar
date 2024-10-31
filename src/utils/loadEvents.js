import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const eventCache = new Map();

export async function loadEvent(eventName, client) {
  process.emit("memoryLabel", `Loading Event: ${eventName}`, client);

  const eventsPath = path.join(__dirname, "..", "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(`${filePath}?t=${Date.now()}`);
      if (event.default.name === eventName) {
        if (event.default.once) {
          client.once(event.default.name, (...args) =>
            event.default.execute(...args)
          );
        } else {
          client.on(event.default.name, (...args) =>
            event.default.execute(...args)
          );
        }
        client.events.set(eventName, event.default);
        eventCache.set(eventName, filePath);
        console.log("Loaded event:", eventName);
        return true;
      }
    } catch (error) {
      console.error("Error loading event file:", filePath, error);
    }
  }
  return false;
}

export async function unloadEvent(eventName, client) {
  process.emit("memoryLabel", `Unloading Event: ${eventName}`, client);

  const event = client.events.get(eventName);
  if (event && !event.essential) {
    // Only unload non-essential events
    client.removeAllListeners(eventName);
    client.events.delete(eventName);

    const cachePath = eventCache.get(eventName);
    if (cachePath) {
      const modulePath = path.resolve(cachePath);
      delete require.cache[modulePath];
      eventCache.delete(eventName);
    }
    if (global.gc) global.gc();
    console.log("Unloaded event:", eventName);
    return true;
  }
  return false;
}

export async function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(filePath);
      // Load if event is marked as essential or is core functionality
      if (event.default.essential || event.default.core) {
        if (event.default.once) {
          client.once(event.default.name, (...args) =>
            event.default.execute(...args)
          );
        } else {
          client.on(event.default.name, (...args) =>
            event.default.execute(...args)
          );
        }
        client.events.set(event.default.name, event.default);
        eventCache.set(event.default.name, filePath);
        console.log("Loaded essential event:", event.default.name);
      }
    } catch (error) {
      console.error("Error loading event file:", filePath, error);
    }
  }
}
