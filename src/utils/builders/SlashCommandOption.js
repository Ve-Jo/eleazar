export class SlashCommandOption {
  constructor(data = {}) {
    this.type = data.type;
    this.name = data.name || "";
    this.description = data.description || "";
    this.required = data.required || false;
    this.description_localizations = data.description_localizations || {};
    this.name_localizations = data.name_localizations || {};
    this.choices = data.choices || [];
    this.min_value = data.min_value;
    this.max_value = data.max_value;
  }

  toJSON() {
    const json = {
      type: this.type,
      name: this.name,
      description: this.description,
      required: this.required,
      description_localizations: this.description_localizations,
      name_localizations: this.name_localizations,
      ...(this.choices.length > 0 && { choices: this.choices }),
      ...(this.min_value !== undefined && { min_value: this.min_value }),
      ...(this.max_value !== undefined && { max_value: this.max_value }),
    };
    return json;
  }
}
