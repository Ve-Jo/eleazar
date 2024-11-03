import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "loop");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add type option
    const typeOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "type",
      description: i18nBuilder.translateOption("type", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("type", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "type",
        "description"
      ),
      choices: [
        { name: "Track", value: "track" },
        { name: "Queue", value: "queue" },
        { name: "Off", value: "off" },
      ],
    });

    subcommand.addOption(typeOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(i18n.__("music.noMusicPlaying"));
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("music.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    const loopType = interaction.options.getString("type");
    await player.setRepeatMode(loopType);
    await interaction.editReply(
      i18n.__("music.loop.loopApplied", { type: loopType })
    );
  },
  localization_strings: {
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
    loopApplied: {
      en: "Loop type has been set to {{type}}",
      ru: "Тип повтора был установлен на {{type}}",
      uk: "Тип повтору був встановлений на {{type}}",
    },
    options: {
      type: {
        name: {
          en: "type",
          ru: "тип",
          uk: "тип",
        },
        description: {
          en: "The type of loop to set",
          ru: "Тип повтора",
          uk: "Тип повтору",
        },
      },
    },
  },
};
