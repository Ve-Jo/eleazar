import { REST, Routes } from "discord.js";

export async function SlashCommandsHandler(client, commands) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    // Separate server and global commands
    const serverCommands = Array.from(commands.values())
      .filter((cmd) => cmd.server)
      .map((cmd) => cmd.data.toJSON());

    const globalCommands = Array.from(commands.values())
      .filter((cmd) => !cmd.server)
      .map((cmd) => cmd.data.toJSON());

    // Get existing commands
    const existingServerCommands = await rest.get(
      Routes.applicationGuildCommands(
        client.user.id,
        process.env.SERVER_TESTING
      )
    );
    const existingGlobalCommands = await rest.get(
      Routes.applicationCommands(client.user.id)
    );

    // Remove commands that are not in the commands list
    for (const existingCommand of existingServerCommands) {
      if (!serverCommands.some((cmd) => cmd.name === existingCommand.name)) {
        await rest.delete(
          Routes.applicationGuildCommand(
            client.user.id,
            process.env.SERVER_TESTING,
            existingCommand.id
          )
        );
        console.log(`Removed server command: ${existingCommand.name}`);
      }
    }

    for (const existingCommand of existingGlobalCommands) {
      if (!globalCommands.some((cmd) => cmd.name === existingCommand.name)) {
        await rest.delete(
          Routes.applicationCommand(client.user.id, existingCommand.id)
        );
        console.log(`Removed global command: ${existingCommand.name}`);
      }
    }

    // Update server commands if any exist and SERVER_TESTING is set
    if (serverCommands.length > 0 && process.env.SERVER_TESTING) {
      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          process.env.SERVER_TESTING
        ),
        { body: serverCommands }
      );
      console.log(
        `Successfully registered ${serverCommands.length} server commands.`
      );
    }

    // Update global commands if any exist
    if (globalCommands.length > 0) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: globalCommands,
      });
      console.log(
        `Successfully registered ${globalCommands.length} global commands.`
      );
    }

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}
