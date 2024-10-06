import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
            client.commands.push(command.default);
            console.log("Loaded command:", command.default.data.name);
          } else {
            console.log(
              "Command file",
              commandFile,
              'is missing required "data" or "execute" property.'
            );
          }
        } catch (error) {
          console.error("Error loading command file:", commandFile, error);
        }
      }
    } else if (folder.endsWith(".js")) {
      const filePath = path.join(commandsPath, folder);
      try {
        const command = await import(filePath);
        if ("data" in command.default && "execute" in command.default) {
          client.commands.push(command.default);
          console.log("Loaded command:", command.default.data.name);
        } else {
          console.log(
            "Command file",
            folder,
            'is missing required "data" or "execute" property.'
          );
        }
      } catch (error) {
        console.error("Error loading command file:", filePath, error);
      }
    }
  }
}
