import { handleRemoveBanner } from "../cmds/images/setbanner.js";
import { Events } from "discord.js";

export default {
  name: Events.InteractionCreate,
  essential: true,
  async execute(interaction) {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("remove_banner:")) {
        await handleRemoveBanner(interaction);
        return;
      }
    }
  },
};
