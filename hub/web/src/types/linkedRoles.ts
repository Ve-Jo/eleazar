export type LinkedRolesMetadataPreview = {
  wallet_balance: number;
  chat_level: number;
  voice_level: number;
  total_xp: number;
};

export type LinkedRolesStatus = {
  connected: boolean;
  userId: string;
  selectedGuildId: string | null;
  manageableGuildIds: string[];
  syncStatus: string;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  metadataPreview: LinkedRolesMetadataPreview | null;
};
