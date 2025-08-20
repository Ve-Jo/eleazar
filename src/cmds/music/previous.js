import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("previous")
      .setDescription("Play the previous song");

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        en: "previous",
        ru: "предыдущая",
        uk: "попередня",
      },
      description: {
        en: "Play the previous song",
        ru: "Воспроизвести предыдущую песню",
        uk: "Відтворити попередню пісню",
      },
    },
    noPreviousSongs: {
      en: "There are no previous songs in the queue",
      ru: "В очереди нет предыдущих песен",
      uk: "В черзі немає попередніх пісень",
    },
    addedPreviousToQueue: {
      en: "Added previous song to queue: {{title}}",
      ru: "Добавлена предыдущая песня в очередь: {{title}}",
      uk: "Додано попередню пісню в чергу: {{title}}",
    },
    noMusicPlaying: {
      en: "No music is currently playing",
      ru: "Музыка сейчас не играет",
      uk: "Музика зараз не грає",
    },
    notInVoiceChannel: {
      en: "You are not in the same voice channel as the player",
      ru: "Вы не в том же голосовом канале, что и плеер",
      uk: "Ви не в тому ж голосовому каналі, що й плеєр",
    },
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply({
        content: await i18n.__("commands.music.previous.noMusicPlaying"),
      });
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      return interaction.editReply({
        content: await i18n.__("commands.music.previous.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    if (player.queue.previous.length === 0) {
      return interaction.editReply({
        content: await i18n.__("commands.music.previous.noPreviousSongs"),
      });
    }

    const previousTrack =
      player.queue.previous[player.queue.previous.length - 1];
    await player.queue.add(previousTrack, 0);

    await interaction.editReply({
      content: await i18n.__("commands.music.previous.addedPreviousToQueue", {
        title: previousTrack.info.title,
      }),
    });

    if (!player.playing && !player.paused) {
      await player.play();
    }
  },
};
