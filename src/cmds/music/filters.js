import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("filters")
    .setDescription("Set the music filters")
    .setDescriptionLocalizations({
      ru: "Установить фильтры музыки",
      uk: "Встановити фільтри музики",
    })
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("The filter to set")
        .setDescriptionLocalizations({
          ru: "Фильтр для установки",
          uk: "Фільтр для встановлення",
        })
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("property")
        .setDescription("The property of the filter to set")
        .setDescriptionLocalizations({
          ru: "Свойство фильтра для установки",
          uk: "Властивість фільтра для встановлення",
        })
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addNumberOption((option) =>
      option
        .setName("value")
        .setDescription("The value to set for the filter property")
        .setDescriptionLocalizations({
          ru: "Значение для установки свойства фильтра",
          uk: "Значення для встановлення властивості фільтра",
        })
        .setRequired(true)
    ),

  async execute(interaction) {
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
        i18n.__("music.filterApplied", {
          filter: `${filterName} ${filterProperty} ${value}`,
        })
      );
    } else {
      return interaction.editReply(i18n.__("music.invalidFilterProperty"));
    }
  },

  async autocomplete(interaction) {
    const player = await interaction.client.lavalink.getPlayer(
      interaction.guild.id
    );

    if (!player) {
      await interaction.respond([
        {
          name: "No music playing",
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
};
