import { REST, Routes } from "discord.js";

export async function SlashCommandsHandler(client, commands) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");
    const existingCommands = await rest.get(
      Routes.applicationCommands(client.user.id)
    );

    const newCommandNames = new Set(
      Array.from(commands.values()).map((cmd) => cmd.data.name)
    );
    const commandsToDelete = existingCommands.filter(
      (cmd) => !newCommandNames.has(cmd.name)
    );

    for (const cmd of commandsToDelete) {
      await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));
      console.log(`Deleted old command: ${cmd.name}`);
    }

    const commandArray = Array.from(commands.values());

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
      //send what commands have identical option names
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
  } catch (error) {
    console.error(error);
  }
}
