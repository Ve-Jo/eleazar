import { Events } from "discord.js";

type AutocompleteInteractionLike = {
  isAutocomplete: () => boolean;
  commandName: string;
  client: {
    commands: {
      get: (name: string) => {
        autocomplete?: (interaction: AutocompleteInteractionLike) => Promise<unknown>;
      } | null | undefined;
    };
  };
};

const event = {
  name: Events.InteractionCreate,
  async execute(interaction: AutocompleteInteractionLike): Promise<void> {
    if (!interaction.isAutocomplete()) {
      return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.autocomplete?.(interaction);
    } catch (error) {
      console.error(error);
    }
  },
};

export default event;
