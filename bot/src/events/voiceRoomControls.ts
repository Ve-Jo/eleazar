import {
  ActionRowBuilder,
  ChannelType,
  Events,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  PermissionsBitField,
} from "discord.js";
import {
  findRoomByChannelId,
  getVoiceRoomsSettings,
  resolveUserLocale,
  translateVoiceRooms,
  updateVoiceRoomsSettings,
  type VoiceRoomRecord,
} from "../utils/voiceRooms.ts";
import { refreshVoiceRoomPanel } from "../utils/voiceRoomsPanel.ts";

import "../utils/voiceRoomsLocalization.ts";

type ChannelLike = {
  id: string;
  name: string;
  type: ChannelType;
  parentId?: string | null;
  bitrate?: number;
  userLimit?: number;
  members?: Map<string, MemberLike>;
  permissionOverwrites?: {
    edit: (id: string, permissions: Record<string, boolean | null>) => Promise<unknown>;
  };
  edit: (options: { userLimit?: number; name?: string; bitrate?: number }) => Promise<unknown>;
  delete?: () => Promise<unknown>;
};

type GuildLike = {
  id: string;
  maximumBitrate?: number;
  channels: {
    fetch: (id: string) => Promise<ChannelLike | null>;
    create: (options: {
      name: string;
      type: ChannelType;
      parent?: string | null;
      permissionOverwrites?: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }>;
    }) => Promise<ChannelLike>;
  };
  members: {
    fetch: (id: string) => Promise<MemberLike | null>;
  };
};

type MemberLike = {
  id: string;
  user: {
    bot?: boolean;
    username?: string;
  };
  voice?: {
    channelId?: string | null;
    setChannel?: (channelId: string | null) => Promise<unknown>;
  };
};

type ButtonInteractionLike = {
  isButton: () => boolean;
  customId: string;
  guild: GuildLike | null;
  user: { id: string; locale?: string };
  deferUpdate: () => Promise<unknown>;
  followUp: (payload: { content?: string; ephemeral?: boolean; components?: unknown[] }) => Promise<unknown>;
  showModal: (modal: ModalBuilder) => Promise<unknown>;
};

type StringSelectInteractionLike = {
  isStringSelectMenu: () => boolean;
  customId: string;
  values: string[];
  guild: GuildLike | null;
  user: { id: string; locale?: string };
  deferUpdate: () => Promise<unknown>;
  followUp: (payload: { content?: string; ephemeral?: boolean; components?: unknown[] }) => Promise<unknown>;
};

type UserSelectInteractionLike = {
  isUserSelectMenu: () => boolean;
  customId: string;
  values: string[];
  guild: GuildLike | null;
  user: { id: string; locale?: string };
  deferUpdate: () => Promise<unknown>;
  followUp: (payload: { content?: string; ephemeral?: boolean; components?: unknown[] }) => Promise<unknown>;
};

type ModalInteractionLike = {
  isModalSubmit: () => boolean;
  customId: string;
  guild: GuildLike | null;
  user: { id: string; locale?: string };
  fields: { getTextInputValue: (id: string) => string };
  reply: (payload: { content: string; ephemeral?: boolean }) => Promise<unknown>;
};

type InteractionLike =
  ButtonInteractionLike &
  ModalInteractionLike &
  StringSelectInteractionLike &
  UserSelectInteractionLike;

function resolveMaxBitrate(guild: GuildLike, channel: ChannelLike): number {
  return Math.max(channel.bitrate ?? 64000, guild.maximumBitrate ?? 96000, 8000);
}

