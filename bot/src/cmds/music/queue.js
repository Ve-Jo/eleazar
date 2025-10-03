import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("queue")
      .setDescription("Show the music queue");

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        en: "queue",
        ru: "очередь",
        uk: "черга",
      },
      description: {
        en: "Show the music queue",
        ru: "Показать очередь музыки",
        uk: "Показати чергу музики",
      },
    },
    currentPlaying: {
      en: "Currently playing: {{title}}",
      ru: "Текущая песня: {{title}}",
      uk: "Поточна пісня: {{title}}",
    },
    nextInQueue: {
      en: "Next in queue: {{tracks}}",
      ru: "Следующая в очереди: {{tracks}}",
      uk: "Наступна в черзі: {{tracks}}",
    },
    currentQueue: {
      en: "Current queue",
      ru: "Текущая очередь",
      uk: "Поточна черга",
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
  },

  async execute(interaction, i18n) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(
        await i18n.__("commands.music.queue.noMusicPlaying")
      );
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: await i18n.__("commands.music.queue.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    const current = player.queue.current;
    const nextTrack = player.queue.tracks;

    const queueString = `${await i18n.__(
      "commands.music.queue.currentPlaying",
      {
        title: current.info.title,
      }
    )}\n${await i18n.__("commands.music.queue.nextInQueue", {
      tracks: nextTrack.map((t) => t.info.title).join(", "),
    })}`;

    await interaction.editReply(
      `${await i18n.__("commands.music.queue.currentQueue")}\n${queueString}`
    );
  },
};
