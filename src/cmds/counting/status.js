import { SlashCommandSubcommandBuilder } from "discord.js";
import Database from "../../database/client.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("status")
      .setDescription("Show counting channel status");

    return builder;
  },

  localization_strings: {
    command: {
      name: {
        en: "status",
        ru: "статус",
        uk: "статус",
      },
      description: {
        en: "Show counting channel status",
        ru: "Показать статус канала для счета",
        uk: "Показати статус каналу для рахунку",
      },
    },
    status: {
      en: "Counting channel status:\nChannel: {{channel}}\nCurrent number: {{number}}\nPin on each: {{pinoneach}}\nPinned role: {{pinnedrole}}\nOnly numbers: {{only_numbers}}\nNo same user: {{no_same_user}}\nNo unique role: {{no_unique_role}}",
      ru: "Статус канала для счета:\nКанал: {{channel}}\nТекущее число: {{number}}\nЗакреплять на каждом: {{pinoneach}}\nЗакрепленная роль: {{pinnedrole}}\nТолько числа: {{only_numbers}}\nБез повторений: {{no_same_user}}\nНе уникальная роль: {{no_unique_role}}",
      uk: "Статус каналу для рахунку:\nКанал: {{channel}}\nПоточне число: {{number}}\nЗакріплювати на кожному: {{pinoneach}}\nЗакріплена роль: {{pinnedrole}}\nТільки числа: {{only_numbers}}\nБез повторень: {{no_same_user}}\nНе унікальна роль: {{no_unique_role}}",
    },
  },

  async execute(interaction, i18n) {
    const { guild } = interaction;

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

    const channel = await guild.channels.fetch(
      guildData.settings.counting.channel_id
    );
    const pinnedRole = guildData.settings.counting.pinnedrole
      ? await guild.roles.fetch(guildData.settings.counting.pinnedrole)
      : null;

    await interaction.reply({
      content: i18n.__("commands.counting.status.status", {
        channel: channel?.name || "Unknown",
        number: guildData.settings.counting.message,
        pinoneach: guildData.settings.counting.pinoneach || "None",
        pinnedrole: pinnedRole?.name || "None",
        only_numbers: guildData.settings.counting.only_numbers ? "Yes" : "No",
        no_same_user: guildData.settings.counting.no_same_user ? "Yes" : "No",
        no_unique_role: guildData.settings.counting.no_unique_role
          ? "Yes"
          : "No",
      }),
      ephemeral: true,
    });
  },
};
