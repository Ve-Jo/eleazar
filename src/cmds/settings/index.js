import { SlashCommandBuilder, PermissionsBitField } from "discord.js";
import EconomyEZ from "../../utils/economy";
import i18n from "../../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Settings for the bot")
    .setDescriptionLocalizations({
      ru: "Настройки для бота",
      uk: "Налаштування для бота",
    })
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leveling")
        .setDescription("Leveling settings")
        .setNameLocalizations({
          ru: "уровни",
          uk: "рівні",
        })
        .setDescriptionLocalizations({
          ru: "Настройки уровней",
          uk: "Налаштування рівнів",
        })
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Name of the setting")
            .setDescriptionLocalizations({
              ru: "Название настройки",
              uk: "Назва налаштування",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addNumberOption((option) =>
          option
            .setName("value")
            .setDescription("Value of the setting")
            .setDescriptionLocalizations({
              ru: "Значение настройки",
              uk: "Значення налаштування",
            })
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  server: true,
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const { name, value } = focusedOption;

    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      await interaction.respond([
        { name: i18n.__("no_perms"), value: "error" },
      ]);
      return;
    }

    console.log(`Filling option: ${name}, current value: ${value}`);

    let choices = [];
    let serverOptions = {};

    serverOptions = (
      await EconomyEZ.get(`economy_config.${interaction.guild.id}`)
    )[0];

    if (!serverOptions) {
      await interaction.respond([
        { name: i18n.__("settings.noSettingsFound"), value: "error" },
      ]);
      return;
    }

    if (name === "name") {
      let keys = Object.keys(serverOptions).filter(
        (key) => key !== "id" && key !== "guild_id"
      );
      console.log("Available keys:", keys);
      if (keys.length > 0) {
        choices = keys.map((key) => ({ name: key, value: key }));
      }
    } else if (name === "value") {
      const selectedName = interaction.options.getString("name", true);
      console.log("Selected name:", selectedName);

      if (serverOptions[selectedName] !== undefined) {
        const currentValue = serverOptions[selectedName].toString();
        choices = [
          {
            name: i18n.__("settings.currentValue", {
              currentValue,
              newValue: value || "",
            }),
            value: value || currentValue,
          },
        ];
      } else {
        choices = [
          { name: i18n.__("settings.invalidSettingName"), value: "error" },
        ];
      }
    }

    const filtered = choices.filter((choice) =>
      choice.name.toLowerCase().includes(value.toLowerCase())
    );

    console.log("Filtered choices:", filtered);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice.name, value: choice.value }))
    );
  },
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    console.log(subcommand);

    if (subcommand === "leveling") {
      const name = interaction.options.getString("name");
      const value = interaction.options.getNumber("value");

      if (value === "error") {
        await interaction.reply(i18n.__("settings.invalidSettingName"));
        return;
      }

      console.log(`Setting ${name} to ${value}`);

      await EconomyEZ.set(
        `economy_config.${interaction.guild.id}.${name}`,
        value
      );
      await interaction.reply(
        i18n.__("settings.settingUpdated", { name, value })
      );
      return;
    }

    await interaction.reply(i18n.__("settings.subcommandNotFound"));
  },
};
