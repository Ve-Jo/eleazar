import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import i18n from "./newI18n.js"; // Import i18n instance

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadEvents(client) {
  // Clear existing events to prevent duplicates
  client.events = new Map();

  // Remove all existing listeners for safety
  client.removeAllListeners();

  const eventsPath = path.join(__dirname, "..", "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      // Force a fresh import by adding a timestamp to bypass Node's module cache
      const event = await import(`${filePath}`);

      // --- Start Localization Registration ---
      if (event.default.localization_strings) {
        const eventName = path.basename(file, ".js"); // e.g., "ai"
        console.log(`Registering localizations for event: ${eventName}`);
        // Pass the whole strings object defined in the event file
        // Use registerLocalizations as it correctly handles the final save loop
        // Change save to false, we will save explicitly after the loop
        i18n.registerLocalizations(
          "events",
          eventName,
          event.default.localization_strings,
          false
        );
      } else {
        console.log(
          `No localizations found for event: ${path.basename(file, ".js")}`
        );
      }
      // --- End Localization Registration ---

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

  // --- Explicitly save all translations after loading all events ---
  console.log("Saving all translations after event loading...");
  i18n.saveAllTranslations();
  console.log("All translations saved.");
}
