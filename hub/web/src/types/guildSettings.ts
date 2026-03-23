export type LevelRoleRecord = {
  guildId: string;
  roleId: string;
  requiredLevel: number;
  mode?: string;
  replaceLowerRoles?: boolean;
};

export type VoiceRoomsSettings = {
  joinToCreateChannelId?: string;
  categoryId?: string | null;
  panelChannelId?: string | null;
  waitingRoomsEnabled?: boolean;
  waitingRoomCategoryId?: string | null;
  rooms?: Record<string, unknown>;
};

export type GuildSettingsResponse = {
  guildId: string;
  settings: {
    voiceRooms: VoiceRoomsSettings;
  };
  levelRoles: LevelRoleRecord[];
};

export type GuildOverviewResponse = {
  guild: {
    id: string;
    name: string;
    icon?: string | null;
  };
  stats: Record<string, unknown> | null;
  levelRolesCount: number;
  voiceRoomsEnabled: boolean;
};
