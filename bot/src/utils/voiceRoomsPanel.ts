import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { generateImage } from "./imageGenerator.ts";
import { ComponentBuilder } from "./componentConverter.ts";
import {
  translateVoiceRooms,
  resolveUserLocale,
  findRoomByChannelId,
  getVoiceRoomsSettings,
  updateVoiceRoomsSettings,
  type VoiceRoomRecord,
} from "./voiceRooms.ts";

import "./voiceRoomsLocalization.ts";

type GuildLike = {
  id: string;
  channels: {
    fetch: (id: string) => Promise<ChannelLike | null>;
  };
};

type ChannelLike = {
  id: string;
  name: string;
  type: ChannelType;
  bitrate?: number;
  rtcRegion?: string | null;
  userLimit?: number;
  members?: Map<string, MemberLike>;
  send?: (payload: unknown) => Promise<{ id: string }>;
  messages?: {
    fetch: (id: string) => Promise<{ edit: (payload: unknown) => Promise<unknown> }>;
  };
};

type MemberLike = {
  id: string;
  displayName?: string;
  user?: {
    bot?: boolean;
    username?: string;
    displayAvatarURL?: (options?: Record<string, unknown>) => string;
  };
  displayAvatarURL?: (options?: Record<string, unknown>) => string;
  [key: string]: unknown;
};

type PanelContext = {
  guildId: string;
  channelId: string;
  room: VoiceRoomRecord;
  owner: MemberLike | null;
  channelName: string;
  memberCount: number;
  members: Array<{ id: string; name: string; avatarUrl: string }>;
  userLimit: number | null;
  bitrate: number | null;
  region: string | null;
  locked: boolean;
  hidden: boolean;
  waitingEnabled: boolean;
  waitingAvailable: boolean;
  ownerPresent: boolean;
  locale: string;
};

const AVATAR_OPTIONS = { extension: "png", size: 256 } as const;

async function buildVoiceRoomPanelPayload(context: PanelContext) {
  const {
    room,
    channelName,
    owner,
    memberCount,
    userLimit,
    bitrate,
    region,
    locked,
    hidden,
    waitingEnabled,
    waitingAvailable,
    locale,
  } = context;

  const ownerName = owner?.displayName || owner?.user?.username || "Unknown";
  const ownerAvatar =
    owner?.displayAvatarURL?.(AVATAR_OPTIONS) ||
    owner?.user?.displayAvatarURL?.(AVATAR_OPTIONS) ||
    "https://cdn.discordapp.com/embed/avatars/0.png";

  const labels = {
    title: await translateVoiceRooms("voiceRooms.panel.title", locale),
    owner: await translateVoiceRooms("voiceRooms.panel.owner", locale),
    members: await translateVoiceRooms("voiceRooms.panel.members", locale),
    memberList: await translateVoiceRooms("voiceRooms.panel.memberList", locale),
    limit: await translateVoiceRooms("voiceRooms.panel.limit", locale),
    limitNone: await translateVoiceRooms("voiceRooms.panel.limitNone", locale),
    bitrate: await translateVoiceRooms("voiceRooms.panel.bitrate", locale),
    region: await translateVoiceRooms("voiceRooms.panel.region", locale),
    regionAuto: await translateVoiceRooms("voiceRooms.panel.regionAuto", locale),
    bitrateLow: await translateVoiceRooms("voiceRooms.bitrate.low", locale),
    bitrateMedium: await translateVoiceRooms("voiceRooms.bitrate.medium", locale),
    bitrateHigh: await translateVoiceRooms("voiceRooms.bitrate.high", locale),
    kick: await translateVoiceRooms("voiceRooms.buttons.kick", locale),
    ban: await translateVoiceRooms("voiceRooms.buttons.ban", locale),
    locked: await translateVoiceRooms("voiceRooms.status.locked", locale),
    unlocked: await translateVoiceRooms("voiceRooms.status.unlocked", locale),
    hidden: await translateVoiceRooms("voiceRooms.status.hidden", locale),
    visible: await translateVoiceRooms("voiceRooms.status.visible", locale),
  };

  const imageBuffer = (await generateImage(
    "VoiceRoomPanel",
    {
      locale,
      interaction: {
        user: {
          id: room.ownerId,
          avatarURL: ownerAvatar,
        },
      },
      room: {
        name: channelName,
        ownerName,
        ownerAvatar,
        memberCount,
        members: context.members,
        userLimit,
        bitrate,
        region,
        locked,
        hidden,
      },
      labels,
    },
    { image: 2, emoji: 1 },
    { getLocale: () => locale }
  )) as Buffer;

  const attachment = new AttachmentBuilder(imageBuffer, {
    name: "voice_room_panel.png",
  });

  const componentBuilder = new ComponentBuilder({ mode: "v2" })
    .addText(labels.title, "header3")
    .addImage("attachment://voice_room_panel.png");

  const buttons = buildVoiceRoomButtons({
    channelId: context.channelId,
    hidden,
    claimable: context.memberCount > 0 && !context.ownerPresent,
    labels: {
      hide: await translateVoiceRooms("voiceRooms.buttons.hide", locale),
      show: await translateVoiceRooms("voiceRooms.buttons.show", locale),
      waitingEnable: await translateVoiceRooms("voiceRooms.buttons.waitingEnable", locale),
      waitingDisable: await translateVoiceRooms("voiceRooms.buttons.waitingDisable", locale),
      limit: await translateVoiceRooms("voiceRooms.buttons.limit", locale),
      rename: await translateVoiceRooms("voiceRooms.buttons.rename", locale),
      kick: await translateVoiceRooms("voiceRooms.buttons.kick", locale),
      ban: await translateVoiceRooms("voiceRooms.buttons.ban", locale),
      bitrate: await translateVoiceRooms("voiceRooms.buttons.bitrate", locale),
      bitrateLow: await translateVoiceRooms("voiceRooms.bitrate.low", locale),
      bitrateMedium: await translateVoiceRooms("voiceRooms.bitrate.medium", locale),
      bitrateHigh: await translateVoiceRooms("voiceRooms.bitrate.high", locale),
      claim: await translateVoiceRooms("voiceRooms.buttons.claim", locale),
    },
    waitingEnabled,
    waitingAvailable,
  });

  componentBuilder.addActionRow(buttons);
  componentBuilder.addActionRow(
    buildVoiceRoomManageButtons({
      channelId: context.channelId,
      labels: {
        bitrate: await translateVoiceRooms("voiceRooms.buttons.bitrate", locale),
        kick: await translateVoiceRooms("voiceRooms.buttons.kick", locale),
        ban: await translateVoiceRooms("voiceRooms.buttons.ban", locale),
      },
    })
  );

  return componentBuilder.toReplyOptions({ files: [attachment] });
}

