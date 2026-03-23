import {
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { generateImage } from "../../utils/imageGenerator.ts";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
void __dirname;


type CommandLike = {
  data?: {
    name?: string;
    description?: string;
    options?: any[];
    builder?: {
      name?: string;
      category?: string;
      localizationStrings?: {
        name?: Record<string, string>;
        description?: Record<string, string>;
      };
    };
    localizer?: {
      category?: string;
      localizationStrings?: {
        name?: Record<string, string>;
        description?: Record<string, string>;
      };
    };
    name_localizations?: Record<string, string>;
    description_localizations?: Record<string, string>;
    category?: string;
  };
  description?: string;
  localizer?: {
    category?: string;
  };
  localization_strings?: {
    description?: Record<string, string>;
    command?: {
      description?: Record<string, string>;
    };
  };
  subcommands?: Record<string, any>;
};

type ClientLike = {
  commands: Map<string, CommandLike> & {
    forEach: (callback: (command: CommandLike, key: string) => void) => void;
    size: number;
  };
};

type CommandEntry = {
  title: string;
  description: string;
  category: string;
  currentValue: string[];
  parentCommand?: string;
  isSubcommand: boolean;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("commands")
      .setDescription("List all commands");
  },

  localization_strings: {
    command: {
      name: {
        ru: "команды",
        uk: "команди",
      },
      description: {
        ru: "Список всех команд",
        uk: "Список всіх команд",
      },
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
    title: {
      en: "Commands list",
      ru: "Список команд",
      uk: "Список команд",
    },
    youCannotUseThisMenu: {
      en: "You cannot use this menu.",
      ru: "Вы не можете использовать это меню.",
      uk: "Ви не можете використовувати це меню.",
    },
    noCommandsAvailable: {
      en: "No commands available",
      ru: "Нет доступных команд",
      uk: "Немає доступних команд",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const commands: CommandEntry[] = [];
    const categories = new Set<string>();
    const locale = interaction.locale;

    const getTranslation = async (key: string): Promise<string | unknown> => {
      return i18n.__(key);
    };

    const processedCategories = new Map<string, number[]>();

    (interaction.client as any)?.commands?.forEach((loadedCommand: any) => {
      try {
        if (!loadedCommand || !loadedCommand.data) {
          return;
        }

        const commandName =
          (loadedCommand.data as any)?.name ||
          (loadedCommand.data as any)?.builder?.name ||
          (loadedCommand.data as any)?.localizer?.category ||
          "unnamed";

        const category =
          (loadedCommand.data as any)?.category ||
          loadedCommand.data.builder?.category ||
          loadedCommand.localizer?.category ||
          loadedCommand.data.localizer?.category ||
          commandName;

        if (!processedCategories.has(category)) {
          processedCategories.set(category, []);
        }

        if (loadedCommand.subcommands && typeof loadedCommand.subcommands === "object") {
          const subcommandEntries = Object.entries(loadedCommand.subcommands);
          const commandSubcommands: number[] = [];

          subcommandEntries.forEach(([subName, subcommand]) => {
            if (!subcommand) {
              return;
            }

            let subTitle = subName;
            if ((subcommand as any).data?.builder?.localizationStrings?.name) {
              subTitle =
                ((subcommand as any).data.builder.localizationStrings.name as any)?.[locale || 'en'] ||
                ((subcommand as any).data.builder.localizationStrings.name as any)?.en ||
                subName;
            } else if ((subcommand as any).data?.localizer?.localizationStrings?.name) {
              subTitle =
                ((subcommand as any).data.localizer.localizationStrings.name as any)?.[locale || 'en'] ||
                ((subcommand as any).data.localizer.localizationStrings.name as any)?.en ||
                subName;
            } else if ((subcommand as any).data?.name_localizations) {
              subTitle = ((subcommand as any).data.name_localizations as any)?.[locale || 'en'] || subName;
            }

            let subDescription = "No description";
            if ((subcommand as any).data?.builder?.localizationStrings?.description) {
              subDescription =
                ((subcommand as any).data.builder.localizationStrings.description as any)?.[locale || 'en'] ||
                ((subcommand as any).data.builder.localizationStrings.description as any)?.en ||
                "No description";
            } else if ((subcommand as any).data?.localizer?.localizationStrings?.description) {
              subDescription =
                ((subcommand as any).data.localizer.localizationStrings.description as any)?.[locale || 'en'] ||
                ((subcommand as any).data.localizer.localizationStrings.description as any)?.en ||
                "No description";
            } else if ((subcommand as any).data?.description) {
              subDescription = (subcommand as any).data.description;
            } else if ((subcommand as any).data?.description_localizations) {
              subDescription =
                ((subcommand as any).data.description_localizations as any)?.[locale || 'en'] ||
                (subcommand as any).data.description ||
                "No description";
            } else if ((subcommand as any).localization_strings) {
              if ((subcommand as any).localization_strings.command?.description) {
                subDescription =
                  ((subcommand as any).localization_strings.command.description as any)?.[locale || 'en'] ||
                  ((subcommand as any).localization_strings.command.description as any)?.en ||
                  "No description";
              } else if ((subcommand as any).localization_strings.description) {
                subDescription =
                  ((subcommand as any).localization_strings.description as any)?.[locale || 'en'] ||
                  ((subcommand as any).localization_strings.description as any)?.en ||
                  "No description";
              }
            }

            const usage = `/${commandName} ${subName}`;
            const commandIndex = commands.length;
            commands.push({
              title: subTitle,
              description: subDescription,
              category,
              currentValue: [usage],
              parentCommand: commandName,
              isSubcommand: true,
            });
            commandSubcommands.push(commandIndex);
          });

          processedCategories.get(category)?.push(...commandSubcommands);
          categories.add(category);
        } else if (loadedCommand.data.options && loadedCommand.data.options.length > 0) {
          const commandSubcommands: number[] = [];
          loadedCommand.data.options.forEach((subcommand: any) => {
            if (!subcommand) {
              return;
            }

            const subName = subcommand.name || "unnamed-sub";
            let subTitle = subName;
            if ((subcommand as any).name_localizations) {
              subTitle = ((subcommand as any).name_localizations as any)?.[locale || 'en'] || subName;
            } else if ((subcommand as any).localizationStrings?.name) {
              subTitle =
                ((subcommand as any).localizationStrings.name as any)?.[locale || 'en'] ||
                ((subcommand as any).localizationStrings.name as any)?.en ||
                subName;
            }

            let subDescription = "No description";
            if ((subcommand as any).description_localizations) {
              subDescription = ((subcommand as any).description_localizations as any)?.[locale || 'en'] || "No description";
            } else if ((subcommand as any).localizationStrings?.description) {
              subDescription =
                ((subcommand as any).localizationStrings.description as any)?.[locale || 'en'] ||
                ((subcommand as any).localizationStrings.description as any)?.en ||
                subcommand.description ||
                "No description";
            } else if (subcommand.description) {
              subDescription = subcommand.description;
            }

            const usage = `/${commandName} ${subName}`;
            const commandIndex = commands.length;
            commands.push({
              title: subTitle,
              description: subDescription,
              category,
              currentValue: [usage],
              parentCommand: commandName,
              isSubcommand: true,
            });
            commandSubcommands.push(commandIndex);
          });

          processedCategories.get(category)?.push(...commandSubcommands);
          categories.add(category);
        } else {
          const commandDescription =
            ((loadedCommand as any)?.localization_strings?.description as any)?.[locale || 'en'] ||
            ((loadedCommand as any)?.localization_strings?.command?.description as any)?.[locale || 'en'] ||
            (loadedCommand.data as any)?.description ||
            (loadedCommand as any)?.description ||
            "No description available";

          const commandIndex = commands.length;
          commands.push({
            title: commandName,
            description: commandDescription,
            category,
            currentValue: [`/${commandName}`],
            isSubcommand: false,
          });
          processedCategories.get(category)?.push(commandIndex);
          categories.add(category);
        }
      } catch (error) {
        console.error(
          `[help.commands] Error processing command: ${loadedCommand.data?.name || "unnamed"}`,
          error
        );
      }
    });

    let highlightedPosition = 0;
    const visibleCount = 1;
    let defaultCategory = "General";
    if (categories.size > 0) {
      defaultCategory = Array.from(categories)[0] || "General";
    }

    let currentCategory = defaultCategory;
    const initialCommandIndexes = processedCategories.get(currentCategory) || [];
    if (initialCommandIndexes.length > 0) {
      highlightedPosition = initialCommandIndexes[0] || 0;
    }

    const generateCommandImage = async (): Promise<[AttachmentBuilder, string]> => {
      const [pngBuffer, dominantColor] = (await generateImage(
        "SettingsDisplay",
        {
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
          returnDominant: true,
          maxSettingsHided: 4,
          maxSettingsHidedWidth: 450,
        },
        { image: 1, emoji: 1 },
        i18n as any
      )) as [Buffer, string];

      const attachment = new AttachmentBuilder(pngBuffer, {
        name: "commands.png",
      });

      return [attachment, dominantColor];
    };

    const updateMessage = async (
      options: { disableInteractions?: boolean } = {}
    ): Promise<Record<string, unknown>> => {
      const { disableInteractions = false } = options;
      const [attachment, dominantColor] = await generateCommandImage();

      const commandComponent = new ComponentBuilder({
        mode: "v2",
      })
        .addText(String(await getTranslation("commands.help.commands.title")), "header3")
        .addImage("attachment://commands.png");

      if (!disableInteractions) {
        const categoryMenu = new StringSelectMenuBuilder()
          .setCustomId("category")
          .setPlaceholder(
            String(
              await getTranslation("commands.help.commands.categoryMenu.placeholder")
            )
          )
          .addOptions(
            Array.from(categories)
              .filter((category) => typeof category === "string" && category.trim() !== "")
              .map((category) => ({
                label: category || "Unknown Category",
                value: category,
                default: category === currentCategory,
              }))
          );

        const categoryRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          categoryMenu
        );
        commandComponent.addActionRow(categoryRow);

        const commandIndexes = processedCategories.get(currentCategory) || [];
        const categoryCommands = commandIndexes.map((index) => commands[index]).filter(Boolean);

        let menuOptions = categoryCommands
          .filter((cmd): cmd is CommandEntry => Boolean(cmd && cmd.title && typeof cmd.title === "string"))
          .map((cmd, index) => ({
            label: cmd.title || `Command ${index}`,
            value: String(commandIndexes[index]),
            default: commandIndexes[index] === highlightedPosition,
          }));

        if (menuOptions.length === 0) {
          menuOptions = [
            {
              label: String(await getTranslation("commands.help.commands.noCommandsAvailable")),
              value: "none",
              default: false,
            },
          ];
        }

        const subcommandMenu = new StringSelectMenuBuilder()
          .setCustomId("subcommand")
          .setPlaceholder(
            String(
              await getTranslation("commands.help.commands.subcommandMenu.placeholder")
            )
          )
          .addOptions(menuOptions);

        const subcommandRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          subcommandMenu
        );
        commandComponent.addActionRow(subcommandRow);
      }

      return commandComponent.toReplyOptions({ files: [attachment] }) as Record<string, unknown>;
    };

    const response = await interaction.editReply(await updateMessage()) as any;
    const collector = response.createMessageComponentCollector({
      time: 5 * 60 * 1000,
    });

    collector.on("collect", async (menuInteraction: any) => {
      if (menuInteraction.user.id !== interaction.user.id) {
        await menuInteraction.reply({
          content: await getTranslation("commands.help.commands.youCannotUseThisMenu"),
          ephemeral: true,
        });
        return;
      }

      await menuInteraction.deferUpdate();

      if (menuInteraction.customId === "category") {
        const categoryName = menuInteraction.values[0];
        currentCategory = categoryName;
        const categoryCommandIndexes = processedCategories.get(categoryName) || [];
        if (categoryCommandIndexes.length > 0) {
          highlightedPosition = categoryCommandIndexes[0] || 0;
          await menuInteraction.editReply(await updateMessage());
        }
      } else if (menuInteraction.customId === "subcommand") {
        if (menuInteraction.values[0] === "none") {
          return;
        }

        const cmdIndex = parseInt(menuInteraction.values[0], 10);
        if (cmdIndex >= 0 && cmdIndex < commands.length) {
          highlightedPosition = cmdIndex;
          currentCategory = commands[cmdIndex]?.category || currentCategory;
          await menuInteraction.editReply(await updateMessage());
        }
      }
    });

    collector.on("end", async () => {
      try {
        const finalMessage = await updateMessage({ disableInteractions: true });
        await interaction.editReply(finalMessage);
      } catch (error) {
        console.error("Error updating message after collector ended:", error);
        await interaction.editReply({ components: [] }).catch(() => {});
      }
    });
  },
};

export default command;
