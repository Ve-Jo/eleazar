import { SlashCommandSubcommandBuilder, PermissionsBitField } from "discord.js";
import hubClient from "../../api/hubClient.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("remove")
      .setDescription("Remove counting channel");

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        en: "remove",
        ru: "удалить",
        uk: "видалити",
      },
      description: {
        en: "Remove counting channel",
        ru: "Удалить канал для счета",
        uk: "Видалити канал для рахунку",
      },
    },
    success: {
      en: "Counting channel has been removed",
      ru: "Канал для счета был удален",
      uk: "Канал для рахунку був видалений",
    },
  },

  async execute(interaction, i18n) {
    const { guild } = interaction;

    // Check if user has manage_channels perms
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_perms"),
        ephemeral: true,
      });
    }

    // Get current guild settings
    const guildData = await hubClient.getGuild(interaction.guild.id);

    if (!guildData?.settings?.counting?.channel_id) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_channel"),
        ephemeral: true,
      });
    }

    // Update guild settings to remove counting data
    await hubClient.removeCounting(interaction.guild.id);

    await interaction.reply({
      content: await i18n.__("commands.counting.remove.success"),
      ephemeral: true,
    });
  },
};
