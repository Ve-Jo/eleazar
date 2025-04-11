import { SlashCommandSubcommandBuilder } from "discord.js";

export default {
  data: () => {
    // Create a standard subcommand with Discord.js builders
    const builder = new SlashCommandSubcommandBuilder()
      .setName("filters")
      .setDescription("Set the music filters")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("The filter to set")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((option) =>
        option
          .setName("property")
          .setDescription("The property of the filter to set")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addNumberOption((option) =>
        option
          .setName("value")
          .setDescription("The value to set for the filter property")
          .setRequired(true)
      );

    return builder;
  },

  // Define localization strings directly in the command
  localization_strings: {
    command: {
      name: {
        en: "filters",
        ru: "фильтры",
        uk: "фільтри",
      },
      description: {
        en: "Set the music filters",
        ru: "Установить фильтры музыки",
        uk: "Встановити фільтри музики",
      },
    },
    options: {
      filter: {
        name: {
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          ru: "Фильтр для установки",
          uk: "Фільтр для встановлення",
        },
      },
      property: {
        name: {
          ru: "свойство",
          uk: "властивість",
        },
        description: {
          ru: "Свойство фильтра для установки",
          uk: "Властивість фільтра для встановлення",
        },
      },
      value: {
        name: {
          ru: "значение",
          uk: "значення",
        },
        description: {
          ru: "Значение для установки свойства фильтра",
          uk: "Значення для встановлення властивості фільтра",
        },
      },
    },
    filterApplied: {
      en: "Filter {{filter}} has been applied",
      ru: "Фильтр {{filter}} был применен",
      uk: "Фільтр {{filter}} був застосований",
    },
    invalidFilterProperty: {
      en: "Invalid filter property",
      ru: "Неверное свойство фильтра",
      uk: "Неправильна властивість фільтра",
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
    const filterName = interaction.options.getString("filter");
    const filterProperty = interaction.options.getString("property");
    const value = interaction.options.getNumber("value");
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      return interaction.editReply(
        i18n.__("commands.music.filters.noMusicPlaying")
      );
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("commands.music.filters.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    console.log("Filter Name:", filterName);
    console.log("Filter Property:", filterProperty);
    console.log(
      "Filter Value:",
      player.filterManager.data[filterName]?.[filterProperty]
    );

    if (
      player.filterManager.data[filterName] &&
      player.filterManager.data[filterName].hasOwnProperty(filterProperty)
    ) {
      player.filterManager.data[filterName][filterProperty] = value;
      await player.filterManager.applyPlayerFilters();

      await interaction.editReply(
        i18n.__("commands.music.filters.filterApplied", {
          filter: `${filterName} ${filterProperty} ${value}`,
        })
      );
    } else {
      return interaction.editReply(
        i18n.__("commands.music.filters.invalidFilterProperty")
      );
    }
  },

  async autocomplete(interaction) {
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      await interaction.respond([
        {
          name: i18n.__("commands.music.filters.noMusicPlaying"),
          value: "no music playing",
        },
      ]);
      return;
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("commands.music.filters.notInVoiceChannel"),
          ephemeral: true,
        });
      }
    }

    const focusedOption = interaction.options.getFocused(true);
    const filterName = interaction.options.getString("filter");

    let options = [];

    if (focusedOption.name === "filter") {
      options = Object.keys(player.filterManager.data)
        .filter(
          (filter) =>
            filter !== "pluginFilters" &&
            filter !== "channelMix" &&
            Object.keys(player.filterManager.data[filter]).length > 0
        )
        .map((filter) => ({
          name: filter,
          value: filter,
        }));
    } else if (focusedOption.name === "property" && filterName) {
      const filter = player.filterManager.data[filterName];
      options = Object.keys(filter)
        .filter((property) => typeof filter[property] === "number")
        .map((property) => ({
          name: property,
          value: property,
        }));
    }

    const filteredOptions = options.filter((option) =>
      option.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())
    );

    await interaction.respond(filteredOptions.slice(0, 25));
  },
};
