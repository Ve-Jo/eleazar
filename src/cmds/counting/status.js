import Database from "../../database/client.js";
import { EmbedBuilder } from "discord.js";

export default {
  data: () => {
    const subcommand = new LocalizedSubcommand({
      category: "counting",
      name: "status",
      localizationStrings: {
        name: {
          en: "status",
          ru: "статус",
          uk: "статус",
        },
        description: {
          en: "Show current counting channel status",
          ru: "Показать статус канала для счета",
          uk: "Показати статус каналу для рахунку",
        },
        not_setup: {
          en: "Counting channel is not set up in this server",
          ru: "Канал для счета не настроен на этом сервере",
          uk: "Канал для рахунку не налаштовано на цьому сервері",
        },
        channel_not_found: {
          en: "Counting channel not found. It may have been deleted.",
          ru: "Канал для счета не найден. Возможно, он был удален.",
          uk: "Канал для рахунку не знайдено. Можливо, його видалили.",
        },
        title: {
          en: "Counting Status",
          ru: "Статус счета",
          uk: "Статус рахунку",
        },
        channel: {
          en: "Channel",
          ru: "Канал",
          uk: "Канал",
        },
        current_count: {
          en: "Current Count",
          ru: "Текущий счет",
          uk: "Поточний рахунок",
        },
        pin_on_each: {
          en: "Pin on Each",
          ru: "Закреплять на каждые",
          uk: "Закріплювати на кожні",
        },
        disabled: {
          en: "Disabled",
          ru: "Отключено",
          uk: "Вимкнено",
        },
        pinned_role: {
          en: "Pinned Role",
          ru: "Закрепленная роль",
          uk: "Закріплена роль",
        },
        not_unique: {
          en: "(Not Unique)",
          ru: "(Не уникальная)",
          uk: "(Не унікальна)",
        },
        role_not_found: {
          en: "Role not found",
          ru: "Роль не найдена",
          uk: "Роль не знайдено",
        },
        restrictions: {
          en: "Restrictions",
          ru: "Ограничения",
          uk: "Обмеження",
        },
        only_numbers: {
          en: "• Only numbers allowed",
          ru: "• Разрешены только числа",
          uk: "• Дозволені лише числа",
        },
        no_same_user: {
          en: "• No consecutive counts by same user",
          ru: "• Нельзя считать два раза подряд",
          uk: "• Не можна рахувати два рази поспіль",
        },
        last_counter: {
          en: "Last Counter",
          ru: "Последний считающий",
          uk: "Останній рахуючий",
        },
        last_pinned: {
          en: "Last Pinned User",
          ru: "Последний закрепленный",
          uk: "Останній закріплений",
        },
      },
    });

    return subcommand;
  },
  async execute(interaction, i18n) {
    await interaction.deferReply();
    const { guild } = interaction;

    // Get current guild settings
    const guildData = await Database.client.guild.findUnique({
      where: { id: guild.id },
      select: { settings: true },
    });

    const countingSettings = guildData?.settings?.counting;

    if (!countingSettings) {
      return interaction.editReply({
        content: i18n.__("counting.status.not_setup"),
      });
    }

    // Get channel from ID
    const channel = await guild.channels
      .fetch(countingSettings.channel_id)
      .catch(() => null);
    if (!channel) {
      return interaction.editReply({
        content: i18n.__("counting.status.channel_not_found"),
      });
    }

    // Get role from ID if set
    let role = null;
    if (countingSettings.pinnedrole !== "0") {
      role = await guild.roles
        .fetch(countingSettings.pinnedrole)
        .catch(() => null);
    }

    // Create embed with channel information
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("counting.status.title"))
      .setColor(process.env.EMBED_COLOR)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: i18n.__("counting.status.channel"),
          value: `<#${countingSettings.channel_id}>`,
          inline: true,
        },
        {
          name: i18n.__("counting.status.current_count"),
          value: `${countingSettings.message || 0}`,
          inline: true,
        },
        {
          name: i18n.__("counting.status.pin_on_each"),
          value: `${
            countingSettings.pinoneach > 0
              ? countingSettings.pinoneach
              : i18n.__("counting.status.disabled")
          }`,
          inline: true,
        }
      );

    // Add pinned role field if applicable
    if (role) {
      embed.addFields({
        name: i18n.__("counting.status.pinned_role"),
        value: `<@&${role.id}> ${
          countingSettings.no_unique_role
            ? i18n.__("counting.status.not_unique")
            : ""
        }`,
        inline: true,
      });
    } else if (countingSettings.pinnedrole !== "0") {
      embed.addFields({
        name: i18n.__("counting.status.pinned_role"),
        value: i18n.__("counting.status.role_not_found"),
        inline: true,
      });
    }

    // Add restrictions
    const restrictions = [];
    if (countingSettings.only_numbers) {
      restrictions.push(i18n.__("counting.status.only_numbers"));
    }
    if (countingSettings.no_same_user) {
      restrictions.push(i18n.__("counting.status.no_same_user"));
    }

    if (restrictions.length > 0) {
      embed.addFields({
        name: i18n.__("counting.status.restrictions"),
        value: restrictions.join("\n"),
        inline: false,
      });
    }

    // Add last counter information if available
    if (countingSettings.lastwritter && countingSettings.lastwritter !== "0") {
      embed.addFields({
        name: i18n.__("counting.status.last_counter"),
        value: `<@${countingSettings.lastwritter}>`,
        inline: true,
      });
    }

    // Add last pinned member if available
    if (
      countingSettings.lastpinnedmember &&
      countingSettings.lastpinnedmember !== "0"
    ) {
      embed.addFields({
        name: i18n.__("counting.status.last_pinned"),
        value: `<@${countingSettings.lastpinnedmember}>`,
        inline: true,
      });
    }

    await interaction.editReply({
      embeds: [embed],
    });
  },
};
