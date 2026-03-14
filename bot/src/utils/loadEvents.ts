import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import hubClient from "../api/hubClient.ts";

type EventModuleShape = {
  name?: string;
  once?: boolean;
  execute: (...args: unknown[]) => unknown;
  localization_strings?: Record<string, unknown>;
};

type EventImportShape = {
  default?: EventModuleShape;
};

type ClientWithEvents = {
  events: Map<string, EventModuleShape>;
  removeAllListeners: () => void;
  once: (eventName: string, listener: (...args: unknown[]) => unknown) => void;
  on: (eventName: string, listener: (...args: unknown[]) => unknown) => void;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getPreferredEventFiles = (eventsPath: string): string[] => {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  const preferredFiles = new Map<string, string>();

  for (const file of eventFiles) {
    const extension = path.extname(file);
    const baseName = path.basename(file, extension);
    const existing = preferredFiles.get(baseName);

    if (!existing || extension === ".ts") {
      preferredFiles.set(baseName, file);
    }
  }

  return Array.from(preferredFiles.values());
};

async function loadEvents(client: ClientWithEvents): Promise<void> {
  client.events = new Map<string, EventModuleShape>();
  client.removeAllListeners();

  const eventsPath = path.join(__dirname, "..", "events");
  const eventFiles = getPreferredEventFiles(eventsPath);

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);

    try {
      const event = (await import(filePath)) as EventImportShape;
      const loadedEvent = event.default;

      if (!loadedEvent?.name || typeof loadedEvent.execute !== "function") {
        console.error("Error loading event file:", filePath, "Invalid event module shape");
        continue;
      }

      if (loadedEvent.localization_strings) {
        const eventName = path.basename(file, path.extname(file));
        console.log(`Registering localizations for event: ${eventName}`);
        await hubClient.registerLocalizations(
          "events",
          eventName,
          loadedEvent.localization_strings,
          false
        );
      } else {
        console.log(`No localizations found for event: ${path.basename(file, path.extname(file))}`);
      }

      if (loadedEvent.once) {
        client.once(loadedEvent.name, (...args: unknown[]) => loadedEvent.execute(...args));
      } else {
        client.on(loadedEvent.name, (...args: unknown[]) => loadedEvent.execute(...args));
      }

      client.events.set(loadedEvent.name, loadedEvent);
      console.log("Loaded event:", loadedEvent.name);
    } catch (error) {
      console.error("Error loading event file:", filePath, error);
    }
  }

  console.log("Saving all translations after event loading...");
  await hubClient.saveAllTranslations();
  console.log("All translations saved.");
}

export { loadEvents };