function buildVoiceRoomButtons(options: {
  channelId: string;
  hidden: boolean;
  waitingEnabled: boolean;
  waitingAvailable: boolean;
  claimable: boolean;
  labels: {
    hide: string;
    show: string;
    waitingEnable: string;
    waitingDisable: string;
    limit: string;
    rename: string;
    kick: string;
    ban: string;
    bitrate: string;
    bitrateLow: string;
    bitrateMedium: string;
    bitrateHigh: string;
    claim: string;
  };
}) {
  const hideButton = new ButtonBuilder()
    .setCustomId(`voice_room:hide:${options.channelId}`)
    .setStyle(options.hidden ? ButtonStyle.Secondary : ButtonStyle.Primary)
    .setLabel(options.hidden ? options.labels.show : options.labels.hide);

  const limitButton = new ButtonBuilder()
    .setCustomId(`voice_room:limit:${options.channelId}`)
    .setStyle(ButtonStyle.Primary)
    .setLabel(options.labels.limit);

  const renameButton = new ButtonBuilder()
    .setCustomId(`voice_room:rename:${options.channelId}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(options.labels.rename);

  const waitingButton = new ButtonBuilder()
    .setCustomId(`voice_room:waiting:${options.channelId}`)
    .setStyle(options.waitingEnabled ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setLabel(options.waitingEnabled ? options.labels.waitingDisable : options.labels.waitingEnable)
    .setDisabled(!options.waitingAvailable && !options.waitingEnabled);

  const claimButton = new ButtonBuilder()
    .setCustomId(`voice_room:claim:${options.channelId}`)
    .setStyle(ButtonStyle.Success)
    .setLabel(options.labels.claim)
    .setDisabled(!options.claimable);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    hideButton,
    limitButton,
    renameButton,
    waitingButton,
    claimButton
  );
}

function buildVoiceRoomManageButtons(options: {
  channelId: string;
  labels: { bitrate: string; kick: string; ban: string };
}) {
  const bitrateButton = new ButtonBuilder()
    .setCustomId(`voice_room:bitrate_menu:${options.channelId}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(options.labels.bitrate);

  const kickButton = new ButtonBuilder()
    .setCustomId(`voice_room:kick_menu:${options.channelId}`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(options.labels.kick);

  const banButton = new ButtonBuilder()
    .setCustomId(`voice_room:ban_menu:${options.channelId}`)
    .setStyle(ButtonStyle.Danger)
    .setLabel(options.labels.ban);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    bitrateButton,
    kickButton,
    banButton
  );
}

async function refreshVoiceRoomPanel(
  guild: GuildLike,
  channelId: string,
  fallbackLocale: string = "en"
): Promise<void> {
  const settings = await getVoiceRoomsSettings(guild.id);
  const room = findRoomByChannelId(settings, channelId);
  if (!room) {
    return;
  }

  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    await updateVoiceRoomsSettings(guild.id, (current) => {
      const rooms = { ...(current.rooms ?? {}) };
      delete rooms[channelId];
      return { ...current, rooms };
    });
    return;
  }

  const ownerMember = channel.members?.get(room.ownerId) ?? null;

  const locale = await resolveUserLocale(guild.id, room.ownerId, fallbackLocale);
  const memberCount = channel.members ? channel.members.size : 0;
  const ownerPresent = channel.members?.has(room.ownerId) ?? false;
  const payload = await buildVoiceRoomPanelPayload({
    guildId: guild.id,
    channelId,
    room,
    owner: ownerMember,
    channelName: channel.name,
    memberCount,
    members: buildMemberList(channel.members, ownerMember),
    userLimit: room.userLimit ?? channel.userLimit ?? 0,
    bitrate: channel.bitrate ?? null,
    region: channel.rtcRegion ?? null,
    locked: !!room.locked,
    hidden: !!room.hidden,
    waitingEnabled: !!room.waitingEnabled,
    waitingAvailable: !!settings.waitingRoomsEnabled && !!room.hidden,
    ownerPresent,
    locale,
  });

  const panelChannelTyped = await resolvePanelChannel(guild, channel, room, settings);
  if (!panelChannelTyped) {
    return;
  }

  if (room.messageId) {
    try {
      const message = await panelChannelTyped.messages.fetch(room.messageId);
      await message.edit(payload);
      return;
    } catch (error) {
      console.warn("Failed to edit voice room panel, sending new message:", error);
    }
  }

  const sent = await panelChannelTyped.send(payload);
  await updateVoiceRoomsSettings(guild.id, (current) => {
    const rooms = { ...(current.rooms ?? {}) };
    const existing = rooms[channelId];
    if (existing) {
      rooms[channelId] = {
        ...existing,
        messageId: sent.id,
        messageChannelId: panelChannelTyped.id,
      } as VoiceRoomRecord;
    }
    return { ...current, rooms };
  });
}

