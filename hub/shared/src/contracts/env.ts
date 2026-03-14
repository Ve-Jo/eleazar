export const BOT_ENV_KEYS = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DATABASE_SERVICE_URL",
  "RENDERING_SERVICE_URL",
  "LOCALIZATION_SERVICE_URL",
  "AI_SERVICE_URL",
  "IMAGE_SERVER_URL",
] as const;

export const HUB_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_SERVICE_PORT",
  "RENDERING_SERVICE_PORT",
  "LOCALIZATION_SERVICE_PORT",
  "AI_SERVICE_PORT",
  "AI_SERVICE_HOST",
  "CLIENT_SERVICE_PORT",
  "REDIS_URL",
] as const;

export type BotEnvKey = (typeof BOT_ENV_KEYS)[number];
export type HubEnvKey = (typeof HUB_ENV_KEYS)[number];

export type ServiceUrlEnv = Partial<
  Record<
    | "DATABASE_SERVICE_URL"
    | "RENDERING_SERVICE_URL"
    | "LOCALIZATION_SERVICE_URL"
    | "AI_SERVICE_URL",
    string
  >
>;

export type ServicePortEnv = Partial<
  Record<
    | "DATABASE_SERVICE_PORT"
    | "RENDERING_SERVICE_PORT"
    | "LOCALIZATION_SERVICE_PORT"
    | "AI_SERVICE_PORT"
    | "AI_SERVICE_HOST"
    | "CLIENT_SERVICE_PORT",
    string
  >
>;
