import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("music", "filters");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Add filter option
    const filterOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "filter",
      description: i18nBuilder.translateOption("filter", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("filter", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "filter",
        "description"
      ),
      autocomplete: true,
    });

    // Add property option
    const propertyOption = new SlashCommandOption({
      type: OptionType.STRING,
      name: "property",
      description: i18nBuilder.translateOption("property", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "property",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "property",
        "description"
      ),
      autocomplete: true,
    });

    // Add value option
    const valueOption = new SlashCommandOption({
      type: OptionType.NUMBER,
      name: "value",
      description: i18nBuilder.translateOption("value", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("value", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "value",
        "description"
      ),
    });

    subcommand.addOption(filterOption);
    subcommand.addOption(propertyOption);
    subcommand.addOption(valueOption);

    return subcommand;
  },
  async execute(interaction) {
    await interaction.deferReply();
    const filterName = interaction.options.getString("filter");
    const filterProperty = interaction.options.getString("property");
    const value = interaction.options.getNumber("value");
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
        i18n.__("music.filters.filterApplied", {
          filter: `${filterName} ${filterProperty} ${value}`,
        })
      );
    } else {
      return interaction.editReply(
        i18n.__("music.filters.invalidFilterProperty")
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
          name: i18n.__("music.noMusicPlaying"),
          value: "no music playing",
        },
      ]);
      return;
    } else {
      if (interaction.member.voice.channelId !== player.voiceChannelId) {
        return interaction.editReply({
          content: i18n.__("music.notInVoiceChannel"),
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
  localization_strings: {
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
    options: {
      filter: {
        name: {
          en: "filter",
          ru: "фильтр",
          uk: "фільтр",
        },
        description: {
          en: "The filter to set",
          ru: "Фильтр для установки",
          uk: "Фільтр для встановлення",
        },
      },
      property: {
        name: {
          en: "property",
          ru: "свойство",
          uk: "властивість",
        },
        description: {
          en: "The property of the filter to set",
          ru: "Свойство фильтра для установки",
          uk: "Властивість фільтра для встановлення",
        },
      },
      value: {
        name: {
          en: "value",
          ru: "значение",
          uk: "значення",
        },
        description: {
          en: "The value to set for the filter property",
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
  },
};
