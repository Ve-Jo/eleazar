import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  PermissionsBitField,
} from "discord.js";
import {
  findRoomByChannelId,
  findRoomByOwnerId,
  findRoomByWaitingRoomId,
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
  members?: Map<string, MemberLike>;
  send?: (payload: unknown) => Promise<unknown>;
  messages?: {
    fetch: (id: string) => Promise<{ delete: () => Promise<unknown> }>;
  };
  permissionOverwrites?: {
    edit: (id: string, permissions: Record<string, boolean | null>) => Promise<unknown>;
  };
  delete: () => Promise<unknown>;
};

type GuildLike = {
  id: string;
  channels: {
    fetch: (id: string) => Promise<ChannelLike | null>;
    create: (options: {
      name: string;
      type: ChannelType;
      parent?: string | null;
      userLimit?: number;
      permissionOverwrites?: Array<{ id: string; allow?: bigint[]; deny?: bigint[] }>;
    }) => Promise<ChannelLike>;
  };
  members?: {
    fetch: (id: string) => Promise<MemberLike | null>;
  };
};

type MemberLike = {
  id: string;
  user: {
    bot?: boolean;
    username?: string;
  };
  displayName?: string;
  voice: {
    channelId?: string | null;
    setChannel: (channelId: string | null) => Promise<unknown>;
  };
};

type VoiceStateLike = {
  guild: GuildLike;
  member: MemberLike | null;
  channelId: string | null;
  channel: ChannelLike | null;
};

const event = {
  name: Events.VoiceStateUpdate,
  async execute(oldState: VoiceStateLike, newState: VoiceStateLike): Promise<void> {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;
    if (!guild || !member || member.user.bot) return;

    const settings = await getVoiceRoomsSettings(guild.id);
    const joinChannelId = settings.joinToCreateChannelId;
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId) {
      await maybeCleanupRoom(guild, settings, oldChannelId);
    }

    if (newChannelId) {
      const existingRoom = findRoomByChannelId(settings, newChannelId);
      if (existingRoom) {
        if (existingRoom.bannedUserIds?.includes(member.id)) {
          await member.voice.setChannel(null);
          return;
        }
        const ownerLocale = await resolveUserLocale(guild.id, existingRoom.ownerId, "en");
        await refreshVoiceRoomPanel(
          guild as Parameters<typeof refreshVoiceRoomPanel>[0],
          newChannelId,
          ownerLocale
        );
      }

      if (oldChannelId !== newChannelId) {
        const waitingRoom = findRoomByWaitingRoomId(settings, newChannelId);
        if (
          waitingRoom &&
          waitingRoom.waitingEnabled &&
          waitingRoom.waitingRoomId === newChannelId &&
          waitingRoom.ownerId !== member.id
        ) {
          if (waitingRoom.bannedUserIds?.includes(member.id)) {
            await member.voice.setChannel(null);
            return;
          }
          await notifyWaitingRoomRequest(guild, settings, waitingRoom, member.id);
        }
      }
    }

    if (!joinChannelId || newChannelId !== joinChannelId) {
      return;
    }

    if (oldChannelId === newChannelId) {
      return;
    }

    const locale = await resolveUserLocale(guild.id, member.id, "en");
    const existingRoom = findRoomByOwnerId(settings, member.id);
    if (existingRoom) {
      const existingChannel = await safeFetchGuildChannel(guild, existingRoom.channelId);
      if (existingChannel && existingChannel.type === ChannelType.GuildVoice) {
        await member.voice.setChannel(existingRoom.channelId);
        await refreshVoiceRoomPanel(
          guild as Parameters<typeof refreshVoiceRoomPanel>[0],
          existingRoom.channelId,
          locale
        );
        return;
      }

      await updateVoiceRoomsSettings(guild.id, (current) => {
        const rooms = { ...(current.rooms ?? {}) };
        delete rooms[existingRoom.channelId];
        return { ...current, rooms };
      });
    }

    const joinChannel = await safeFetchGuildChannel(guild, joinChannelId);
    const parentId = settings.categoryId ?? joinChannel?.parentId ?? null;

    const roomName = await translateVoiceRooms("voiceRooms.general.roomName", locale, {
      username: member.displayName || member.user.username || "User",
    });

    const channel = await guild.channels.create({
      name: roomName,
      type: ChannelType.GuildVoice,
      parent: parentId ?? undefined,
    });

    await member.voice.setChannel(channel.id);

    const roomRecord: VoiceRoomRecord = {
      channelId: channel.id,
      ownerId: member.id,
      createdAt: Date.now(),
      locked: false,
      hidden: false,
      userLimit: 0,
      waitingEnabled: false,
      waitingRoomId: undefined,
      bannedUserIds: [],
    };

    await updateVoiceRoomsSettings(guild.id, (current) => ({
      ...current,
      rooms: {
        ...(current.rooms ?? {}),
        [channel.id]: roomRecord,
      },
    }));

    await refreshVoiceRoomPanel(
      guild as Parameters<typeof refreshVoiceRoomPanel>[0],
      channel.id,
      locale
    );
  },
};

