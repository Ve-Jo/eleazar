import {
  SlashCommandSubcommand,
  SlashCommandOption,
  OptionType,
  I18nCommandBuilder,
} from "../../utils/builders/index.js";
import EconomyEZ from "../../utils/economy.js";
import { PermissionsBitField } from "discord.js";
import i18n from "../../utils/i18n.js";

export default {
  data: () => {
    const i18nBuilder = new I18nCommandBuilder("counting", "setup");

    const subcommand = new SlashCommandSubcommand({
      name: i18nBuilder.getSimpleName(i18nBuilder.translate("name")),
      description: i18nBuilder.translate("description"),
      name_localizations: i18nBuilder.getLocalizations("name"),
      description_localizations: i18nBuilder.getLocalizations("description"),
    });

    // Channel option
    const channelOption = new SlashCommandOption({
      type: OptionType.CHANNEL,
      name: "channel",
      description: i18nBuilder.translateOption("channel", "description"),
      required: true,
      name_localizations: i18nBuilder.getOptionLocalizations("channel", "name"),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "channel",
        "description"
      ),
    });

    // Start number option
    const startNumberOption = new SlashCommandOption({
      type: OptionType.NUMBER,
      name: "start_number",
      description: i18nBuilder.translateOption("start_number", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "start_number",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "start_number",
        "description"
      ),
    });

    // Pin on each option
    const pinOnEachOption = new SlashCommandOption({
      type: OptionType.NUMBER,
      name: "pin_on_each",
      description: i18nBuilder.translateOption("pin_on_each", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "pin_on_each",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "pin_on_each",
        "description"
      ),
    });

    // Pinned role option
    const pinnedRoleOption = new SlashCommandOption({
      type: OptionType.ROLE,
      name: "pinned_role",
      description: i18nBuilder.translateOption("pinned_role", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "pinned_role",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "pinned_role",
        "description"
      ),
    });

    // No unique role option
    const noUniqueRoleOption = new SlashCommandOption({
      type: OptionType.BOOLEAN,
      name: "no_unique_role",
      description: i18nBuilder.translateOption("no_unique_role", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "no_unique_role",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "no_unique_role",
        "description"
      ),
    });

    // Only numbers option
    const onlyNumbersOption = new SlashCommandOption({
      type: OptionType.BOOLEAN,
      name: "only_numbers",
      description: i18nBuilder.translateOption("only_numbers", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "only_numbers",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "only_numbers",
        "description"
      ),
    });

    // No same user option
    const noSameUserOption = new SlashCommandOption({
      type: OptionType.BOOLEAN,
      name: "no_same_user",
      description: i18nBuilder.translateOption("no_same_user", "description"),
      required: false,
      name_localizations: i18nBuilder.getOptionLocalizations(
        "no_same_user",
        "name"
      ),
      description_localizations: i18nBuilder.getOptionLocalizations(
        "no_same_user",
        "description"
      ),
    });

    subcommand.addOption(channelOption);
    subcommand.addOption(startNumberOption);
    subcommand.addOption(pinOnEachOption);
    subcommand.addOption(pinnedRoleOption);
    subcommand.addOption(noUniqueRoleOption);
    subcommand.addOption(onlyNumbersOption);
    subcommand.addOption(noSameUserOption);

    return subcommand;
  },
  async execute(interaction) {
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
    const pinnedRole = interaction.options.getRole("pinned_role") || 0;
    const onlyNumbers = interaction.options.getBoolean("only_numbers") || false;
    const noSameUser = interaction.options.getBoolean("no_same_user") || false;
    const noUniqueRole =
      interaction.options.getBoolean("no_unique_role") || false;

    await EconomyEZ.set(`${guild.id}.counting`, {
      channel_id: channel.id,
      message: startNumber,
      pinoneach: pinOneEach,
      pinnedrole: pinnedRole.id,
      only_numbers: onlyNumbers,
      no_same_user: noSameUser,
      lastwritter: "0",
      no_unique_role: noUniqueRole,
    });

    await interaction.reply({
      content: i18n.__("counting.setup.success", {
        channel: channel.name,
        number: startNumber,
        pinoneach: pinOneEach,
        pinnedrole: pinnedRole.name,
        only_numbers: onlyNumbers,
        no_same_user: noSameUser,
        no_unique_role: noUniqueRole,
      }),
      ephemeral: true,
    });
  },
  localization_strings: {
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
    options: {
      channel: {
        name: {
          en: "channel",
          ru: "канал",
          uk: "канал",
        },
        description: {
          en: "Select channel",
          ru: "Выберите канал",
          uk: "Виберіть канал",
        },
      },
      start_number: {
        name: {
          en: "start_number",
          ru: "начальное_число",
          uk: "початкове_число",
        },
        description: {
          en: "Start number from what number counting will start",
          ru: "Начальное число, с которого будет начинаться счет",
          uk: "Початкове число, з якого почнеться рахунок",
        },
      },
      pin_on_each: {
        name: {
          en: "pin_on_each",
          ru: "закреплять_на_каждом",
          uk: "закріплювати_на_кожному",
        },
        description: {
          en: "Pin message every n number",
          ru: "Закреплять сообщение на каждое ? число",
          uk: "Закріплювати повідомлення на кожне ? число",
        },
      },
      pinned_role: {
        name: {
          en: "pinned_role",
          ru: "закрепленная_роль",
          uk: "закріплена_роль",
        },
        description: {
          en: "Set role to give for a user when her message is pinned",
          ru: "Выдача роли пользователю когда его сообщение закреплено",
          uk: "Роль яку потрібно дати користувачу, коли його повідомлення закріплено",
        },
      },
      no_unique_role: {
        name: {
          en: "no_unique_role",
          ru: "не_уникальная_роль",
          uk: "не_унікальна_роль",
        },
        description: {
          en: "Previous users with this role will not lose it",
          ru: "Прошлые пользователи не будут терять эту роль",
          uk: "Прошлі користувачі не будуть втрачати цю роль",
        },
      },
      only_numbers: {
        name: {
          en: "only_numbers",
          ru: "только_числа",
          uk: "тільки_числа",
        },
        description: {
          en: "Only numbers are allowed in this channel (no other text after number)",
          ru: "Только числа в этом канале (нет других текстов после числа)",
          uk: "Тільки числа в цьому каналі (немає інших текстів після числа)",
        },
      },
      no_same_user: {
        name: {
          en: "no_same_user",
          ru: "без_повторений",
          uk: "без_повторень",
        },
        description: {
          en: "One person cant count twice or more in a row",
          ru: "Один пользователь не может считать два и больше раз подряд",
          uk: "Один користувач не може рахувати два і більше разів підряд",
        },
      },
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
};
