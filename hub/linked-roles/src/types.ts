export type LinkedRoleConnectionRecord = {
  id: string;
  userId: string;
  selectedGuildId: string | null;
  manageableGuildIds: unknown;
  encryptedAccessToken: string;
  encryptedRefreshToken: string;
  tokenExpiresAt: string | number | bigint;
  scopes: unknown;
  discordUserId: string | null;
  discordUsername: string | null;
  syncStatus: string;
  lastSyncAt: string | number | bigint | null;
  lastSyncError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OAuthStatePayload = {
  userId: string;
  manageableGuildIds: string[];
  returnTo: string;
  createdAt: number;
};

export type TokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export type DiscordUserPayload = {
  id: string;
  username?: string;
  global_name?: string | null;
};

export type MetricPayload = {
  wallet_balance: number;
  chat_level: number;
  voice_level: number;
  total_xp: number;
};

export type SyncQueueJob = {
  userId: string;
  reason: string;
  attempts: number;
  nextRunAt: number;
  lastError?: string;
};

export type SyncOutcome = {
  ok: true;
  metadata: MetricPayload;
} | {
  ok: false;
  retryable: boolean;
  error: string;
};
