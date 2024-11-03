import { SlashCommandSubcommandBuilder } from "discord.js";
import { BaseCommandBuilder } from "./BaseCommandBuilder.js";

export class SubcommandBuilder extends BaseCommandBuilder {
  constructor(category, name) {
    super(category, name);
    this.builder = new SlashCommandSubcommandBuilder();
    this.options = [];
  }

  setBasicData() {
    const simpleName = this.getSimpleName(this.name);
    this.builder
      .setName(simpleName)
      .setDescription(this.translate("description"))
      .setNameLocalizations(this.getLocalizations("name"))
      .setDescriptionLocalizations(this.getLocalizations("description"));
    return this;
  }

  addStringOption(key, required = false, choices = null) {
    this.builder.addStringOption((option) => {
      const simpleName = this.getSimpleName(
        this.translate(`options.${key}.name`)
      );
      option
        .setName(simpleName)
        .setDescription(this.translate(`options.${key}.description`))
        .setRequired(required)
        .setNameLocalizations(this.getLocalizations(`options.${key}.name`))
        .setDescriptionLocalizations(
          this.getLocalizations(`options.${key}.description`)
        );

      if (choices) {
        option.addChoices(...choices);
      }

      return option;
    });
    return this;
  }

  addUserOption(key, required = false) {
    this.builder.addUserOption((option) => {
      const simpleName = this.getSimpleName(
        this.translate(`options.${key}.name`)
      );
      return option
        .setName(simpleName)
        .setDescription(this.translate(`options.${key}.description`))
        .setRequired(required)
        .setNameLocalizations(this.getLocalizations(`options.${key}.name`))
        .setDescriptionLocalizations(
          this.getLocalizations(`options.${key}.description`)
        );
    });
    return this;
  }

  addAttachmentOption(key, required = false) {
    this.builder.addAttachmentOption((option) => {
      const simpleName = this.getSimpleName(
        this.translate(`options.${key}.name`)
      );
      return option
        .setName(simpleName)
        .setDescription(this.translate(`options.${key}.description`))
        .setRequired(required)
        .setNameLocalizations(this.getLocalizations(`options.${key}.name`))
        .setDescriptionLocalizations(
          this.getLocalizations(`options.${key}.description`)
        );
    });
    return this;
  }

  addIntegerOption(key, required = false, { minValue, maxValue } = {}) {
    this.builder.addIntegerOption((option) => {
      const simpleName = this.getSimpleName(
        this.translate(`options.${key}.name`)
      );
      option
        .setName(simpleName)
        .setDescription(this.translate(`options.${key}.description`))
        .setRequired(required)
        .setNameLocalizations(this.getLocalizations(`options.${key}.name`))
        .setDescriptionLocalizations(
          this.getLocalizations(`options.${key}.description`)
        );

      if (minValue !== undefined) option.setMinValue(minValue);
      if (maxValue !== undefined) option.setMaxValue(maxValue);

      return option;
    });
    return this;
  }

  toJSON() {
    return this.builder.toJSON();
  }
}
