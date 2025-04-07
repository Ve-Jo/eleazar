import {
  LocalizedSubcommand,
  LocalizedOption,
  OptionType,
} from "../../utils/builders/index.js";
import Database from "../../database/client.js";
import { PermissionsBitField } from "discord.js";

export default {
  data: () => {
    // Create a localized subcommand with category and name
    const subcommand = new LocalizedSubcommand({
      category: "counting",
      name: "setup",
      localizationStrings: {
        name: {
          en: "setup",
          ru: "установить",
          uk: "встановити",
        },
        description: {
          en: "Setup counting channel",
          ru: "Установка канала для счета",
          uk: "Налаштування каналу для счета",
        },
        no_perms: {
          en: "You don't have permissions to manage channels",
          ru: "У вас нет прав на управление каналами",
          uk: "У вас немає прав на керування каналами",
        },
        success: {
          en: "Counting channel setup successfully",
          ru: "Канал для счета настроен успешно",
          uk: "Канал для рахунку налаштовано успішно",
        },
      },
    });

    // Channel option
    const channelOption = new LocalizedOption({
      name: "channel",
      description: "Select channel",
      type: OptionType.CHANNEL,
      required: true,
      name_localizations: {
        ru: "канал",
        uk: "канал",
      },
      description_localizations: {
        ru: "Выберите канал",
        uk: "Виберіть канал",
      },
    });

    // Start number option
    const startNumberOption = new LocalizedOption({
      name: "start_number",
      description: "Start number from what number counting will start",
      type: OptionType.NUMBER,
      required: false,
      name_localizations: {
        ru: "начальное_число",
        uk: "початкове_число",
      },
      description_localizations: {
        ru: "Начальное число, с которого будет начинаться счет",
        uk: "Початкове число, з якого почнеться рахунок",
      },
    });

    // Pin on each option
    const pinOnEachOption = new LocalizedOption({
      name: "pin_on_each",
      description: "Pin message every n number",
      type: OptionType.NUMBER,
      required: false,
      name_localizations: {
        ru: "закреплять_на_каждом",
        uk: "закріплювати_на_кожному",
      },
      description_localizations: {
        ru: "Закреплять сообщение на каждое ? число",
        uk: "Закріплювати повідомлення на кожне ? число",
      },
    });

    // Pinned role option
    const pinnedRoleOption = new LocalizedOption({
      name: "pinned_role",
      description: "Set role to give for a user when her message is pinned",
      type: OptionType.ROLE,
      required: false,
      name_localizations: {
        ru: "закрепленная_роль",
        uk: "закріплена_роль",
      },
      description_localizations: {
        ru: "Выдача роли пользователю когда его сообщение закреплено",
        uk: "Роль яку потрібно дати користувачу, коли його повідомлення закріплено",
      },
    });

    // No unique role option
    const noUniqueRoleOption = new LocalizedOption({
      name: "no_unique_role",
      description: "Previous users with this role will not lose it",
      type: OptionType.BOOLEAN,
      required: false,
      name_localizations: {
        ru: "не_уникальная_роль",
        uk: "не_унікальна_роль",
      },
      description_localizations: {
        ru: "Прошлые пользователи не будут терять эту роль",
        uk: "Прошлі користувачі не будуть втрачати цю роль",
      },
    });

    // Only numbers option
    const onlyNumbersOption = new LocalizedOption({
      name: "only_numbers",
      description:
        "Only numbers are allowed in this channel (no other text after number)",
      type: OptionType.BOOLEAN,
      required: false,
      name_localizations: {
        ru: "только_числа",
        uk: "тільки_числа",
      },
      description_localizations: {
        ru: "Только числа в этом канале (нет других текстов после числа)",
        uk: "Тільки числа в цьому каналі (немає інших текстів після числа)",
      },
    });

    // No same user option
    const noSameUserOption = new LocalizedOption({
      name: "no_same_user",
      description: "One person cant count twice or more in a row",
      type: OptionType.BOOLEAN,
      required: false,
      name_localizations: {
        ru: "без_повторений",
        uk: "без_повторень",
      },
      description_localizations: {
        ru: "Один пользователь не может считать два и больше раз подряд",
        uk: "Один користувач не може рахувати два і більше разів підряд",
      },
    });

    // Add options to the subcommand
    subcommand.addOption(channelOption);
    subcommand.addOption(startNumberOption);
    subcommand.addOption(pinOnEachOption);
    subcommand.addOption(pinnedRoleOption);
    subcommand.addOption(noUniqueRoleOption);
    subcommand.addOption(onlyNumbersOption);
    subcommand.addOption(noSameUserOption);

    return subcommand;
  },
  async execute(interaction, i18n) {
    const { guild } = interaction;

    //check if user has manage_channels perms
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return interaction.reply({
        content: i18n.__("counting.setup.no_perms"),
        ephemeral: true,
      });
    }

    const channel = interaction.options.getChannel("channel");
    const startNumber = interaction.options.getNumber("start_number") || 1;
    const pinOneEach = interaction.options.getNumber("pin_on_each") || 0;
    const pinnedRole = interaction.options.getRole("pinned_role") || {
      id: "0",
    };
    const onlyNumbers = interaction.options.getBoolean("only_numbers") || false;
    const noSameUser = interaction.options.getBoolean("no_same_user") || false;
    const noUniqueRole =
      interaction.options.getBoolean("no_unique_role") || false;

    // Get current guild settings
    const guildData = await Database.client.guild.findUnique({
      where: { id: guild.id },
      select: { settings: true },
    });

    // Update guild settings with new counting data
    await Database.client.guild.upsert({
      where: { id: guild.id },
      create: {
        id: guild.id,
        settings: {
          counting: {
            channel_id: channel.id,
            message: startNumber,
            pinoneach: pinOneEach,
            pinnedrole: pinnedRole.id,
            only_numbers: onlyNumbers,
            no_same_user: noSameUser,
            lastwritter: "0",
            no_unique_role: noUniqueRole,
            lastpinnedmember: "0",
          },
        },
      },
      update: {
        settings: {
          ...guildData?.settings,
          counting: {
            channel_id: channel.id,
            message: startNumber,
            pinoneach: pinOneEach,
            pinnedrole: pinnedRole.id,
            only_numbers: onlyNumbers,
            no_same_user: noSameUser,
            lastwritter: "0",
            no_unique_role: noUniqueRole,
            lastpinnedmember: "0",
          },
        },
      },
    });

    await interaction.reply({
      content: i18n.__("counting.setup.success", {
        channel: channel.name,
        number: startNumber,
        pinoneach: pinOneEach,
        pinnedrole: pinnedRole.name || "None",
        only_numbers: onlyNumbers,
        no_same_user: noSameUser,
        no_unique_role: noUniqueRole,
      }),
      ephemeral: true,
    });
  },
};
