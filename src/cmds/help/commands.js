import {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { generateImage } from "../../utils/imageGenerator.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("commands")
      .setDescription("List all commands");

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        ru: "команды",
        uk: "команди",
      },
      description: { ru: "Список всех команд", uk: "Список всіх команд" },
    },
    categoryMenu: {
      placeholder: {
        en: "Select a category",
        ru: "Выберите категорию",
        uk: "Виберіть категорію",
      },
    },
    subcommandMenu: {
      placeholder: {
        en: "Select a command",
        ru: "Выберите команду",
        uk: "Виберіть команду",
      },
    },
    next: {
      en: "Next",
      ru: "Далее",
      uk: "Далі",
    },
    previous: {
      en: "Previous",
      ru: "Назад",
      uk: "Назад",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const commands = [];
    const categories = new Set();
    const locale = interaction.locale;

    // Helper function to get translation or use default
    const getTranslation = (key) => {
      const translation = i18n.__(key);

      return translation;
    };

    console.log(
      `[help.commands] Total commands loaded: ${interaction.client.commands.size}`
    );
    console.log(`[help.commands] Using locale: ${locale}`);

    // Keep track of processed categories and subcategories
    const processedCategories = new Map();

    // Log command structure
    console.log("[help.commands] Command structure overview:");
    for (const [commandName, command] of interaction.client.commands) {
      console.log(`- Command: ${commandName}`);
      console.log(`  Has Builder: ${!!(command.data && command.data.builder)}`);
      console.log(
        `  Has Category: ${!!(command.data && command.data.category)}`
      );
      console.log(`  Has Subcommands: ${!!command.subcommands}`);

      if (command.subcommands) {
        console.log(
          `  Subcommands: ${Object.keys(command.subcommands).join(", ")}`
        );
      }
    }

    // Process each command to extract categories and subcommands
    interaction.client.commands.forEach((command) => {
      try {
        // Skip invalid commands
        if (!command || !command.data) {
          console.log(
            "[help.commands] Skipping invalid command (missing data)"
          );
          return;
        }

        // Get the command name, prioritizing different locations
        const commandName =
          command.data.name ||
          (command.data.builder && command.data.builder.name) ||
          (command.data.localizer && command.data.localizer.name) ||
          "unnamed";

        console.log(`[help.commands] Processing command: ${commandName}`);

        // Check for newer command structure with builder
        const hasBuilder = !!(
          command.data.builder ||
          command.localizer ||
          command.data.localizer
        );

        // Get the category - might be different based on command structure
        const category =
          command.data.category ||
          (command.data.builder && command.data.builder.category) ||
          (command.localizer && command.localizer.category) ||
          (command.data.localizer && command.data.localizer.category) ||
          commandName;

        console.log(
          `[help.commands] Command structure: ${JSON.stringify({
            hasOptions: !!command.data.options,
            optionsLength: command.data.options?.length || 0,
            hasBuilder: hasBuilder,
            hasSubcommands: !!command.subcommands,
            subcommandCount: command.subcommands
              ? Object.keys(command.subcommands).length
              : 0,
            category: category,
          })}`
        );

        // Initialize category entry if not exists
        if (!processedCategories.has(category)) {
          processedCategories.set(category, []);
        }

        // Check if this command has subcommands (stored in the subcommands object)
        if (command.subcommands && typeof command.subcommands === "object") {
          const subcommandEntries = Object.entries(command.subcommands);

          console.log(
            `[help.commands] Found ${subcommandEntries.length} subcommands for ${commandName} in subcommands object`
          );

          // Keep track of subcommand positions within this category
          const commandSubcommands = [];

          subcommandEntries.forEach(([subName, subcommand]) => {
            if (!subcommand) return;

            console.log(`[help.commands] Processing subcommand: ${subName}`);

            // Try to get the localized title/name
            let subTitle = subName;

            // Look for name in localization strings
            if (
              subcommand.data &&
              subcommand.data.builder &&
              subcommand.data.builder.localizationStrings &&
              subcommand.data.builder.localizationStrings.name
            ) {
              // Get name in this user's locale or fall back to the subcommand name
              subTitle =
                subcommand.data.builder.localizationStrings.name[locale] ||
                subcommand.data.builder.localizationStrings.name.en ||
                subName;

              console.log(
                `[help.commands] Found localized name: "${subTitle}" for locale ${locale}`
              );
            }
            // Check localizer directly
            else if (
              subcommand.data &&
              subcommand.data.localizer &&
              subcommand.data.localizer.localizationStrings &&
              subcommand.data.localizer.localizationStrings.name
            ) {
              subTitle =
                subcommand.data.localizer.localizationStrings.name[locale] ||
                subcommand.data.localizer.localizationStrings.name.en ||
                subName;

              console.log(
                `[help.commands] Found localized name in localizer: "${subTitle}"`
              );
            }
            // Check for name_localizations
            else if (
              subcommand.data &&
              subcommand.data.name_localizations &&
              subcommand.data.name_localizations[locale]
            ) {
              subTitle = subcommand.data.name_localizations[locale] || subName;
              console.log(
                `[help.commands] Found name_localizations: "${subTitle}"`
              );
            }

            // Try to get the description from various locations with better locale handling
            let subDescription = "No description";

            // Log all possible places we could find descriptions
            console.log(
              `[help.commands] Looking for description for ${subName} with locale ${locale}`
            );

            // Check in data.builder.localizationStrings (most common)
            if (
              subcommand.data &&
              subcommand.data.builder &&
              subcommand.data.builder.localizationStrings &&
              subcommand.data.builder.localizationStrings.description
            ) {
              console.log(
                `[help.commands] Found localizationStrings.description in builder`
              );

              // Get description in this user's locale or fall back to English
              subDescription =
                subcommand.data.builder.localizationStrings.description[
                  locale
                ] ||
                subcommand.data.builder.localizationStrings.description.en ||
                "No description";

              console.log(
                `[help.commands] Found description: "${subDescription}" for locale ${locale}`
              );
            }
            // Also check data.localizer directly
            else if (
              subcommand.data &&
              subcommand.data.localizer &&
              subcommand.data.localizer.localizationStrings &&
              subcommand.data.localizer.localizationStrings.description
            ) {
              console.log(
                `[help.commands] Found localizationStrings.description in localizer`
              );

              // Get description in this user's locale or fall back to English
              subDescription =
                subcommand.data.localizer.localizationStrings.description[
                  locale
                ] ||
                subcommand.data.localizer.localizationStrings.description.en ||
                "No description";

              console.log(
                `[help.commands] Found description: "${subDescription}" for locale ${locale}`
              );
            }
            // Check for direct description on data
            else if (subcommand.data && subcommand.data.description) {
              console.log(`[help.commands] Found direct description on data`);
              subDescription = subcommand.data.description;
            }
            // Try to find description_localizations
            else if (
              subcommand.data &&
              subcommand.data.description_localizations
            ) {
              console.log(`[help.commands] Found description_localizations`);
              subDescription =
                subcommand.data.description_localizations[locale] ||
                subcommand.data.description ||
                "No description";
            }

            // For subcommands, construct usage string
            const usage = `/${commandName} ${subName}`;

            // Add to the commands array
            const commandIndex = commands.length;
            commands.push({
              title: subTitle,
              description: subDescription,
              category: category,
              currentValue: [usage],
              parentCommand: commandName,
              isSubcommand: true,
            });

            // Track this subcommand in the category
            commandSubcommands.push(commandIndex);
          });

          // Add the subcommands to the category
          processedCategories.get(category).push(...commandSubcommands);

          // Add this category
          categories.add(category);

          console.log(
            `[help.commands] Added ${commandSubcommands.length} subcommands to category: ${category}`
          );
        }
        // If there are data.options but no subcommands object, check there
        else if (command.data.options && command.data.options.length > 0) {
          console.log(
            `[help.commands] Found ${command.data.options.length} subcommands for ${commandName} in data.options`
          );

          // Keep track of subcommand positions within this category
          const commandSubcommands = [];

          command.data.options.forEach((subcommand) => {
            if (!subcommand) return;

            // Get localized name/title
            const subName = subcommand.name || "unnamed-sub";
            console.log(`[help.commands] Processing subcommand: ${subName}`);

            // Try to find localized title
            let subTitle = subName;

            // Check for localized name in various places
            if (
              subcommand.name_localizations &&
              subcommand.name_localizations[locale]
            ) {
              subTitle = subcommand.name_localizations[locale];
              console.log(
                `[help.commands] Found name_localization: "${subTitle}"`
              );
            } else if (
              subcommand &&
              subcommand.localizationStrings &&
              subcommand.localizationStrings.name
            ) {
              subTitle =
                subcommand.localizationStrings.name[locale] ||
                subcommand.localizationStrings.name.en ||
                subName;
              console.log(`[help.commands] Found builder name: "${subTitle}"`);
            }

            // Try to get localized description
            let subDescription = "No description";

            console.log(
              `[help.commands] Looking for description for ${subName} with locale ${locale}`
            );

            // Check for localized description in various places
            if (
              subcommand.description_localizations &&
              subcommand.description_localizations[locale]
            ) {
              subDescription = subcommand.description_localizations[locale];
              console.log(
                `[help.commands] Found description_localization: "${subDescription}"`
              );
            } else if (
              subcommand &&
              subcommand.localizationStrings &&
              subcommand.localizationStrings.description
            ) {
              subDescription =
                subcommand.localizationStrings.description[locale] ||
                subcommand.localizationStrings.description.en ||
                subcommand.description ||
                "No description";
              console.log(
                `[help.commands] Found builder description: "${subDescription}"`
              );
            } else if (subcommand.description) {
              subDescription = subcommand.description;
              console.log(
                `[help.commands] Using direct description: "${subDescription}"`
              );
            }

            // For subcommands, construct usage string
            const usage = `/${commandName} ${subName}`;

            // Add to the commands array
            const commandIndex = commands.length;
            commands.push({
              title: subTitle,
              description: subDescription,
              category: category,
              currentValue: [usage],
              parentCommand: commandName,
              isSubcommand: true,
            });

            // Track this subcommand in the category
            commandSubcommands.push(commandIndex);
          });

          // Add the subcommands to the category
          processedCategories.get(category).push(...commandSubcommands);

          // Add this category
          categories.add(category);

          console.log(
            `[help.commands] Added ${commandSubcommands.length} subcommands to category: ${category}`
          );
        }
        // If no options, add the command directly
        else {
          // Get localized description from either builder or direct localizations
          const commandDescription =
            command.localizationStrings?.description?.[locale] ||
            command.description_localizations?.[locale] ||
            command.description ||
            "No description available";

          const commandIndex = commands.length;
          commands.push({
            title: commandName,
            description: commandDescription,
            category: category,
            currentValue: [`/${commandName}`],
            isSubcommand: false,
          });

          // Add to the category
          processedCategories.get(category).push(commandIndex);

          // Add this category
          categories.add(category);
        }
      } catch (error) {
        console.error(
          `[help.commands] Error processing command: ${
            command.data?.name || "unnamed"
          }`,
          error
        );
      }
    });

    // Debug the processed categories
    console.log("[help.commands] Processed categories:");
    processedCategories.forEach((commandIndexes, category) => {
      console.log(
        `[help.commands] Category: ${category}, Commands: ${commandIndexes.length}`
      );
    });

    console.log("[help.commands] Total commands processed:", commands.length);
    console.log("[help.commands] Categories found:", categories.size);

    // Initialize UI state variables
    let highlightedPosition = 0;
    const visibleCount = 1;

    // Get a default category if we have some available
    let defaultCategory = "General";
    if (categories.size > 0) {
      // Use the first available category as default
      defaultCategory = Array.from(categories)[0];
    }

    // Track the currently selected category
    let currentCategory = defaultCategory;

    // Set initial highlightedPosition to first command of the current category
    const initialCommandIndexes =
      processedCategories.get(currentCategory) || [];
    if (initialCommandIndexes.length > 0) {
      highlightedPosition = initialCommandIndexes[0];
    }

    console.log(`[help.commands] Initial category: ${currentCategory}`);
    console.log(
      `[help.commands] Initial highlighted position: ${highlightedPosition}`
    );

    const generateCommandImage = async () => {
      const pngBuffer = await generateImage("SettingsDisplay", {
        interaction: {
          user: {
            id: interaction.user.id,
            username: interaction.user.username,
            displayName: interaction.user.displayName,
            avatarURL: interaction.user.displayAvatarURL({
              extension: "png",
              size: 1024,
            }),
          },
          guild: {
            id: interaction.guild.id,
            name: interaction.guild.name,
            iconURL: interaction.guild.iconURL({
              extension: "png",
              size: 1024,
            }),
          },
        },
        locale: interaction.locale,
        settings: commands,
        highlightedPosition,
        visibleCount,
        height: 700,
        width: 600,
        maxSettingsHided: 4,
        maxSettingsHidedWidth: 450,
      });

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: `commands.${
          pngBuffer[0] === 0x47 &&
          pngBuffer[1] === 0x49 &&
          pngBuffer[2] === 0x46
            ? "gif"
            : "png"
        }`,
      });

      return attachment;
    };

    const updateMessage = async () => {
      const attachment = await generateCommandImage();

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setColor(process.env.EMBED_COLOR)
        .setImage("attachment://commands.png")
        .setAuthor({
          name: getTranslation("title"),
          iconURL: interaction.user.avatarURL(),
        });

      return { embeds: [embed], files: [attachment] };
    };

    const createCategoryMenu = () => {
      const categoriesArray = Array.from(categories)
        .filter(
          (category) => typeof category === "string" && category.trim() !== ""
        )
        .map((category) => ({
          label: category || "Unknown Category",
          value: category,
        }));

      // Ensure we always have at least one option
      if (categoriesArray.length === 0) {
        categoriesArray.push({
          label: "General",
          value: "General",
        });
      }

      return new StringSelectMenuBuilder()
        .setCustomId("category")
        .setPlaceholder(getTranslation("categoryMenu[placeholder]"))
        .addOptions(categoriesArray);
    };

    const createSubcommandMenu = () => {
      // Use our tracked currentCategory instead of inferring from highlightedPosition
      console.log(
        `[help.commands] Creating subcommand menu for category: ${currentCategory}`
      );

      // Get all command indexes for this category from our map
      const commandIndexes = processedCategories.get(currentCategory) || [];
      console.log(
        `[help.commands] Found ${commandIndexes.length} commands for category ${currentCategory}`
      );

      // Make sure the highlightedPosition is within the current category
      // If not, update it to the first command in the current category
      const isHighlightedInCurrentCategory =
        commandIndexes.includes(highlightedPosition);
      if (!isHighlightedInCurrentCategory && commandIndexes.length > 0) {
        console.log(
          `[help.commands] Highlighted position is not in current category. Updating.`
        );
        highlightedPosition = commandIndexes[0];
      }

      // Map indexes to actual command objects
      const categoryCommands = commandIndexes.map((index) => commands[index]);

      let options = categoryCommands
        .filter((cmd) => cmd && cmd.title && typeof cmd.title === "string")
        .map((cmd, index) => {
          console.log(`[help.commands] Adding menu option: ${cmd.title}`);
          return {
            label: cmd.title || `Command ${index}`,
            value: commandIndexes[index].toString(), // Use the actual index in the commands array
            description: cmd.isSubcommand
              ? `${cmd.parentCommand}`
              : cmd.description.length > 50
              ? cmd.description.slice(0, 47) + "..."
              : cmd.description,
          };
        });

      console.log(`[help.commands] Created ${options.length} menu options`);

      // Ensure we always have at least one option
      if (options.length === 0) {
        options = [
          {
            label: "No commands available",
            value: "none",
          },
        ];
      }

      return new StringSelectMenuBuilder()
        .setCustomId("subcommand")
        .setPlaceholder(getTranslation("subcommandMenu[placeholder]"))
        .addOptions(options);
    };

    const row2 = new ActionRowBuilder().addComponents(createCategoryMenu());
    const row3 = new ActionRowBuilder().addComponents(createSubcommandMenu());

    const response = await interaction.editReply({
      ...(await updateMessage()),
      components: [row2, row3],
    });

    const collector = response.createMessageComponentCollector({
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: "You cannot use this menu.",
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();

      if (i.customId === "category") {
        const categoryName = i.values[0];
        console.log(`[help.commands] Selected category: ${categoryName}`);

        // Update the currentCategory
        currentCategory = categoryName;
        console.log(
          `[help.commands] Updated currentCategory to: ${currentCategory}`
        );

        // Get commands for this category from our map
        const categoryCommandIndexes =
          processedCategories.get(categoryName) || [];

        if (categoryCommandIndexes.length > 0) {
          // Set the highlighted position to the first command in this category
          highlightedPosition = categoryCommandIndexes[0];
          console.log(
            `[help.commands] Setting highlightedPosition to ${highlightedPosition}`
          );

          // Recreate the subcommand menu with the new category
          const row3 = new ActionRowBuilder().addComponents(
            createSubcommandMenu()
          );

          await i.editReply({
            ...(await updateMessage()),
            components: [row2, row3],
          });
        }
      } else if (i.customId === "subcommand") {
        // Skip if the "none" option is selected
        if (i.values[0] === "none") {
          return;
        }

        // Get the command index directly from the value
        const cmdIndex = parseInt(i.values[0]);
        console.log(`[help.commands] Selected command index: ${cmdIndex}`);

        if (cmdIndex >= 0 && cmdIndex < commands.length) {
          highlightedPosition = cmdIndex;
          console.log(
            `[help.commands] Setting highlightedPosition to ${highlightedPosition}`
          );

          // Make sure we update the currentCategory to match the selected command's category
          currentCategory = commands[cmdIndex].category;
          console.log(
            `[help.commands] Ensuring currentCategory is set to: ${currentCategory}`
          );

          // Always recreate the subcommand menu to ensure it maintains the current category
          const row3 = new ActionRowBuilder().addComponents(
            createSubcommandMenu()
          );

          await i.editReply({
            ...(await updateMessage()),
            components: [row2, row3],
          });
        }
      }
    });

    collector.on("end", async () => {
      try {
        const fetchedMessage = await interaction.fetchReply();
        if (fetchedMessage) {
          await interaction.editReply({
            components: [],
          });
        }
      } catch (error) {
        console.error("Error updating message after collector ended:", error);
      }
    });
  },
};
