import { SlashCommandSubcommandBuilder, PermissionsBitField } from "discord.js";
import Database from "../../database/client.js";

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
        content: i18n.__("commands.counting.no_perms"),
        ephemeral: true,
      });
    }

    // Get current guild settings
    const guildData = await Database.client.guild.findUnique({
      where: { id: guild.id },
      select: { settings: true },
    });

    if (!guildData?.settings?.counting?.channel_id) {
      return interaction.reply({
        content: i18n.__("commands.counting.no_channel"),
        ephemeral: true,
      });
    }

    // Update guild settings to remove counting data
    await Database.client.guild.update({
      where: { id: guild.id },
      data: {
        settings: {
          ...guildData.settings,
          counting: null,
        },
      },
    });

    await interaction.reply({
      content: i18n.__("commands.counting.remove.success"),
      ephemeral: true,
    });
  },
};
