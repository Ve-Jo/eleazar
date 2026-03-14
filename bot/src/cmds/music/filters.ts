import { SlashCommandSubcommandBuilder } from "discord.js";

type TranslatorLike = {
  __: (key: string, variables?: Record<string, unknown>) => Promise<string>;
};

type FilterValue = number | string | boolean | null | undefined;

type PlayerLike = {
  voiceChannelId?: string | null;
  filterManager: {
    data: Record<string, Record<string, FilterValue>>;
    applyPlayerFilters: () => Promise<void>;
  };
};

type BaseInteractionLike = {
  client: {
    lavalink: {
      getPlayer: (guildId: string) => Promise<PlayerLike | null>;
    };
  };
  guild: { id: string };
  member: { voice: { channelId?: string | null } };
  options: {
    getString: (name: string) => string | null;
    getNumber: (name: string) => number | null;
    getFocused: (required: true) => { name: string; value: string };
  };
};

type CommandInteractionLike = BaseInteractionLike & {
  deferReply: () => Promise<unknown>;
  editReply: (payload: string | { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type AutocompleteInteractionLike = BaseInteractionLike & {
  respond: (options: Array<{ name: string; value: string }>) => Promise<unknown>;
};

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("filters")
      .setDescription("Set the music filters")
      .addStringOption((option) =>
        option
          .setName("filter")
          .setDescription("The filter to set")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addStringOption((option) =>
        option
          .setName("property")
          .setDescription("The property of the filter to set")
          .setRequired(true)
          .setAutocomplete(true),
      )
      .addNumberOption((option) =>
        option
          .setName("value")
          .setDescription("The value to set for the filter property")
          .setRequired(true),
      );
  },

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

  async execute(interaction: CommandInteractionLike, i18n: TranslatorLike): Promise<void> {
    await interaction.deferReply();
    const filterName = interaction.options.getString("filter");
    const filterProperty = interaction.options.getString("property");
    const value = interaction.options.getNumber("value");
    const player = await interaction.client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.editReply(await i18n.__("commands.music.filters.noMusicPlaying"));
      return;
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      await interaction.editReply({
        content: await i18n.__("commands.music.filters.notInVoiceChannel"),
        ephemeral: true,
      });
      return;
    }

    if (!filterName || !filterProperty || value === null) {
      await interaction.editReply(await i18n.__("commands.music.filters.invalidFilterProperty"));
      return;
    }

    const filterData = player.filterManager.data[filterName];
    if (filterData && Object.prototype.hasOwnProperty.call(filterData, filterProperty)) {
      filterData[filterProperty] = value;
      await player.filterManager.applyPlayerFilters();
      await interaction.editReply(
        await i18n.__("commands.music.filters.filterApplied", {
          filter: `${filterName} ${filterProperty} ${value}`,
        })
      );
      return;
    }

    await interaction.editReply(await i18n.__("commands.music.filters.invalidFilterProperty"));
  },

  async autocomplete(
    interaction: AutocompleteInteractionLike,
    i18n?: TranslatorLike
  ): Promise<void> {
    const player = await interaction.client.lavalink.getPlayer(interaction.guild.id);

    if (!player) {
      await interaction.respond([
        {
          name: i18n
            ? await i18n.__("commands.music.filters.noMusicPlaying")
            : "No music playing",
          value: "no music playing",
        },
      ]);
      return;
    }

    if (interaction.member.voice.channelId !== player.voiceChannelId) {
      await interaction.respond([]);
      return;
    }

    const focusedOption = interaction.options.getFocused(true);
    const filterName = interaction.options.getString("filter");
    let options: Array<{ name: string; value: string }> = [];

    if (focusedOption.name === "filter") {
      options = Object.keys(player.filterManager.data)
        .filter(
          (filter) =>
            filter !== "pluginFilters" &&
            filter !== "channelMix" &&
            Object.keys(player.filterManager.data[filter] || {}).length > 0,
        )
        .map((filter) => ({
          name: filter,
          value: filter,
        }));
    } else if (focusedOption.name === "property" && filterName) {
      const filter = player.filterManager.data[filterName];
      if (filter) {
        options = Object.keys(filter)
          .filter((property) => typeof filter[property] === "number")
          .map((property) => ({
            name: property,
            value: property,
          }));
      }
    }

    const filteredOptions = options.filter((option) =>
      option.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()),
    );

    await interaction.respond(filteredOptions.slice(0, 25));
  },
};

export default command;