function buildBitratePresets(maxBitrate: number): Array<{ label: string; value: string }> {
  const minBitrate = 8000;
  const clampedMax = Math.max(maxBitrate, minBitrate);
  const presetCount = Math.min(25, Math.max(6, Math.floor((clampedMax - minBitrate) / 8000) + 1));
  const values = new Set<number>([minBitrate, clampedMax]);

  if (presetCount > 2) {
    const step = (clampedMax - minBitrate) / (presetCount - 1);
    for (let index = 0; index < presetCount; index += 1) {
      const rawValue = minBitrate + step * index;
      const roundedValue = Math.round(rawValue / 1000) * 1000;
      values.add(Math.min(clampedMax, Math.max(minBitrate, roundedValue)));
    }
  }

  return Array.from(values)
    .sort((left, right) => right - left)
    .map((bitrate) => ({
      label: `${Math.round(bitrate / 1000)} kbps`,
      value: String(bitrate),
    }));
}

function buildBitrateMenuRows(channelId: string, placeholder: string, maxBitrate: number) {
  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`voice_room_bitrate:${channelId}`)
        .setPlaceholder(placeholder)
        .addOptions(buildBitratePresets(maxBitrate))
    ),
  ];
}

function buildMemberSelectRow(action: "kick" | "ban", channelId: string, placeholder: string) {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`voice_room:${action}:${channelId}`)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1)
  );
}

