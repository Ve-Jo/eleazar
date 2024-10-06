import { REST, Routes } from "discord.js";

export async function SlashCommandsHandler(client, commands) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");
    const existingCommands = await rest.get(
      Routes.applicationCommands(client.user.id)
    );

    const newCommandNames = new Set(commands.map((cmd) => cmd.data.name));
    const commandsToDelete = existingCommands.filter(
      (cmd) => !newCommandNames.has(cmd.name)
    );

    for (const cmd of commandsToDelete) {
      await rest.delete(Routes.applicationCommand(client.user.id, cmd.id));
      console.log(`Deleted old command: ${cmd.name}`);
    }

    //check if there's no identical command option names and send a warning
    const commandOptionNames = commands.map((cmd) =>
      cmd.data.options.map((option) => option.name)
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

    /*await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map((command) => command.data.toJSON()),
    });*/

    //if any of the commands hase command.server = true, then send as Router.GuildApplicationCommands
    console.log("HERE");

    const guildCommands = commands.filter((command) => command.server);
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

    //filter out the guildCommands from the commands
    const globalCommands = commands.filter((command) => !command.server);
    if (globalCommands.length > 0) {
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: globalCommands.map((command) => command.data.toJSON()),
      });
    }

    console.log(
      `Successfully reloaded application (/) commands. ` +
        `Added/Updated: ${commands.length}, Deleted: ${commandsToDelete.length}`
    );
  } catch (error) {
    console.error(error);
  }
}
