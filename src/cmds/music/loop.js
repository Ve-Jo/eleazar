import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("loop")
      .setDescription("Loop the current song/queue")
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("The type of loop to set")
          .setRequired(true)
          .addChoices(
            { name: "Track", value: "track" },
            { name: "Queue", value: "queue" },
            { name: "Off", value: "off" }
          )
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        en: "loop",
        ru: "повтор",
        uk: "повтор",
      },
      description: {
        en: "Loop the current song/queue",
        ru: "Повторить текущую песню/очередь",
        uk: "Зациклити пісню/чергу",
      },
    },
    options: {
      type: {
        name: {
          ru: "тип",
          uk: "тип",
        },
        description: {
          ru: "Тип повтора",
          uk: "Тип повтору",
        },
      },
    },
    loopApplied: {
      en: "Loop type has been set to {{type}}",
      ru: "Тип повтора был установлен на {{type}}",
      uk: "Тип повтору був встановлений на {{type}}",
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

  async execute(interaction) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(
        i18n.__("commands.music.loop.noMusicPlaying")
      );
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("commands.music.loop.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    const loopType = interaction.options.getString("type");
    await player.setRepeatMode(loopType);
    await interaction.editReply(
      i18n.__("commands.music.loop.loopApplied", { type: loopType })
    );
  },
};