async function maybeCleanupRoom(
  guild: GuildLike,
  settings: ReturnType<typeof getVoiceRoomsSettings> extends Promise<infer R> ? R : never,
  channelId: string
): Promise<void> {
  const room = findRoomByChannelId(settings, channelId);
  if (!room) {
    return;
  }

  const panelChannelId = room.messageChannelId ?? settings.panelChannelId ?? null;

  const channel = await safeFetchGuildChannel(guild, channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await deleteRoomPanelMessage(guild, panelChannelId, room.messageId);
    await deleteWaitingRoom(guild, room.waitingRoomId);
    await updateVoiceRoomsSettings(guild.id, (current) => {
      const rooms = { ...(current.rooms ?? {}) };
      delete rooms[channelId];
      return { ...current, rooms };
    });
    return;
  }

  const nonBotMembers = channel.members
    ? Array.from(channel.members.values()).filter((m) => !m.user.bot)
    : [];

  if (nonBotMembers.length > 0) {
    const ownerLocale = await resolveUserLocale(guild.id, room.ownerId, "en");
    await refreshVoiceRoomPanel(
      guild as Parameters<typeof refreshVoiceRoomPanel>[0],
      channel.id,
      ownerLocale
    );
    return;
  }

  await channel.delete().catch(() => undefined);
  await deleteRoomPanelMessage(guild, panelChannelId, room.messageId);
  await deleteWaitingRoom(guild, room.waitingRoomId);
  await updateVoiceRoomsSettings(guild.id, (current) => {
    const rooms = { ...(current.rooms ?? {}) };
    delete rooms[channelId];
    return { ...current, rooms };
  });
}

async function deleteRoomPanelMessage(
  guild: GuildLike,
  panelChannelId: string | null,
  messageId?: string
): Promise<void> {
  if (!panelChannelId || !messageId) return;
  const channel = await safeFetchGuildChannel(guild, panelChannelId);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const textChannel = channel as unknown as {
    messages: {
      fetch: (id: string) => Promise<{ delete: () => Promise<unknown> }>;
    };
  };
  try {
    const message = await textChannel.messages.fetch(messageId);
    await message.delete();
  } catch {
    // ignore missing message
  }
}

async function notifyWaitingRoomRequest(
  guild: GuildLike,
  settings: Awaited<ReturnType<typeof getVoiceRoomsSettings>>,
  room: VoiceRoomRecord,
  requesterId: string
): Promise<void> {
  const requestChannel = await resolveWaitingRequestChannel(guild, settings, room);
  if (!requestChannel) return;

  const locale = await resolveUserLocale(guild.id, room.ownerId, "en");
  const requestText = await translateVoiceRooms("voiceRooms.waiting.request", locale, {
    owner: `<@${room.ownerId}>`,
    member: `<@${requesterId}>`,
  });
  const acceptLabel = await translateVoiceRooms("voiceRooms.buttons.waitingAccept", locale);
  const declineLabel = await translateVoiceRooms("voiceRooms.buttons.waitingDecline", locale);

  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`voice_waiting:accept:${room.channelId}:${requesterId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel(acceptLabel),
    new ButtonBuilder()
      .setCustomId(`voice_waiting:decline:${room.channelId}:${requesterId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(declineLabel)
  );

  await requestChannel.send({
    content: requestText,
    components: [controls],
  });
}

async function resolveWaitingRequestChannel(
  guild: GuildLike,
  settings: Awaited<ReturnType<typeof getVoiceRoomsSettings>>,
  room: VoiceRoomRecord
): Promise<(ChannelLike & { send: (payload: unknown) => Promise<unknown> }) | null> {
  if (room.messageChannelId) {
    const stored = await safeFetchGuildChannel(guild, room.messageChannelId);
    if (stored?.send) {
      return stored as ChannelLike & { send: (payload: unknown) => Promise<unknown> };
    }
  }

  const roomChannel = await safeFetchGuildChannel(guild, room.channelId);
  if (roomChannel?.send) {
    return roomChannel as ChannelLike & { send: (payload: unknown) => Promise<unknown> };
  }

  if (settings.panelChannelId) {
    const panelChannel = await safeFetchGuildChannel(guild, settings.panelChannelId);
    if (panelChannel?.send) {
      return panelChannel as ChannelLike & { send: (payload: unknown) => Promise<unknown> };
    }
  }

  return null;
}

async function deleteWaitingRoom(
  guild: GuildLike,
  waitingRoomId?: string
): Promise<void> {
  if (!waitingRoomId) return;
  const waitingRoom = await safeFetchGuildChannel(guild, waitingRoomId);
  if (waitingRoom && waitingRoom.type === ChannelType.GuildVoice) {
    await waitingRoom.delete().catch(() => undefined);
  }
}

async function cleanupEmptyVoiceRoomsForGuild(guild: GuildLike): Promise<void> {
  const settings = await getVoiceRoomsSettings(guild.id);
  const rooms = { ...(settings.rooms ?? {}) };
  const entries = Object.entries(rooms);
  if (!entries.length) return;

  let changed = false;

  for (const [channelId, room] of entries) {
    const panelChannelId = room.messageChannelId ?? settings.panelChannelId ?? null;
    const channel = await safeFetchGuildChannel(guild, channelId);
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await deleteRoomPanelMessage(guild, panelChannelId, room.messageId);
      await deleteWaitingRoom(guild, room.waitingRoomId);
      delete rooms[channelId];
      changed = true;
      continue;
    }

    const nonBotMembers = channel.members
      ? Array.from(channel.members.values()).filter((m) => !m.user.bot)
      : [];
    if (nonBotMembers.length > 0) continue;

    await channel.delete().catch(() => undefined);
    await deleteRoomPanelMessage(guild, panelChannelId, room.messageId);
    await deleteWaitingRoom(guild, room.waitingRoomId);
    delete rooms[channelId];
    changed = true;
  }

  if (changed) {
    await updateVoiceRoomsSettings(guild.id, (current) => ({
      ...current,
      rooms,
    }));
  }
}

export { cleanupEmptyVoiceRoomsForGuild };
export default event;

async function safeFetchGuildChannel(
  guild: GuildLike,
  channelId?: string | null
): Promise<ChannelLike | null> {
  if (!channelId) return null;
  try {
    return await guild.channels.fetch(channelId);
  } catch {
    return null;
  }
}
