import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEvents(client) {
  const eventsPath = path.join(__dirname, "..", "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  console.log("Event files found:", eventFiles);

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = await import(filePath);
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
      console.log("Loaded event:", event.default.name);
    } catch (error) {
      console.error("Error loading event file:", filePath, error);
    }
  }
}
