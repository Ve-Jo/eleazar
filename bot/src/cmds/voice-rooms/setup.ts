import {
  ChannelType,
  PermissionsBitField,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import {
  translateVoiceRooms,
  updateVoiceRoomsSettings,
} from "../../utils/voiceRooms.ts";

import "../../utils/voiceRoomsLocalization.ts";
import type { TranslatorLike, InteractionLike } from "../../types/index.ts";

const command = {
  data: (): SlashCommandSubcommandBuilder => {
    return new SlashCommandSubcommandBuilder()
      .setName("setup")
      .setDescription("Setup join-to-create voice rooms")
      .addChannelOption((option) =>
        option
          .setName("join_channel")
          .setDescription("Select a join-to-create voice channel")
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(false)
      )
      .addChannelOption((option) =>
        option
          .setName("panel_channel")
          .setDescription("Text channel for room control panel messages")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
      .addChannelOption((option) =>
        option
          .setName("category")
          .setDescription("Category to place new voice rooms in")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("waiting_rooms")
          .setDescription("Create a waiting room for each voice room")
          .setRequired(false)
      )
      .addChannelOption((option) =>
        option
          .setName("waiting_category")
          .setDescription("Category to place waiting rooms in")
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(false)
      );
  },

  localization_strings: {
    command: {
      name: { en: "setup", ru: "настроить", uk: "налаштувати" },
      description: {
        en: "Setup join-to-create voice rooms",
        ru: "Настроить голосовые комнаты",
        uk: "Налаштувати голосові кімнати",
      },
    },
    options: {
      join_channel: {
        name: { ru: "канал_входа", uk: "канал_входу" },
        description: {
          ru: "Канал для создания комнат",
          uk: "Канал для створення кімнат",
        },
      },
      panel_channel: {
        name: { ru: "канал_панели", uk: "канал_панелі" },
        description: {
          ru: "Текстовый канал для панели управления",
          uk: "Текстовий канал для панелі керування",
        },
      },
      category: {
        name: { ru: "категория", uk: "категорія" },
        description: {
          ru: "Категория для новых комнат",
          uk: "Категорія для нових кімнат",
        },
      },
      waiting_rooms: {
        name: { ru: "комнаты_ожидания", uk: "кімнати_очікування" },
        description: {
          ru: "Создавать отдельные комнаты ожидания",
          uk: "Створювати окремі кімнати очікування",
        },
      },
      waiting_category: {
        name: { ru: "категория_ожидания", uk: "категорія_очікування" },
        description: {
          ru: "Категория для комнат ожидания",
          uk: "Категорія для кімнат очікування",
        },
      },
    },
  },

  async execute(interaction: InteractionLike, i18n: TranslatorLike): Promise<unknown> {
    if (!interaction.guild) return;
    if (!interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({
        content: await i18n.__("commands.voice-rooms.no_perms"),
        ephemeral: true,
      });
    }

    const locale =
      interaction.locale || i18n.getLocale?.() || "en";

    const joinChannel = interaction.options.getChannel!("join_channel");
    const panelChannel = interaction.options.getChannel!("panel_channel");
    const category = interaction.options.getChannel!("category");
    const waitingCategory = interaction.options.getChannel!("waiting_category");
    const waitingRoomsEnabled = interaction.options.getBoolean?.("waiting_rooms");

    let resolvedJoinChannel = joinChannel;

    if (!resolvedJoinChannel) {
      const joinName = await translateVoiceRooms(
        "voiceRooms.general.joinToCreateName",
        locale
      );

      if (!interaction.guild.channels?.create) {
        return interaction.reply({
          content: "Unable to create channels",
          ephemeral: true,
        });
      }

      resolvedJoinChannel = await interaction.guild.channels.create({
        name: joinName,
        type: ChannelType.GuildVoice,
        parent: category?.id ?? null,
      });
    }

    const resolvedPanelChannel =
      panelChannel ?? (interaction.channel?.id ? interaction.channel : null);

    await updateVoiceRoomsSettings(interaction.guild.id, (settings) => ({
      ...settings,
      joinToCreateChannelId: resolvedJoinChannel.id,
      categoryId: category?.id ?? (resolvedJoinChannel as { parentId?: string | null }).parentId ?? null,
      panelChannelId: resolvedPanelChannel?.id ?? settings.panelChannelId ?? null,
      waitingRoomsEnabled:
        typeof waitingRoomsEnabled === "boolean"
          ? waitingRoomsEnabled
          : settings.waitingRoomsEnabled ?? false,
      waitingRoomCategoryId:
        waitingCategory?.id ?? settings.waitingRoomCategoryId ?? null,
    }));

    const message = await translateVoiceRooms("voiceRooms.general.setupSuccess", locale, {
      channel: `<#${resolvedJoinChannel.id}>`,
    });

    return interaction.reply({ content: message, ephemeral: true });
  },
};

export default command;
