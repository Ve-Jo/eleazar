import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandCache = new Map();

export async function loadCommand(commandName, client) {
  process.emit("memoryLabel", `Loading Command: ${commandName}`, client);

  const commandsPath = path.join(__dirname, "..", "cmds");
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (fs.statSync(folderPath).isDirectory()) {
      const commandFile = path.join(folderPath, "index.js");
      if (fs.existsSync(commandFile)) {
        try {
          const command = await import(`${commandFile}?t=${Date.now()}`);
          if ("data" in command.default && "execute" in command.default) {
            if (command.default.data.name === commandName) {
              client.commands.set(commandName, command.default);
              commandCache.set(commandName, commandFile);
              console.log("Loaded command:", commandName);
              return true;
            }
          }
        } catch (error) {
          console.error("Error loading command file:", commandFile, error);
        }
      }
    }
  }
  return false;
}

export async function unloadCommand(commandName, client) {
  process.emit("memoryLabel", `Unloading Command: ${commandName}`, client);

  const command = client.commands.get(commandName);
  if (command && !command.essential) {
    client.commands.delete(commandName);
    const cachePath = commandCache.get(commandName);
    if (cachePath) {
      const modulePath = path.resolve(cachePath);
      delete require.cache[modulePath];
      commandCache.delete(commandName);
    }
    if (global.gc) global.gc();
    console.log("Unloaded command:", commandName);
    return true;
  }
  return false;
}

export async function loadCommands(client) {
  const commandsPath = path.join(__dirname, "..", "cmds");
  const commandFolders = fs.readdirSync(commandsPath);

  for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    if (fs.statSync(folderPath).isDirectory()) {
      const commandFile = path.join(folderPath, "index.js");
      if (fs.existsSync(commandFile)) {
        try {
          const command = await import(commandFile);
          if ("data" in command.default && "execute" in command.default) {
            if (command.default.essential || command.default.frequentlyUsed) {
              client.commands.set(command.default.data.name, command.default);
              commandCache.set(command.default.data.name, commandFile);
              console.log(
                "Loaded essential command:",
                command.default.data.name
              );
            }
          }
        } catch (error) {
          console.error("Error loading command file:", commandFile, error);
        }
      }
    }
  }
}
