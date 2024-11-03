import { SlashCommandBuilder } from "discord.js";
import { BaseCommandBuilder } from "./BaseCommandBuilder.js";

export class CommandBuilder extends BaseCommandBuilder {
  constructor(category) {
    super(category);
    this.builder = new SlashCommandBuilder();
  }

  setBasicData() {
    const name = this.category.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    return this.builder
      .setName(name)
      .setDescription(this.translate("description"))
      .setNameLocalizations(this.getLocalizations("name"))
      .setDescriptionLocalizations(this.getLocalizations("description"));
  }

  addOption(optionBuilder) {
    this.builder.addSubcommand(optionBuilder);
    return this;
  }

  toJSON() {
    return this.builder.toJSON();
  }
}
