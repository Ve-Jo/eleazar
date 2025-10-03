import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("play")
      .setDescription("Play a song")
      .addStringOption((option) =>
        option
          .setName("song")
          .setDescription("The song to play (URL or search term)")
          .setRequired(true)
      );

    return builder;
  },

  // Define localization strings directly in the command
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

  async execute(interaction, i18n) {
    await interaction.deferReply();
    let query = interaction.options.getString("song");

    if (
      !interaction.client.lavalink ||
      !interaction.client.lavalink.nodeManager.nodes.size
    ) {
      return interaction.editReply(
        await i18n.__("commands.music.play.noLavalinkNode")
      );
    }

    try {
      let player = await interaction.client.lavalink.createPlayer({
        guildId: interaction.guild.id,
        voiceChannelId: interaction.member.voice.channelId,
        textChannelId: interaction.channelId,
      });

      await player.connect();

      interaction.user.locale = interaction.locale;

      let res = await Promise.race([
        player.search({ query: query }, interaction.user),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Search timeout")), 12000)
        ),
      ]);

      if (res.loadType === "error") {
        return interaction.editReply(
          await i18n.__("commands.music.play.errorLoadingTrack", {
            message: res.exception?.message,
          })
        );
      }

      if (res.loadType === "empty") {
        return interaction.editReply(
          await i18n.__("commands.music.play.noMatchesFound")
        );
      }

      if (res.loadType === "playlist") {
        const maxPlaylistSize = player.options.maxPlaylistSize || 1024;
        const tracksToAdd = res.tracks.slice(0, maxPlaylistSize);
        player.queue.add(tracksToAdd);
        await interaction.editReply({
          content: await i18n.__("commands.music.play.addedPlaylist", {
            name: res.playlist.name,
            count: tracksToAdd.length,
            total: res.tracks.length,
            max: maxPlaylistSize,
          }),
        });
      } else {
        const track = res.tracks[0];
        player.queue.add(track);
        await interaction.editReply({
          content: await i18n.__("commands.music.play.addedToQueue", {
            title: track.info.title,
          }),
        });
      }

      /*if (player.nowPlayingMessage && player.queue.current) {
        const { embed, attachment } = await createOrUpdateMusicPlayerEmbed(
          player.queue.current,
          player
        );
        const updatedButtons = createMusicButtons(player);

        try {
          await player.nowPlayingMessage.edit({
            embeds: [embed],
            files: [attachment],
            components: [updatedButtons],
          });
        } catch (error) {
          console.error("Error updating player message:", error);
        }
      }*/

      if (!player.playing) await player.play();
    } catch (error) {
      console.error("Error in play command:", error);

      if (
        error.name === "TimeoutError" ||
        error.message.includes("timed out") ||
        error.message === "Search timeout"
      ) {
        return interaction.editReply(
          await i18n.__("commands.music.play.connectionTimeout")
        );
      } else if (error.message.includes("No available Node was found")) {
        return interaction.editReply(
          await i18n.__("commands.music.play.noAvailableNode")
        );
      } else if (error.message === "No Lavalink Node was provided") {
        return interaction.editReply(
          await i18n.__("commands.music.play.noLavalinkNode")
        );
      } else {
        return interaction.editReply(
          await i18n.__("errorOccurred", { error: error.message })
        );
      }
    }
  },
};
