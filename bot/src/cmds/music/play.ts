import { SlashCommandSubcommandBuilder } from "discord.js";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

type LavalinkTrackLike = {
  info: {
    title: string;
  };
};

type SearchResultLike = {
  loadType: "error" | "empty" | "playlist" | "track" | string;
  tracks: LavalinkTrackLike[];
  playlist: {
    name: string;
  };
  exception?: {
    message?: string;
  };
};

type SearchUserLike = {
  locale?: string;
};

type LavalinkPlayerLike = {
  playing?: boolean;
  options: {
    maxPlaylistSize?: number;
  };
  queue: {
    add: (track: LavalinkTrackLike | LavalinkTrackLike[]) => void;
  };
  connect: () => Promise<void>;
  search: (query: { query: string }, user: SearchUserLike) => Promise<SearchResultLike>;
  play: () => Promise<void>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("play")
      .setDescription("Play a song")
      .addStringOption((option) =>
        option
          .setName("song")
          .setDescription("The song to play (URL or search term)")
          .setRequired(true),
      );
  },

  localization_strings: {
    command: {
      name: {
        en: "play",
        ru: "играть",
        uk: "грати",
      },
      description: {
        en: "Play a song",
        ru: "Воспроизвести песню",
        uk: "Відтворити пісню",
      },
    },
    options: {
      song: {
        name: {
          ru: "песня",
          uk: "пісня",
        },
        description: {
          ru: "Песня для воспроизведения (URL или поисковый запрос)",
          uk: "Пісня для відтворення (URL або пошуковий запит)",
        },
      },
    },
    noMatchesFound: {
      en: "No matches found",
      ru: "Ничего не найдено",
      uk: "Нічого не знайдено",
    },
    addedToQueue: {
      en: "Added to queue: {{title}}",
      ru: "Добавлена в очередь: {{title}}",
      uk: "Додано в чергу: {{title}}",
    },
    addedPlaylist: {
      en: "Added playlist: {{name}} ({{count}} of {{total}}, max: {{max}})",
      ru: "Добавлена плейлист: {{name}} ({{count}} из {{total}}, max: {{max}})",
      uk: "Додано плейлист: {{name}} ({{count}} з {{total}}, max: {{max}})",
    },
    noMusicPlaying: {
      en: "No music is currently playing",
      ru: "Музыка сейчас не играет",
      uk: "Музика зараз не грає",
    },
    notInVoiceChannel: {
      en: "You are not in a voice channel (or the player is not in the same voice channel)",
      ru: "Вы не в голосовом канале (или плеер не в том же голосовом канале)",
      uk: "Ви не в голосовому каналі (або плеєр не в тому ж голосовому каналі)",
    },
    loopApplied: {
      en: "Loop type has been set to {{type}}",
      ru: "Тип повтора был установлен на {{type}}",
      uk: "Тип повтору був встановлений на {{type}}",
    },
    noLavalinkNode: {
      en: "No Lavalink node available",
      ru: "Нет доступного узла Lavalink",
      uk: "Немає доступного вузла Lavalink",
    },
    connectionTimeout: {
      en: "Connection timed out",
      ru: "Время соединения истекло",
      uk: "Час з'єднання вичерпано",
    },
    noAvailableNode: {
      en: "No available Node was found",
      ru: "Не найдено доступных узлов",
      uk: "Не знайдено доступних вузлів",
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const query = interaction.options.getString!("song");

    if (!query) {
      await interaction.editReply(await i18n.__("commands.music.play.noMatchesFound"));
      return;
    }

    if (
      !interaction.client?.lavalink?.nodeManager?.nodes?.size
    ) {
      await interaction.editReply(await i18n.__("commands.music.play.noLavalinkNode"));
      return;
    }

    try {
      const player = await interaction.client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: interaction.member?.voice?.channelId,
        textChannelId: interaction.channelId,
      });

      await player.connect();
      if (interaction.user) {
        interaction.user.locale = interaction.locale;
      }

      const result = (await Promise.race([
        player.search({ query }, interaction.user),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Search timeout")), 12000),
        ),
      ])) as SearchResultLike;

      if (result.loadType === "error") {
        await interaction.editReply(
          await i18n.__("commands.music.play.errorLoadingTrack", {
            message: result.exception?.message,
          }),
        );
        return;
      }

      if (result.loadType === "empty") {
        await interaction.editReply(await i18n.__("commands.music.play.noMatchesFound"));
        return;
      }

      if (result.loadType === "playlist") {
        const maxPlaylistSize = player.options.maxPlaylistSize || 1024;
        const tracksToAdd = result.tracks.slice(0, maxPlaylistSize);
        player.queue.add(tracksToAdd);
        await interaction.editReply({
          content: await i18n.__("commands.music.play.addedPlaylist", {
            name: result.playlist.name,
            count: tracksToAdd.length,
            total: result.tracks.length,
            max: maxPlaylistSize,
          }),
        });
      } else {
        const track = result.tracks[0];
        if (!track) {
          await interaction.editReply(await i18n.__("commands.music.play.noMatchesFound"));
          return;
        }
        player.queue.add(track);
        await interaction.editReply({
          content: await i18n.__("commands.music.play.addedToQueue", {
            title: track.info.title,
          }),
        });
      }

      if (!player.playing) {
        await player.play();
      }
    } catch (error) {
      console.error("Error in play command:", error);
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "Error";

      if (
        name === "TimeoutError" ||
        message.includes("timed out") ||
        message === "Search timeout"
      ) {
        await interaction.editReply(await i18n.__("commands.music.play.connectionTimeout"));
        return;
      }

      if (message.includes("No available Node was found")) {
        await interaction.editReply(await i18n.__("commands.music.play.noAvailableNode"));
        return;
      }

      if (message === "No Lavalink Node was provided") {
        await interaction.editReply(await i18n.__("commands.music.play.noLavalinkNode"));
        return;
      }

      await interaction.editReply(await i18n.__("errorOccurred", { error: message }));
    }
  },
};

export default command;
