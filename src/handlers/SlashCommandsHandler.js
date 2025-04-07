import { REST, Routes } from "discord.js";

export async function SlashCommandsHandler(client, commands) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    // Log the commands we're processing
    console.log(`Processing ${commands.size} commands`);
    commands.forEach((cmd, name) => {
      console.log(`Command: ${name} (${cmd.server ? "server" : "global"})`);
      // Log subcommands if any
      if (cmd.subcommands) {
        Object.keys(cmd.subcommands).forEach((subcmd) => {
          console.log(`  - Subcommand: ${subcmd}`);
        });
      }
    });

    // Function to manually extract localization data and create a proper JSON structure
    // This bypasses any potential issues with Discord.js's toJSON method
    function commandToJSON(cmd) {
      // Start with the basic JSON representation
      const json = cmd.data.toJSON();

      console.log(`Processing command: ${json.name}`);

      // Manual handling of command localizations
      if (cmd.localization_strings || cmd.data.localizationStrings) {
        const locStrings =
          cmd.localization_strings || cmd.data.localizationStrings || {};

        console.log("JSON.NAME");
        console.log(json.name);

        // Handle name localizations
        if (locStrings.name) {
          json.name_localizations = {};
          Object.entries(locStrings.name).forEach(([locale, value]) => {
            if (locale !== "en") {
              // Skip English as it's the default
              json.name_localizations[locale] = value;
            }
          });
          console.log(
            `Added name_localizations to command ${json.name}:`,
            json.name_localizations
          );
        }

        // Handle description localizations
        if (locStrings.description) {
          json.description_localizations = {};
          Object.entries(locStrings.description).forEach(([locale, value]) => {
            if (locale !== "en") {
              // Skip English as it's the default
              json.description_localizations[locale] = value;
            }
          });
          console.log(
            `Added description_localizations to command ${json.name}:`,
            json.description_localizations
          );
        }
      }

      // Direct property access (backup method)
      if (!json.name_localizations && cmd.data.name_localizations) {
        json.name_localizations = cmd.data.name_localizations;
        console.log(`Used direct name_localizations for ${json.name}`);
      }

      if (
        !json.description_localizations &&
        cmd.data.description_localizations
      ) {
        json.description_localizations = cmd.data.description_localizations;
        console.log(`Used direct description_localizations for ${json.name}`);
      }

      // Process options (subcommands/parameters)
      if (json.options && json.options.length > 0) {
        console.log(
          `Command ${json.name} has ${json.options.length} options (subcommands/parameters)`
        );

        json.options.forEach((option, index) => {
          // Handle subcommands by checking if they exist in the command's subcommands collection
          if (option.type === 1 && cmd.subcommands) {
            // Type 1 = SUB_COMMAND
            const subcommandName = option.name;
            const subcommand = cmd.subcommands[subcommandName];

            if (subcommand && subcommand.localization_strings) {
              console.log(
                `Processing subcommand ${subcommandName} localizations`
              );

              // Apply subcommand name localizations
              try {
                // Check for direct .name structure first (without 'command' prefix)
                if (subcommand.localization_strings.name) {
                  option.name_localizations = {};
                  Object.entries(subcommand.localization_strings.name).forEach(
                    ([locale, value]) => {
                      if (locale !== "en") {
                        option.name_localizations[locale] = value;
                      }
                    }
                  );
                  console.log(
                    `Added name_localizations to subcommand ${subcommandName}:`,
                    option.name_localizations
                  );
                }
                // Check for the nested .command.name structure as fallback
                else if (subcommand.localization_strings.command?.name) {
                  option.name_localizations = {};
                  Object.entries(
                    subcommand.localization_strings.command.name
                  ).forEach(([locale, value]) => {
                    if (locale !== "en") {
                      option.name_localizations[locale] = value;
                    }
                  });
                  console.log(
                    `Added name_localizations to subcommand ${subcommandName} (from command.name):`,
                    option.name_localizations
                  );
                } else {
                  console.error(
                    `Subcommand ${subcommandName} is missing name localizations`
                  );
                }
              } catch (error) {
                console.error(error);
                console.log(subcommand.localization_strings);
              }

              // Apply subcommand description localizations
              // First try direct .description structure
              if (subcommand.localization_strings.description) {
                option.description_localizations = {};
                Object.entries(
                  subcommand.localization_strings.description
                ).forEach(([locale, value]) => {
                  if (locale !== "en") {
                    option.description_localizations[locale] = value;
                  }
                });
                console.log(
                  `Added description_localizations to subcommand ${subcommandName}:`,
                  option.description_localizations
                );
              }
              // Fallback to .command.description structure
              else if (subcommand.localization_strings.command?.description) {
                option.description_localizations = {};
                Object.entries(
                  subcommand.localization_strings.command.description
                ).forEach(([locale, value]) => {
                  if (locale !== "en") {
                    option.description_localizations[locale] = value;
                  }
                });
                console.log(
                  `Added description_localizations to subcommand ${subcommandName} (from command.description):`,
                  option.description_localizations
                );
              }

              // Handle subcommand options (parameters) if they exist
              if (
                option.options &&
                option.options.length > 0 &&
                subcommand.localization_strings.options
              ) {
                option.options.forEach((subOption) => {
                  const optionName = subOption.name;
                  const optionStrings =
                    subcommand.localization_strings.options[optionName];

                  if (optionStrings) {
                    // Apply option name localizations
                    if (optionStrings.name) {
                      subOption.name_localizations = {};
                      Object.entries(optionStrings.name).forEach(
                        ([locale, value]) => {
                          if (locale !== "en") {
                            subOption.name_localizations[locale] = value;
                          }
                        }
                      );
                      console.log(
                        `Added name_localizations to option ${optionName}:`,
                        subOption.name_localizations
                      );
                    }

                    // Apply option description localizations
                    if (optionStrings.description) {
                      subOption.description_localizations = {};
                      Object.entries(optionStrings.description).forEach(
                        ([locale, value]) => {
                          if (locale !== "en") {
                            subOption.description_localizations[locale] = value;
                          }
                        }
                      );
                      console.log(
                        `Added description_localizations to option ${optionName}:`,
                        subOption.description_localizations
                      );
                    }
                  }
                });
              }
            } else if (subcommand && cmd.data.options) {
              // Try to find the option in the builder's options
              const originalOption = cmd.data.options.find(
                (o) => o.name === subcommandName
              );
              if (originalOption) {
                if (originalOption.name_localizations) {
                  option.name_localizations = originalOption.name_localizations;
                  console.log(
                    `Used direct name_localizations for subcommand ${subcommandName}`
                  );
                }

                if (originalOption.description_localizations) {
                  option.description_localizations =
                    originalOption.description_localizations;
                  console.log(
                    `Used direct description_localizations for subcommand ${subcommandName}`
                  );
                }
              }
            }
          } else {
            // Handle regular options (parameters) for main command
            const originalOption = cmd.data.options?.find(
              (o) => o.name === option.name
            );
            if (originalOption) {
              if (originalOption.name_localizations) {
                option.name_localizations = originalOption.name_localizations;
                console.log(
                  `Used direct name_localizations for option ${option.name}`
                );
              }

              if (originalOption.description_localizations) {
                option.description_localizations =
                  originalOption.description_localizations;
                console.log(
                  `Used direct description_localizations for option ${option.name}`
                );
              }
            }
          }
        });
      }

      return json;
    }

    // Separate server and global commands
    const serverCommands = Array.from(commands.values())
      .filter((cmd) => cmd.server)
      .map(commandToJSON);

    const globalCommands = Array.from(commands.values())
      .filter((cmd) => !cmd.server)
      .map(commandToJSON);

    console.log(
      `Found ${serverCommands.length} server commands and ${globalCommands.length} global commands`
    );

    // Check for duplicate command names in server commands
    const serverCommandNames = serverCommands.map((cmd) => cmd.name);
    const duplicateServerCommandNames = findDuplicateNames(serverCommandNames);

    if (duplicateServerCommandNames.length > 0) {
      console.error("DUPLICATE SERVER COMMAND NAMES DETECTED:");
      duplicateServerCommandNames.forEach((name) => {
        console.error(`- "${name}" appears multiple times`);
      });

      // Filter out duplicate commands, keeping only the first occurrence
      const uniqueServerCommandNames = new Set();
      const uniqueServerCommands = serverCommands.filter((cmd) => {
        if (uniqueServerCommandNames.has(cmd.name)) {
          console.log(`Removing duplicate server command: ${cmd.name}`);
          return false;
        }
        uniqueServerCommandNames.add(cmd.name);
        return true;
      });

      console.log(
        `Filtered ${
          serverCommands.length - uniqueServerCommands.length
        } duplicate server commands`
      );
      // Replace the original array with the filtered one
      serverCommands.length = 0;
      serverCommands.push(...uniqueServerCommands);
    }

    // Check for duplicate command names in global commands
    const globalCommandNames = globalCommands.map((cmd) => cmd.name);
    const duplicateGlobalCommandNames = findDuplicateNames(globalCommandNames);

    if (duplicateGlobalCommandNames.length > 0) {
      console.error("DUPLICATE GLOBAL COMMAND NAMES DETECTED:");
      duplicateGlobalCommandNames.forEach((name) => {
        console.error(`- "${name}" appears multiple times`);
      });

      // Filter out duplicate commands, keeping only the first occurrence
      const uniqueGlobalCommandNames = new Set();
      const uniqueGlobalCommands = globalCommands.filter((cmd) => {
        if (uniqueGlobalCommandNames.has(cmd.name)) {
          console.log(`Removing duplicate global command: ${cmd.name}`);
          return false;
        }
        uniqueGlobalCommandNames.add(cmd.name);
        return true;
      });

      console.log(
        `Filtered ${
          globalCommands.length - uniqueGlobalCommands.length
        } duplicate global commands`
      );
      // Replace the original array with the filtered one
      globalCommands.length = 0;
      globalCommands.push(...uniqueGlobalCommands);
    }

    // Check for our specific economy command
    const hasEconomyCommand = commands.has("economy");
    if (hasEconomyCommand) {
      const economyCmd = commands.get("economy");
      const hasDepositSubcommand =
        economyCmd.subcommands && economyCmd.subcommands.deposit;
      console.log(`Economy command found: ${hasEconomyCommand}`);
      console.log(`Deposit subcommand found: ${hasDepositSubcommand}`);
    }

    // Get existing commands
    console.log("Fetching existing commands...");
    let existingServerCommands = [];
    let existingGlobalCommands = [];

    if (process.env.SERVER_TESTING) {
      existingServerCommands = await rest.get(
        Routes.applicationGuildCommands(
          client.user.id,
          process.env.SERVER_TESTING
        )
      );
      console.log(
        `Found ${existingServerCommands.length} existing server commands`
      );
    }

    existingGlobalCommands = await rest.get(
      Routes.applicationCommands(client.user.id)
    );
    console.log(
      `Found ${existingGlobalCommands.length} existing global commands`
    );

    // Clean up old commands
    console.log("Cleaning up old commands...");

    // For server commands
    if (process.env.SERVER_TESTING) {
      for (const existingCommand of existingServerCommands) {
        // Keep only our economy command if it exists in the new commands
        if (
          !serverCommands.some((cmd) => cmd.name === existingCommand.name) ||
          (existingCommand.name !== "economy" && hasEconomyCommand)
        ) {
          console.log(`Removing server command: ${existingCommand.name}`);
          await rest.delete(
            Routes.applicationGuildCommand(
              client.user.id,
              process.env.SERVER_TESTING,
              existingCommand.id
            )
          );
        }
      }
    }

    // For global commands
    for (const existingCommand of existingGlobalCommands) {
      // Keep only our economy command if it exists in the new commands
      if (
        !globalCommands.some((cmd) => cmd.name === existingCommand.name) ||
        (existingCommand.name !== "economy" &&
          hasEconomyCommand &&
          !commands.get("economy").server)
      ) {
        console.log(`Removing global command: ${existingCommand.name}`);
        await rest.delete(
          Routes.applicationCommand(client.user.id, existingCommand.id)
        );
      }
    }

    // Update server commands if any exist and SERVER_TESTING is set
    if (serverCommands.length > 0 && process.env.SERVER_TESTING) {
      console.log("Registering server commands...");
      // Log all command names before registering
      console.log(
        "Server command names to register:",
        serverCommands.map((cmd) => cmd.name).join(", ")
      );

      // Log a sample command structure to verify localizations
      if (serverCommands.length > 0) {
        const sampleCommand = serverCommands[0];
        console.log("Sample command structure:");
        console.log(JSON.stringify(sampleCommand, null, 2));
      }

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
      console.log("Registering global commands...");
      // Log all command names before registering
      console.log(
        "Global command names to register:",
        globalCommands.map((cmd) => cmd.name).join(", ")
      );

      // Log a sample command structure to verify localizations
      if (globalCommands.length > 0) {
        const sampleCommand = globalCommands[0];
        console.log("Sample command structure:");
        console.log(JSON.stringify(sampleCommand, null, 2));
      }

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: globalCommands,
      });
      console.log(
        `Successfully registered ${globalCommands.length} global commands.`
      );
    }

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error in SlashCommandsHandler:", error);
  }
}

// Helper function to find duplicate names in an array
function findDuplicateNames(names) {
  const nameCounts = {};
  const duplicates = [];

  names.forEach((name) => {
    nameCounts[name] = (nameCounts[name] || 0) + 1;
    if (nameCounts[name] === 2) {
      duplicates.push(name);
    }
  });

  return duplicates;
}