function buildMemberList(
  members: Map<string, MemberLike> | undefined,
  owner: MemberLike | null
): Array<{ id: string; name: string; avatarUrl: string }> {
  if (!members) return [];
  const list = Array.from(members.values())
    .filter((member) => !member.user?.bot)
    .map((member) => ({
      id: member.id,
      name: member.displayName || member.user?.username || "Unknown",
      avatarUrl:
        member.displayAvatarURL?.(AVATAR_OPTIONS) ||
        member.user?.displayAvatarURL?.(AVATAR_OPTIONS) ||
        "https://cdn.discordapp.com/embed/avatars/0.png",
    }));

  if (owner) {
    const ownerIndex = list.findIndex((member) => member.id === owner.id);
    if (ownerIndex > 0) {
      const entry = list[ownerIndex];
      if (entry) {
        list.splice(ownerIndex, 1);
        list.unshift(entry);
      }
    }
  }

  return list;
}

type PanelChannelLike = ChannelLike & {
  send: (payload: unknown) => Promise<{ id: string }>;
  messages: {
    fetch: (id: string) => Promise<{ edit: (payload: unknown) => Promise<unknown> }>;
  };
};

async function resolvePanelChannel(
  guild: GuildLike,
  voiceChannel: ChannelLike,
  room: VoiceRoomRecord,
  settings: Awaited<ReturnType<typeof getVoiceRoomsSettings>>
): Promise<PanelChannelLike | null> {
  if (room.messageChannelId) {
    const stored = await guild.channels.fetch(room.messageChannelId);
    if (stored?.send && stored?.messages) {
      return stored as PanelChannelLike;
    }
  }

  if (voiceChannel.send && voiceChannel.messages) {
    return voiceChannel as PanelChannelLike;
  }

  const panelChannelId = settings.panelChannelId as string | undefined;
  if (!panelChannelId) {
    return null;
  }

  const panelChannel = await guild.channels.fetch(panelChannelId);
  if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
    return null;
  }

  if (!panelChannel.send || !panelChannel.messages) {
    return null;
  }

  return panelChannel as PanelChannelLike;
}

export { buildVoiceRoomPanelPayload, refreshVoiceRoomPanel };