const event = {
  name: Events.InteractionCreate,
  async execute(interaction: InteractionLike): Promise<void> {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("voice_waiting:")) {
        await interaction.deferUpdate();
        const [, decision, channelId, userId] = interaction.customId.split(":");
        if (!decision || !channelId || !userId) return;
        const guild = interaction.guild;
        if (!guild) return;

        const locale = await resolveUserLocale(
          guild.id,
          interaction.user.id,
          interaction.user.locale || "en"
        );
        const settings = await getVoiceRoomsSettings(guild.id);
        const room = findRoomByChannelId(settings, channelId);
        if (!room) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        if (interaction.user.id !== room.ownerId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.waitingOnlyOwner", locale),
            ephemeral: true,
          });
          return;
        }

        if (!room.waitingEnabled || !room.waitingRoomId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.waitingRequestExpired", locale),
            ephemeral: true,
          });
          return;
        }

        const targetMember = await guild.members.fetch(userId).catch(() => null);
        const targetStillWaiting = targetMember?.voice?.channelId === room.waitingRoomId;
        if (!targetMember || !targetStillWaiting) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.waitingRequestExpired", locale),
            ephemeral: true,
          });
          return;
        }

        if (decision === "accept") {
          const roomChannel = await guild.channels.fetch(channelId);
          if (!roomChannel || roomChannel.type !== ChannelType.GuildVoice) {
            await interaction.followUp({
              content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
              ephemeral: true,
            });
            return;
          }
          await targetMember.voice?.setChannel?.(channelId);
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.waiting.accepted", locale, {
              member: `<@${userId}>`,
            }),
            ephemeral: true,
          });
          return;
        }

        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.waiting.declined", locale),
          ephemeral: true,
        });
        return;
      }

      if (!interaction.customId.startsWith("voice_room:")) return;
      let [, action, channelId] = interaction.customId.split(":");
      if (!action || !channelId) return;
      if (action === "lock") {
        action = "hide";
      }
      const guild = interaction.guild;
      if (!guild) return;

      const locale = await resolveUserLocale(
        guild.id,
        interaction.user.id,
        interaction.user.locale || "en"
      );

      const settings = await getVoiceRoomsSettings(guild.id);
      const room = findRoomByChannelId(settings, channelId);
      if (!room) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
          ephemeral: true,
        });
        return;
      }

      if (action === "limit") {
        if (interaction.user.id !== room.ownerId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }
        const modalTitle = await translateVoiceRooms("voiceRooms.modal.limitTitle", locale);
        const label = await translateVoiceRooms("voiceRooms.modal.limitLabel", locale);

        const modal = new ModalBuilder()
          .setCustomId(`voice_room_limit:${channelId}`)
          .setTitle(modalTitle);

        const input = new TextInputBuilder()
          .setCustomId("limit_value")
          .setLabel(label)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder("0");

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

        await interaction.showModal(modal);
        return;
      }

      if (action === "rename") {
        if (interaction.user.id !== room.ownerId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }
        const modalTitle = await translateVoiceRooms("voiceRooms.modal.renameTitle", locale);
        const label = await translateVoiceRooms("voiceRooms.modal.renameLabel", locale);

        const modal = new ModalBuilder()
          .setCustomId(`voice_room_rename:${channelId}`)
          .setTitle(modalTitle);

        const input = new TextInputBuilder()
          .setCustomId("rename_value")
          .setLabel(label)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

        await interaction.showModal(modal);
        return;
      }

      if (action === "bitrate_menu") {
        if (interaction.user.id !== room.ownerId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }

        const channel = await guild.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        const bitratePrompt = await translateVoiceRooms("voiceRooms.buttons.bitrate", locale);

        await interaction.deferUpdate();
        await interaction.followUp({
          content: bitratePrompt,
          ephemeral: true,
          components: buildBitrateMenuRows(
            channelId,
            bitratePrompt,
            resolveMaxBitrate(guild, channel)
          ),
        });
        return;
      }

      if (action === "kick_menu" || action === "ban_menu") {
        if (interaction.user.id !== room.ownerId) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }

        const label =
          action === "kick_menu"
            ? await translateVoiceRooms("voiceRooms.buttons.kick", locale)
            : await translateVoiceRooms("voiceRooms.buttons.ban", locale);

        await interaction.deferUpdate();
        await interaction.followUp({
          content: label,
          ephemeral: true,
          components: [
            buildMemberSelectRow(action === "kick_menu" ? "kick" : "ban", channelId, label),
          ],
        });
        return;
      }

      await interaction.deferUpdate();

      const channel = await guild.channels.fetch(channelId);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
          ephemeral: true,
        });
        return;
      }

      if (action !== "claim" && interaction.user.id !== room.ownerId) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
          ephemeral: true,
        });
        return;
      }

      if (action === "hide") {
        const nextState = !room.hidden;
        let waitingRoomToDelete: string | undefined;
        if (channel.permissionOverwrites) {
          await channel.permissionOverwrites.edit(guild.id, {
            ViewChannel: nextState ? false : null,
            Connect: null,
          });
        }

        await updateVoiceRoomsSettings(guild.id, (current) => {
          const rooms = { ...(current.rooms ?? {}) };
          const updated = { ...room };
          updated.hidden = nextState;
          updated.locked = false;
          if (!nextState && updated.waitingEnabled) {
            updated.waitingEnabled = false;
            waitingRoomToDelete = updated.waitingRoomId;
            delete updated.waitingRoomId;
          }
          rooms[channelId] = updated;
          return { ...current, rooms };
        });

        if (waitingRoomToDelete) {
          const waitingRoom = await guild.channels.fetch(waitingRoomToDelete);
          await waitingRoom?.delete?.().catch(() => undefined);
        }
      }

      if (action === "waiting") {
        if (!settings.waitingRoomsEnabled) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.waitingNotAvailable", locale),
            ephemeral: true,
          });
          return;
        }
        if (!room.hidden) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.waitingRequiresLock", locale),
            ephemeral: true,
          });
          return;
        }

        if (room.waitingEnabled) {
          const waitingRoomId = room.waitingRoomId;
          await updateVoiceRoomsSettings(guild.id, (current) => {
            const rooms = { ...(current.rooms ?? {}) };
            rooms[channelId] = { ...room, waitingEnabled: false, waitingRoomId: undefined };
            return { ...current, rooms };
          });
          if (waitingRoomId) {
            const waitingRoom = await guild.channels.fetch(waitingRoomId);
            await waitingRoom?.delete?.().catch(() => undefined);
          }
        } else {
          const waitingRoomId = await ensureWaitingRoom(
            guild,
            channel,
            room,
            locale,
            settings.waitingRoomCategoryId ?? channel.parentId ?? null
          );
          await updateVoiceRoomsSettings(guild.id, (current) => {
            const rooms = { ...(current.rooms ?? {}) };
            rooms[channelId] = { ...room, waitingEnabled: true, waitingRoomId };
            return { ...current, rooms };
          });
        }
      }

      if (action === "claim") {
        const ownerPresent = channel.members?.has(room.ownerId) ?? false;
        const claimantPresent = channel.members?.has(interaction.user.id) ?? false;
        if (ownerPresent) {
          await interaction.followUp({
            content: await translateVoiceRooms(
              "voiceRooms.errors.claimUnavailable",
              locale
            ),
            ephemeral: true,
          });
          return;
        }

        if (!claimantPresent) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        await updateVoiceRoomsSettings(guild.id, (current) => {
          const rooms = { ...(current.rooms ?? {}) };
          rooms[channelId] = { ...room, ownerId: interaction.user.id };
          return { ...current, rooms };
        });
      }

      await refreshVoiceRoomPanel(
        guild as Parameters<typeof refreshVoiceRoomPanel>[0],
        channelId,
        locale
      );

      await interaction.followUp({
        content: await translateVoiceRooms("voiceRooms.general.updated", locale),
        ephemeral: true,
      });
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (!interaction.customId.startsWith("voice_room_bitrate:")) return;
      const [, channelId] = interaction.customId.split(":");
      if (!channelId || !interaction.guild) return;

      const locale = await resolveUserLocale(
        interaction.guild.id,
        interaction.user.id,
        interaction.user.locale || "en"
      );

      const settings = await getVoiceRoomsSettings(interaction.guild.id);
      const room = findRoomByChannelId(settings, channelId);
      if (!room) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
          ephemeral: true,
        });
        return;
      }

      if (interaction.user.id !== room.ownerId) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
          ephemeral: true,
        });
        return;
      }

      const selected = interaction.values[0];
      if (!selected) return;

      await interaction.deferUpdate();
      const channel = await interaction.guild.channels.fetch(channelId);
      if (channel && channel.type === ChannelType.GuildVoice) {
        const parsed = Number(selected);
        if (Number.isFinite(parsed)) {
          await channel.edit({ bitrate: parsed });
        }
      }

      await refreshVoiceRoomPanel(
        interaction.guild as Parameters<typeof refreshVoiceRoomPanel>[0],
        channelId,
        locale
      );

      await interaction.followUp({
        content: await translateVoiceRooms("voiceRooms.general.updated", locale),
        ephemeral: true,
      });
      return;
    }

    if (interaction.isUserSelectMenu()) {
      const match = interaction.customId.match(/^voice_room[:_](kick|ban)[:_](.+)$/);
      if (!match || !interaction.guild) return;
      const action = match[1];
      const channelId = match[2]!;

      const locale = await resolveUserLocale(
        interaction.guild.id,
        interaction.user.id,
        interaction.user.locale || "en"
      );

      const settings = await getVoiceRoomsSettings(interaction.guild.id);
      const room = findRoomByChannelId(settings, channelId);
      if (!room) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
          ephemeral: true,
        });
        return;
      }

      if (interaction.user.id !== room.ownerId) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
          ephemeral: true,
        });
        return;
      }

      const targetId = interaction.values[0];
      if (!targetId) return;
      if (targetId === room.ownerId) {
        await interaction.followUp({
          content: await translateVoiceRooms("voiceRooms.errors.cannotTargetOwner", locale),
          ephemeral: true,
        });
        return;
      }

      await interaction.deferUpdate();
      const channel = await interaction.guild.channels.fetch(channelId);
      if (channel && channel.type === ChannelType.GuildVoice) {
        const member = await interaction.guild.members.fetch(targetId).catch(() => null);
        if (!member) {
          await interaction.followUp({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }
        if (member.voice?.channelId === channelId) {
          await member.voice?.setChannel?.(null);
        }
      }

      if (action === "ban") {
        await updateVoiceRoomsSettings(interaction.guild.id, (current) => {
          const rooms = { ...(current.rooms ?? {}) };
          const updated = { ...room };
          const banned = new Set(updated.bannedUserIds ?? []);
          banned.add(targetId);
          updated.bannedUserIds = Array.from(banned);
          rooms[channelId] = updated;
          return { ...current, rooms };
        });
      }

      await refreshVoiceRoomPanel(
        interaction.guild as Parameters<typeof refreshVoiceRoomPanel>[0],
        channelId,
        locale
      );

      await interaction.followUp({
        content: await translateVoiceRooms("voiceRooms.general.updated", locale),
        ephemeral: true,
      });
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith("voice_room_limit:")) {
        const [, channelId] = interaction.customId.split(":");
        if (!channelId || !interaction.guild) return;

        const locale = await resolveUserLocale(
          interaction.guild.id,
          interaction.user.id,
          interaction.user.locale || "en"
        );

        const limitValue = interaction.fields.getTextInputValue("limit_value");
        const parsedLimit = Number(limitValue);
        if (!Number.isFinite(parsedLimit) || parsedLimit < 0 || parsedLimit > 99) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.invalidLimit", locale),
            ephemeral: true,
          });
          return;
        }

        const settings = await getVoiceRoomsSettings(interaction.guild.id);
        const room = findRoomByChannelId(settings, channelId);
        if (!room) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        if (interaction.user.id !== room.ownerId) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }

        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.GuildVoice) {
          await channel.edit({ userLimit: parsedLimit });
        }

        await updateVoiceRoomsSettings(interaction.guild.id, (current) => {
          const rooms = { ...(current.rooms ?? {}) };
          rooms[channelId] = { ...room, userLimit: parsedLimit };
          return { ...current, rooms };
        });

        await refreshVoiceRoomPanel(
          interaction.guild as Parameters<typeof refreshVoiceRoomPanel>[0],
          channelId,
          locale
        );

        await interaction.reply({
          content: await translateVoiceRooms("voiceRooms.general.updated", locale),
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith("voice_room_rename:")) {
        const [, channelId] = interaction.customId.split(":");
        if (!channelId || !interaction.guild) return;

        const locale = await resolveUserLocale(
          interaction.guild.id,
          interaction.user.id,
          interaction.user.locale || "en"
        );

        const newName = interaction.fields.getTextInputValue("rename_value").trim();
        if (!newName) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        const settings = await getVoiceRoomsSettings(interaction.guild.id);
        const room = findRoomByChannelId(settings, channelId);
        if (!room) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.roomMissing", locale),
            ephemeral: true,
          });
          return;
        }

        if (interaction.user.id !== room.ownerId) {
          await interaction.reply({
            content: await translateVoiceRooms("voiceRooms.errors.notOwner", locale),
            ephemeral: true,
          });
          return;
        }

        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel && channel.type === ChannelType.GuildVoice) {
          await channel.edit({ name: newName });
        }

        await refreshVoiceRoomPanel(
          interaction.guild as Parameters<typeof refreshVoiceRoomPanel>[0],
          channelId,
          locale
        );

        await interaction.reply({
          content: await translateVoiceRooms("voiceRooms.general.updated", locale),
          ephemeral: true,
        });
        return;
      }
    }
  },
};

async function ensureWaitingRoom(
  guild: GuildLike,
  roomChannel: ChannelLike,
  room: VoiceRoomRecord,
  locale: string,
  waitingParentId: string | null
): Promise<string> {
  if (room.waitingRoomId) {
    const existingWaitingRoom = await guild.channels.fetch(room.waitingRoomId);
    if (existingWaitingRoom && existingWaitingRoom.type === ChannelType.GuildVoice) {
      return existingWaitingRoom.id;
    }
  }

  const waitingRoomName = await translateVoiceRooms("voiceRooms.general.waitingRoomName", locale, {
    name: roomChannel.name,
  });
  const waitingRoom = await guild.channels.create({
    name: waitingRoomName,
    type: ChannelType.GuildVoice,
    parent: waitingParentId ?? undefined,
    permissionOverwrites: [
      {
        id: guild.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak,
        ],
      },
    ],
  });

  return waitingRoom.id;
}

export default event;
