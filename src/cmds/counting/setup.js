import { SlashCommandSubcommandBuilder } from "discord.js";
import i18n from "i18n";
import EconomyEZ from "../../utils/economy.js";

export default {
  data: new SlashCommandSubcommandBuilder()
    .setName("setup")
    .setDescription("Setup counting channel")
    .setDescriptionLocalizations({
      ru: "Установка канала для счета",
      uk: "Налаштування каналу для счета",
    })
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Select channel")
        .setRequired(true)
        .setDescriptionLocalizations({
          ru: "Выберите канал",
          uk: "Виберіть канал",
        })
    )
    .addNumberOption((option) =>
      option
        .setName("start_number")
        .setDescription("Set start number from what number counting will start")
        .setDescriptionLocalizations({
          ru: "Установите начальное число, с которого будет начинаться счет",
          uk: "Встановіть початкове число, з якого почнеться рахунок",
        })
    )
    .addNumberOption((option) =>
      option
        .setName("pin_on_each")
        .setDescription("Pin message every n number")
        .setRequired(false)
        .setDescriptionLocalizations({
          ru: "Закреплять сообщение на каждое ? число",
          uk: "Закріплювати повідомлення на кожне ? число",
        })
    )
    .addRoleOption((option) =>
      option
        .setName("pinned_role")
        .setDescription(
          "Set role to give for a user when her message is pinned"
        )
        .setRequired(false)
        .setDescriptionLocalizations({
          ru: "Роль, которую нужно дать пользователю, когда его сообщение закреплено",
          uk: "Роль, яку потрібно дати користувачу, коли його повідомлення закріплено",
        })
    )
    .addBooleanOption((option) =>
      option
        .setName("no_unique_role")
        .setDescription("Previous users with this role will not lose it")
        .setDescriptionLocalizations({
          ru: "Прошлые пользователи не будут терять эту роль",
          uk: "Прошлі користувачі не будуть втрачати цю роль",
        })
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName("only_numbers")
        .setDescription(
          "Only numbers are allowed in this channel (no other text after number)"
        )
        .setRequired(false)
        .setDescriptionLocalizations({
          ru: "Только числа в этом канале (нет других текстов после числа)",
          uk: "Тільки числа в цьому каналі (немає інших текстів після числа)",
        })
    )
    .addBooleanOption((option) =>
      option
        .setName("no_same_user")
        .setDescription("One person cant count twice or more in a row")
        .setRequired(false)
        .setDescriptionLocalizations({
          ru: "Один пользователь не может считать два и больше раз подряд",
          uk: "Один користувач не може рахувати два і більше разів підряд",
        })
    ),
  async execute(interaction) {
    const { guild } = interaction;

    //check if user has manage_channels perms
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return interaction.reply({
        content: i18n.__("no_perms"),
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

    await EconomyEZ.ensure(`counting.${guild.id}`);

    await EconomyEZ.set(`counting.${guild.id}`, {
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
};
