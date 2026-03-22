import { ShardingManager } from "discord.js";
import path from "path";
import { fileURLToPath } from "url";

const shardingEnabled = process.env.SHARDING_ENABLED === "true";
const configuredShardCount = process.env.TOTAL_SHARDS;
const resolvedShardCount =
  configuredShardCount && configuredShardCount !== "auto"
    ? Number.parseInt(configuredShardCount, 10)
    : "auto";

if (!shardingEnabled) {
  await import("./bot.ts");
} else {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const shardFile = path.join(__dirname, "bot.ts");

  const manager = new ShardingManager(shardFile, {
    token: process.env.DISCORD_TOKEN,
    totalShards: resolvedShardCount,
    respawn: true,
  });

  manager.on("shardCreate", (shard) => {
    console.log(`[launcher] spawned shard ${shard.id}`);

    shard.on("death", () => {
      console.error(`[launcher] shard ${shard.id} died`);
    });

    shard.on("error", (error) => {
      console.error(`[launcher] shard ${shard.id} error:`, error);
    });
  });

  await manager.spawn({
    amount: resolvedShardCount,
    delay: 5_000,
    timeout: 120_000,
  });
}
