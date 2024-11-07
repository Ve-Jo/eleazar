export class SlashCommand {
  constructor(data = {}) {
    this.name = data.name || "";
    this.description = data.description || "";
    this.type = 1; // CHAT_INPUT type
    this.description_localizations = data.description_localizations || {};
    this.name_localizations = data.name_localizations || {};
    this.options = data.options || [];
    this.default_member_permissions = data.default_member_permissions;
    this.dm_permission = data.dm_permission;
  }

  addSubcommand(subcommand) {
    const json = subcommand.toJSON();
    this.options.push(json);
    return this;
  }

  toJSON() {
    const json = {
      name: this.name,
      description: this.description,
      type: this.type,
      description_localizations: this.description_localizations,
      name_localizations: this.name_localizations,
      options: this.options,
      default_member_permissions: this.default_member_permissions,
      dm_permission: this.dm_permission,
    };
    return json;
  }
}
