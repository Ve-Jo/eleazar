import { REST, Routes } from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function SlashCommandsHandler(client, commands) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    // Temporarily load all commands for registration
    const commandsPath = path.join(__dirname, "..", "cmds");
    const commandFolders = fs.readdirSync(commandsPath);
    const allCommands = new Map(commands); // Copy existing essential commands

    for (const folder of commandFolders) {
      const folderPath = path.join(commandsPath, folder);
      if (fs.statSync(folderPath).isDirectory()) {
        const commandFile = path.join(folderPath, "index.js");
        if (fs.existsSync(commandFile)) {
          try {
            const command = await import(commandFile);
            if ("data" in command.default && "execute" in command.default) {
              if (!allCommands.has(command.default.data.name)) {
                allCommands.set(command.default.data.name, command.default);
              }
            }
          } catch (error) {
            console.error("Error loading command file:", commandFile, error);
          }
        }
      }
    }

    const existingCommands = await rest.get(
      Routes.applicationCommands(client.user.id)
    );

    const newCommandNames = new Set(
      Array.from(allCommands.values()).map((cmd) => cmd.data.name)
    );
    const commandsToDelete = existingCommands.filter(
      (cmd) => !newCommandNames.has(cmd.name)
    );

    for (const cmd of commandsToDelete) {
      await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));
      console.log(`Deleted old command: ${cmd.name}`);
    }

    const commandArray = Array.from(allCommands.values());

    //check if there's no identical command option names and send a warning
    const commandOptionNames = commandArray.map(
      (cmd) => cmd.data.options?.map((option) => option.name) || []
    );
    const uniqueCommandOptionNames = new Set(
      commandOptionNames.flat().filter((name) => name !== null)
    );
    if (
      commandOptionNames.some((options) =>
        options.some(
          (name) => name !== null && uniqueCommandOptionNames.has(name)
        )
      )
    ) {
      console.warn(
        "Identical command option names detected. This may cause conflicts."
      );
      console.warn(
        commandOptionNames
          .map((options, index) => ({
            options,
            index,
          }))
          .filter(({ options }) => options.some((name) => name !== null))
      );
    }

    const guildCommands = commandArray.filter((command) => command.server);
    if (guildCommands.length > 0) {
      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          process.env.SERVER_TESTING
        ),
        {
          body: guildCommands.map((command) => command.data.toJSON()),
        }
      );
    }

    const globalCommands = commandArray.filter((command) => !command.server);
    if (globalCommands.length > 0) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: globalCommands.map((command) => command.data.toJSON()),
      });
    }

    console.log(
      `Successfully reloaded application (/) commands. ` +
        `Added/Updated: ${commandArray.length}, Deleted: ${commandsToDelete.length}`
    );

    // Clear temporary commands from memory
    for (const [name, command] of allCommands) {
      if (!commands.has(name) && !command.essential) {
        allCommands.delete(name);
      }
    }
  } catch (error) {
    console.error(error);
  }
}
