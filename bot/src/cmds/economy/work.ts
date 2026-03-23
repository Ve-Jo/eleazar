import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandSubcommandBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import hubClient from "../../api/hubClient.ts";
import { generateImage } from "../../utils/imageGenerator.ts";
import { getGameModule, loadGames } from "../../utils/loadGames.ts";
import { ComponentBuilder } from "../../utils/componentConverter.ts";
import type { UserLike, GuildLike, TranslatorLike, MessageLike, InteractionLike, ExtendedMessageLike } from "../../types/index.ts";

type ClientLike = {
  user: {
    displayAvatarURL: (options?: Record<string, unknown>) => string;
  };
};

type GameInfo = {
  id: string;
  title: string;
  emoji: string;
  file: string;
  isLegacy: boolean;
  description?: string;
  highScore?: number | string;
};

type GameModuleLike = {
  execute?: (interaction: unknown, i18n: TranslatorLike) => Promise<unknown>;
};

type CategoryGamesMap = Record<string, { avatar: string; games_list: GameInfo[] }>;

const normalizeLocale = (locale: unknown, fallback = "en"): string => {
  if (typeof locale !== "string") {
    return fallback;
  }

  return (locale.split("-")[0] || fallback).toLowerCase();
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("work")
      .setDescription("Play games to earn money")
      .addStringOption((option) =>
        option
          .setName("game")
          .setDescription("Choose a specific game to play directly")
          .setRequired(false)
          .addChoices(
            { name: "snake", value: "snake" },
            { name: "2048", value: "2048" },
            { name: "coinflip", value: "coinflip" },
            { name: "tower", value: "tower" },
            { name: "Crypto 2.0", value: "crypto2" }
          )
      );
  },

  localization_strings: {
    command: {
      name: {
        ru: "работать",
        uk: "працювати",
      },
      description: {
        ru: "Играйте в игры, чтобы заработать деньги",
        uk: "Грайте в ігри, щоб заробити гроші",
      },
    },
    options: {
      game: {
        name: {
          ru: "игра",
          uk: "гра",
        },
        description: {
          ru: "Выберите конкретную игру для прямого запуска",
          uk: "Виберіть конкретну гру для прямого запуску",
        },
        choices: {
          crypto2: {
            name: {
              en: "Crypto 2.0",
              ru: "Крипто 2.0",
              uk: "Кріпто 2.0",
            },
          },
        },
      },
    },
    standardGamesCategory: {
      en: "Standard Games",
      ru: "Обычные Игры",
      uk: "Звичайні Ігри",
    },
    riskyGamesCategory: {
      en: "Risky Games",
      ru: "Рискованные Игры",
      uk: "Ризиковані Ігри",
    },
    oldGamesCategory: {
      en: "Legacy Games",
      ru: "Старые Игры",
      uk: "Старі Ігри",
    },
    title: {
      en: "Game Selection",
      ru: "Выбор игры",
      uk: "Вибір гри",
    },
    selectCategory: {
      en: "Select a game category",
      ru: "Выберите категорию игр",
      uk: "Виберіть категорію ігор",
    },
    playGame: {
      en: "Play",
      ru: "Играть",
      uk: "Грати",
    },
    gameStarted: {
      en: "Starting {{game}}...",
      ru: "Запуск {{game}}...",
      uk: "Запуск {{game}}...",
    },
    error: {
      en: "An error occurred while processing your work request",
      ru: "Произошла ошибка при обработке вашего рабочего запроса",
      uk: "Сталася помилка під час обробки вашого робочого запиту",
    },
    gameError: {
      en: "Error starting {{game}}. Please try again.",
      ru: "Ошибка при запуске {{game}}. Пожалуйста, попробуйте снова.",
      uk: "Помилка при запуску {{game}}. Будь ласка, спробуйте знову.",
    },
    noGamesAvailable: {
      en: "No games are currently available.",
      ru: "В данный момент игры недоступны.",
      uk: "На даний момент ігри недоступні.",
    },
    gameNotFound: {
      en: "The selected game was not found.",
      ru: "Выбранная игра не найдена.",
      uk: "Вибрана гра не знайдена.",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    const builderMode = "v2";
    await interaction.deferReply();

    try {
      const locale = interaction.locale || "en";
      const normalizedLocale = normalizeLocale(locale);

      const gamesMap = await loadGames();
      const gamesArray = Array.from(gamesMap.values()) as GameInfo[];

      if (gamesMap.size === 0) {
        throw new Error("No games found");
      }

      const requestedGame = interaction.options.getString!("game");
      if (requestedGame) {
        if (!gamesMap.has(requestedGame)) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        const gameModule = (await getGameModule(requestedGame)) as GameModuleLike | null;
        if (!gameModule?.execute) {
          await interaction.editReply({
            content: await i18n.__("commands.economy.work.gameNotFound"),
            ephemeral: true,
          });
          return;
        }

        await gameModule.execute(interaction, i18n);
        return;
      }

      const gameRecords = await (hubClient as any).getGameRecords(
        interaction.guild.id,
        interaction.user.id
      );

      const standardGamesArray = gamesArray.filter(
        (game) => !game.file.startsWith("games/risky/") && !game.file.startsWith("games/ported/")
      );
      const riskyGamesArray = gamesArray.filter((game) => game.file.startsWith("games/risky/"));

      const standardCategoryName = String(
        await i18n.__("commands.economy.work.standardGamesCategory")
      );
      const riskyCategoryName = String(
        await i18n.__("commands.economy.work.riskyGamesCategory")
      );

      const games: CategoryGamesMap = {};

      if (standardGamesArray.length > 0) {
        games[standardCategoryName] = {
          avatar: interaction.client?.user?.displayAvatarURL({
            extension: "png",
            size: 1024,
          }) || "",
          games_list: standardGamesArray.map((game) => ({
            ...game,
            highScore: gameRecords?.[game.id]?.highScore || 0,
          })),
        };
      }

      if (riskyGamesArray.length > 0) {
        games[riskyCategoryName] = {
          avatar: interaction.client?.user?.displayAvatarURL({
            extension: "png",
            size: 1024,
          }) || "",
          games_list: riskyGamesArray.map((game) => ({
            ...game,
            highScore: gameRecords?.[game.id]?.highScore || "-",
          })),
        };
      }

      if (Object.keys(games).length === 0) {
        await interaction.editReply({
          content: await i18n.__("commands.economy.work.noGamesAvailable"),
          ephemeral: true,
        });
        return;
      }

      let selectedGame: string | null = null;
      let highlightedGame = 0;
      let currentCategory = 0;
      const currentGameRecords = gameRecords;
      const userData = await (hubClient as any).getUser(interaction.guild.id, interaction.user.id);

      const getCurrentCategoryNames = (): string[] => Object.keys(games);
      const getCurrentCategoryGames = (): GameInfo[] => {
        const categoryNames = getCurrentCategoryNames();
        const currentCategoryKey = categoryNames[currentCategory];
        return (currentCategoryKey ? games[currentCategoryKey]?.games_list : undefined) || [];
      };

      const getAllGameOptions = (): Array<{ label: string; value: string; description: string; default: boolean }> => {
        return getCurrentCategoryNames().flatMap((categoryName, categoryIndex) => {
          const categoryGames = games[categoryName]?.games_list || [];

          return categoryGames.map((game, gameIndex) => ({
            label: String(game.title || game.id).slice(0, 100),
            value: game.id,
            description: categoryName.slice(0, 100),
            default: categoryIndex === currentCategory && gameIndex === highlightedGame,
          }));
        });
      };

      const setFocusedGameById = (gameId: string): GameInfo | null => {
        const categoryNames = getCurrentCategoryNames();

        for (let categoryIndex = 0; categoryIndex < categoryNames.length; categoryIndex++) {
          const categoryName = categoryNames[categoryIndex];
          if (!categoryName) {
            continue;
          }
          const categoryGames = games[categoryName]?.games_list || [];
          const gameIndex = categoryGames.findIndex((game: GameInfo) => game.id === gameId);

          if (gameIndex !== -1) {
            currentCategory = categoryIndex;
            highlightedGame = gameIndex;
            selectedGame = null;
            return categoryGames[gameIndex] || null;
          }
        }

        return null;
      };

      const generateGameMessage = async (
        options: { disableInteractions?: boolean } = {}
      ): Promise<Record<string, unknown>> => {
        const { disableInteractions = false } = options;

        const categoryNames = getCurrentCategoryNames();
        const currentCategoryKey = categoryNames[currentCategory];
        const currentCategoryGames = getCurrentCategoryGames();
        const currentGame = currentCategoryGames[highlightedGame];
        const gameDailyStatus = currentGame?.id
          ? await (hubClient as any).getGameDailyStatus(
              interaction.guild.id,
              interaction.user.id,
              currentGame.id
            )
          : null;

        const generated = (await generateImage(
          "GameLauncher",
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
            locale: i18n.getLocale?.() || normalizedLocale,
            database: userData || {},
            games,
            _debug: {
              gamesKeys: Object.keys(games || {}),
              gamesStructure: JSON.stringify(games, null, 2).substring(0, 500),
            },
            selectedGame,
            currentLocale: i18n.getLocale?.() || normalizedLocale,
            highlightedGame,
            highlightedCategory: currentCategory,
            returnDominant: true,
            gameStats: currentGameRecords || {},
            gameDailyStatus,
          },
          { image: 2, emoji: 1 },
          i18n as any
        )) as [Buffer, any];

        const pngBuffer = generated?.[0];
        const dominantColor = generated?.[1];

        const attachment = new AttachmentBuilder(pngBuffer, {
          name: "work_games.png",
        });

        const gameLauncherComponent = new ComponentBuilder({
          dominantColor: dominantColor as any,
          mode: builderMode,
        })
          .setColor(dominantColor?.embedColor)
          .addText(String(await i18n.__("commands.economy.work.title")), "header3")
          .addImage("attachment://work_games.png");

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("select_game_menu")
          .setPlaceholder(String(await i18n.__("commands.economy.work.selectGame")))
          .addOptions(getAllGameOptions());

        const selectButton = new ButtonBuilder()
          .setCustomId("select_game")
          .setLabel(String(await i18n.__("commands.economy.work.playGame")))
          .setStyle(
            selectedGame === currentCategoryGames[highlightedGame]?.id
              ? ButtonStyle.Secondary
              : ButtonStyle.Success
          );

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
        if (!disableInteractions) {
          gameLauncherComponent.addActionRow(selectRow);
        }

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(selectButton);

        if (!disableInteractions) {
          gameLauncherComponent.addActionRow(buttonRow);
        }

        return gameLauncherComponent.toReplyOptions({
          files: [attachment],
        }) as Record<string, unknown>;
      };

      const initialMessageOptions = await generateGameMessage();
      const message = await interaction.editReply(initialMessageOptions) as ExtendedMessageLike;

      const collector = message.createMessageComponentCollector({
        filter: (componentInteraction: any) => componentInteraction.user.id === interaction.user.id,
        time: 60000,
      });

      collector.on("collect", async (componentInteraction: any) => {
        const interactionLocale =
          componentInteraction.locale || componentInteraction.guildLocale || normalizedLocale;
        const normalizedInteractionLocale = normalizeLocale(
          interactionLocale,
          normalizedLocale
        );
        void normalizedInteractionLocale;

        const currentCategoryGames = getCurrentCategoryGames();

        if (!currentCategoryGames || currentCategoryGames.length === 0) {
          await componentInteraction.reply({
            content: await i18n.__("commands.economy.work.noGamesAvailable"),
            ephemeral: true,
          });
          return;
        }

        if (componentInteraction.customId === "select_game_menu") {
          await componentInteraction.deferUpdate();
          const nextGame = setFocusedGameById(componentInteraction.values[0]);

          if (!nextGame) {
            await interaction.editReply({
              content: await i18n.__("commands.economy.work.gameNotFound"),
            });
            return;
          }

          await interaction.editReply(await generateGameMessage());
          return;
        }

        if (componentInteraction.customId === "select_game") {
          const game = currentCategoryGames[highlightedGame];
          if (!game) {
            await componentInteraction.reply({
              content: await i18n.__("commands.economy.work.gameNotFound"),
              ephemeral: true,
            });
            return;
          }

          selectedGame = game.id;
          await componentInteraction.deferUpdate();
          collector.stop?.("game_started");

          try {
            const gameModule = (await getGameModule(game.id)) as GameModuleLike | null;
            if (!gameModule?.execute) {
              throw new Error(`Game module ${game.id} missing execute function`);
            }

            await gameModule.execute(componentInteraction, i18n);
          } catch (error) {
            console.error(`Error executing game ${game.id}:`, error);
            await componentInteraction.followUp({
              content: await i18n.__("commands.economy.work.gameError", {
                game: game.title,
              }),
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", async () => {
        if (message.editable) {
          try {
            const finalMessage = await generateGameMessage({
              disableInteractions: true,
            });
            await message.edit(finalMessage);
          } catch (error) {
            console.error("Error updating components on end:", error);
            await message.edit({ components: [] }).catch(() => {});
          }
        }
      });
    } catch (error) {
      console.error("Error in work command:", error);
      const errorOptions = {
        content: await i18n.__("commands.economy.work.error"),
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorOptions).catch(() => {});
      } else {
        await interaction.reply(errorOptions).catch(() => {});
      }
    }
  },
};

export default command;
