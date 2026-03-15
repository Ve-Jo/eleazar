import hubClient from "../api/hubClient.ts";
import "./voiceRoomsLocalization.ts";

type VoiceRoomRecord = {
  channelId: string;
  ownerId: string;
  createdAt: number;
  locked?: boolean;
  hidden?: boolean;
  userLimit?: number;
  messageId?: string;
  messageChannelId?: string;
  waitingEnabled?: boolean;
  waitingRoomId?: string;
  bannedUserIds?: string[];
};

type VoiceRoomsSettings = {
  joinToCreateChannelId?: string;
  categoryId?: string | null;
  panelChannelId?: string | null;
  waitingRoomsEnabled?: boolean;
  waitingRoomCategoryId?: string | null;
  rooms?: Record<string, VoiceRoomRecord>;
};

type GuildRecordLike = {
  settings?: Record<string, unknown> | null;
};

type TranslationResponse = {
  translation?: string;
};

const DEFAULT_LOCALE = "en";

function normalizeVoiceRoomsSettings(settings?: VoiceRoomsSettings | null): VoiceRoomsSettings {
  return {
    joinToCreateChannelId: settings?.joinToCreateChannelId,
    categoryId: settings?.categoryId ?? null,
    panelChannelId: settings?.panelChannelId ?? null,
    waitingRoomsEnabled: settings?.waitingRoomsEnabled ?? false,
    waitingRoomCategoryId: settings?.waitingRoomCategoryId ?? null,
    rooms: settings?.rooms ?? {},
  };
}

async function getGuildSettings(guildId: string): Promise<Record<string, unknown>> {
  const guild = (await hubClient.getGuild(guildId)) as GuildRecordLike | null;
  return (guild?.settings ?? {}) as Record<string, unknown>;
}

async function getVoiceRoomsSettings(guildId: string): Promise<VoiceRoomsSettings> {
  const settings = await getGuildSettings(guildId);
  const voiceRooms = settings.voiceRooms as VoiceRoomsSettings | undefined;
  return normalizeVoiceRoomsSettings(voiceRooms);
}

async function updateVoiceRoomsSettings(
  guildId: string,
  updater: (settings: VoiceRoomsSettings) => VoiceRoomsSettings
): Promise<VoiceRoomsSettings> {
  const settings = await getGuildSettings(guildId);
  const voiceRooms = normalizeVoiceRoomsSettings(settings.voiceRooms as VoiceRoomsSettings);
  const updatedVoiceRooms = normalizeVoiceRoomsSettings(updater(voiceRooms));

  await hubClient.updateGuild(guildId, {
    settings: {
      ...settings,
      voiceRooms: updatedVoiceRooms,
    },
  });

  return updatedVoiceRooms;
}

function findRoomByChannelId(
  settings: VoiceRoomsSettings,
  channelId: string
): VoiceRoomRecord | null {
  return settings.rooms?.[channelId] ?? null;
}

function findRoomByOwnerId(
  settings: VoiceRoomsSettings,
  ownerId: string
): VoiceRoomRecord | null {
  if (!settings.rooms) return null;
  return Object.values(settings.rooms).find((room) => room.ownerId === ownerId) ?? null;
}

function findRoomByWaitingRoomId(
  settings: VoiceRoomsSettings,
  waitingRoomId: string
): VoiceRoomRecord | null {
  if (!settings.rooms) return null;
  return Object.values(settings.rooms).find((room) => room.waitingRoomId === waitingRoomId) ?? null;
}

async function resolveUserLocale(
  guildId: string,
  userId: string,
  fallback: string = DEFAULT_LOCALE
): Promise<string> {
  try {
    const user = await hubClient.getUser(guildId, userId);
    const locale = typeof user?.locale === "string" ? user.locale : null;
    if (locale) {
      return locale.includes("-") ? locale.split("-")[0] || fallback : locale;
    }
  } catch (error) {
    console.warn("Failed to resolve user locale:", error);
  }
  return fallback;
}

async function translateVoiceRooms(
  key: string,
  locale: string,
  variables: Record<string, unknown> = {}
): Promise<string> {
  const response = (await hubClient.getTranslation(
    key,
    variables,
    locale
  )) as TranslationResponse;
  return response?.translation || key;
}

export type { VoiceRoomRecord, VoiceRoomsSettings };
export {
  DEFAULT_LOCALE,
  getGuildSettings,
  getVoiceRoomsSettings,
  updateVoiceRoomsSettings,
  findRoomByChannelId,
  findRoomByOwnerId,
  findRoomByWaitingRoomId,
  resolveUserLocale,
  translateVoiceRooms,
};
