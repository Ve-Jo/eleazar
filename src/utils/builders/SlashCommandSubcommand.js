export class SlashCommandSubcommand {
  constructor(data = {}) {
    this.type = 1; // Subcommand type
    this.name = data.name || "";
    this.description = data.description || "";
    this.description_localizations = data.description_localizations || {};
    this.name_localizations = data.name_localizations || {};
    this.options = data.options || [];
  }

  addOption(option) {
    const json = option.toJSON();
    console.log(
      `Adding option to subcommand ${this.name}:`,
      JSON.stringify(json, null, 2)
    );
    this.options.push(json);
    return this;
  }

  toJSON() {
    const json = {
      type: this.type,
      name: this.name,
      description: this.description,
      description_localizations: this.description_localizations,
      name_localizations: this.name_localizations,
      options: this.options,
    };
    console.log(
      `Final Subcommand structure for ${this.name}:`,
      JSON.stringify(json, null, 2)
    );
    return json;
  }
}
