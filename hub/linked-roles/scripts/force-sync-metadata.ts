import { ensureMetadataSchemaRegistered } from "../src/discordApi.ts";

async function run() {
  try {
    await ensureMetadataSchemaRegistered();
    console.log("[linked-roles] metadata schema synced successfully");
  } catch (error) {
    console.error("[linked-roles] metadata schema sync failed", error);
    process.exitCode = 1;
  }
}

void run();
