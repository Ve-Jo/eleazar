import { SlashCommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";
import play from "./play.js";
import stop from "./stop.js";
import skip from "./skip.js";
import queue from "./queue.js";
import volume from "./volume.js";
import filters from "./filters.js";
import loop from "./loop.js";
import autoplay from "./autoplay.js";
import seek from "./seek.js";
import previous from "./previous.js"; // Add this line

export default {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("Music control command")
    .setDescriptionLocalizations({
      ru: "Команда управления музыкой",
      uk: "Команда керування музикою",
    })
    .addSubcommand(play.data)
    .addSubcommand(stop.data)
    .addSubcommand(skip.data)
    .addSubcommand(queue.data)
    .addSubcommand(volume.data)
    .addSubcommand(filters.data)
    .addSubcommand(loop.data)
    .addSubcommand(autoplay.data)
    .addSubcommand(seek.data)
    .addSubcommand(previous.data), // Add this line
  server: false,
  async execute(interaction) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: i18n.__("music.notInVoiceChannel"),
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    let subcommands = {
      play: play,
      stop: stop,
      skip: skip,
      queue: queue,
      volume: volume,
      filters: filters,
      loop: loop,
      autoplay: autoplay,
      seek: seek,
      previous: previous, // Add this line
    };

    if (!subcommands[subcommand]) {
      return interaction.editReply({
        content: i18n.__("invalidSubcommand"),
        ephemeral: true,
      });
    }

    await subcommands[subcommand].execute(interaction);
  },

  async autocomplete(interaction) {
    await filters.autocomplete(interaction);
  },
};
