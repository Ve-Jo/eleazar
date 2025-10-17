import { SlashCommandSubcommandBuilder, PermissionsBitField } from "discord.js";
import hubClient from "../../api/hubClient.js";

export default {
  data: () => {
    const builder = new SlashCommandSubcommandBuilder()
      .setName("setup")
      .setDescription("Setup counting channel")
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Select channel")
          .setRequired(true),
      )
      .addNumberOption((option) =>
        option
          .setName("start_number")
          .setDescription("Start number from what number counting will start")
          .setRequired(false),
      )
      .addNumberOption((option) =>
        option
          .setName("pin_on_each")
          .setDescription("Pin message every n number")
          .setRequired(false),
      )
      .addRoleOption((option) =>
        option
          .setName("pinned_role")
          .setDescription(
            "Set role to give for a user when her message is pinned",
          )
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("no_unique_role")
          .setDescription("Previous users with this role will not lose it")
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("only_numbers")
          .setDescription(
            "Only numbers are allowed in this channel (no other text after number)",
          )
          .setRequired(false),
      )
      .addBooleanOption((option) =>
        option
          .setName("no_same_user")
          .setDescription("One person cant count twice or more in a row")
          .setRequired(false),
      );

    return builder;
  },

  localization_strings: {
    command: {
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
    },
    options: {
      channel: {
        name: {
          ru: "канал",
          uk: "канал",
        },
        description: {
          ru: "Выберите канал",
          uk: "Виберіть канал",
        },
      },
      start_number: {
        name: {
          ru: "начальное_число",
          uk: "початкове_число",
        },
        description: {
          ru: "Начальное число, с которого будет начинаться счет",
          uk: "Початкове число, з якого почнеться рахунок",
        },
      },
      pin_on_each: {
        name: {
          ru: "закреплять_на_каждом",
          uk: "закріплювати_на_кожному",
        },
        description: {
          ru: "Закреплять сообщение на каждое ? число",
          uk: "Закріплювати повідомлення на кожне ? число",
        },
      },
      pinned_role: {
        name: {
          ru: "закрепленная_роль",
          uk: "закріплена_роль",
        },
        description: {
          ru: "Выдача роли пользователю когда его сообщение закреплено",
          uk: "Роль яку потрібно дати користувачу, коли його повідомлення закріплено",
        },
      },
      no_unique_role: {
        name: {
          ru: "не_уникальная_роль",
          uk: "не_унікальна_роль",
        },
        description: {
          ru: "Прошлые пользователи не будут терять эту роль",
          uk: "Прошлі користувачі не будуть втрачати цю роль",
        },
      },
      only_numbers: {
        name: {
          ru: "только_числа",
          uk: "тільки_числа",
        },
        description: {
          ru: "Только числа в этом канале (нет других текстов после числа)",
          uk: "Тільки числа в цьому каналі (немає інших текстів після числа)",
        },
      },
      no_same_user: {
        name: {
          ru: "без_повторений",
          uk: "без_повторень",
        },
        description: {
          ru: "Один пользователь не может считать два и больше раз подряд",
          uk: "Один користувач не може рахувати два і більше разів підряд",
        },
      },
    },
    success: {
      en: "Counting channel setup successfully",
      ru: "Канал для счета настроен успешно",
      uk: "Канал для рахунку налаштовано успішно",
    },
  },

  async execute(interaction, i18n) {
    const { guild } = interaction;

    // Check if user has manage_channels perms
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels,
      )
    ) {
      return interaction.reply({
        content: await i18n.__("commands.counting.no_perms"),
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

    await hubClient.setupCounting(
      interaction.guild.id,
      channel.id,
      startNumber,
      pinOneEach,
      pinnedRole.id,
      onlyNumbers,
      noSameUser,
      noUniqueRole,
    );

    await interaction.reply({
      content: await i18n.__("commands.counting.setup.success", {
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
