import { DEFAULT_VALUES } from "../constants/database.ts";

type GenericGetClient = {
  guild: {
    count: (args: unknown) => Promise<number>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
  analytics: {
    findFirst: (args: unknown) => Promise<unknown>;
  };
};

type DefaultUpgradeMap = Record<string, { level: number }>;

type GuildUserShape = {
  id: string;
  guildId?: string;
  economy?: {
    balance?: unknown;
    bankBalance?: unknown;
    bankRate?: unknown;
    bankStartTime?: unknown;
  } | null;
  level?: {
    xp?: unknown;
  } | null;
  cooldowns?: {
    data?: unknown;
  } | null;
  upgrades?: Array<{
    type?: string;
    level?: number;
  }> | null;
  stats?: {
    messageCount?: unknown;
    commandCount?: unknown;
    totalEarned?: unknown;
  } | null;
  [key: string]: unknown;
};

type GuildShape = {
  users?: GuildUserShape[];
  [key: string]: unknown;
};

type AnalyticsRecord = {
  data?: Record<string, unknown> | null;
};

function getDefaultUserShape(guildId: string, userId: string): GuildUserShape {
  return {
    ...DEFAULT_VALUES.user,
    id: userId,
    guildId,
    economy: {
      balance: DEFAULT_VALUES.economy.balance,
      bankBalance: DEFAULT_VALUES.economy.bankBalance,
      bankRate: DEFAULT_VALUES.economy.bankRate,
      bankStartTime: DEFAULT_VALUES.economy.bankStartTime,
    },
    level: { xp: 0 },
    cooldowns: { data: {} },
    upgrades: Object.entries(DEFAULT_VALUES.upgrades as DefaultUpgradeMap).map(
      ([type, data]) => ({
        type,
        level: data.level,
      })
    ),
  };
}

function parseCooldownData(data: unknown, warningContext?: string): Record<string, unknown> {
  try {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }

    if (typeof data === "string") {
      return JSON.parse(data || "{}") as Record<string, unknown>;
    }
  } catch (error) {
    const typedError = error as Error;
    if (warningContext) {
      console.warn(`${warningContext}: ${typedError.message}`);
    }
  }

  return {};
}

function reduceUpgrades(
  upgrades: GuildUserShape["upgrades"]
): Record<string, { level: number }> {
  return (
    upgrades?.reduce<Record<string, { level: number }>>((acc, upgrade) => {
      if (!upgrade?.type) {
        return acc;
      }

      return {
        ...acc,
        [upgrade.type]: { level: upgrade.level ?? 1 },
      };
    }, {}) ?? (DEFAULT_VALUES.upgrades as Record<string, { level: number }>)
  );
}

async function get(client: GenericGetClient, path: string): Promise<unknown> {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid path: must be a non-empty string");
  }

  const parts = path.split(".");

  if (parts[0]) {
    if ((await client.guild.count({ where: { id: parts[0] } })) > 0) {
      const guildId = parts[0];
      const guild = (await client.guild.findUnique({
        where: { id: guildId },
        include: {
          users: {
            include: {
              economy: true,
              level: true,
              cooldowns: true,
              upgrades: true,
              stats: true,
            },
          },
        },
      })) as GuildShape | null;

      if (!guild && parts.length === 1) {
        return DEFAULT_VALUES.guild;
      }

      if (parts.length > 1) {
        const userId = parts[1];
        if (!userId) {
          return DEFAULT_VALUES.guild;
        }
        const user = guild?.users?.find((guildUser) => guildUser.id === userId) ||
          getDefaultUserShape(guildId, userId);

        if (parts.length > 2) {
          const field = parts[2];
          if (!field) {
            return user;
          }
          switch (field) {
            case "balance":
              return user.economy?.balance ?? DEFAULT_VALUES.economy.balance;
            case "bankBalance":
              return user.economy?.bankBalance ?? DEFAULT_VALUES.economy.bankBalance;
            case "bankRate":
              return user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate;
            case "bankStartTime":
              return user.economy?.bankStartTime ?? DEFAULT_VALUES.economy.bankStartTime;
            case "messageCount":
              return user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount;
            case "commandCount":
              return user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount;
            case "totalEarned":
              return user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned;
            case "xp":
              return user.level?.xp ?? 0;
            case "cooldowns":
              if (!user.cooldowns) {
                return {};
              }
              return parseCooldownData(user.cooldowns.data, "Failed to parse cooldown data");
            case "upgrades":
              return reduceUpgrades(user.upgrades);
            default:
              return (
                user[field as keyof GuildUserShape] ??
                (DEFAULT_VALUES.user as Record<string, unknown>)[field]
              );
          }
        }

        const parsedCooldowns = parseCooldownData(
          user.cooldowns?.data,
          `Failed to parse cooldown data for ${userId} in guild ${guildId}`
        );

        return {
          ...user,
          balance: user.economy?.balance ?? DEFAULT_VALUES.economy.balance,
          bankBalance: user.economy?.bankBalance ?? DEFAULT_VALUES.economy.bankBalance,
          bankRate: user.economy?.bankRate ?? DEFAULT_VALUES.economy.bankRate,
          bankStartTime:
            user.economy?.bankStartTime ?? DEFAULT_VALUES.economy.bankStartTime,
          messageCount: user.stats?.messageCount ?? DEFAULT_VALUES.stats.messageCount,
          commandCount: user.stats?.commandCount ?? DEFAULT_VALUES.stats.commandCount,
          totalEarned: user.stats?.totalEarned ?? DEFAULT_VALUES.stats.totalEarned,
          xp: user.level?.xp ?? 0,
          cooldowns: parsedCooldowns,
          upgrades: reduceUpgrades(user.upgrades),
        };
      }

      return guild || DEFAULT_VALUES.guild;
    }

    const customData = (await client.analytics.findFirst({
      where: { type: parts[0] },
      orderBy: { timestamp: "desc" },
    })) as AnalyticsRecord | null;

    if (!customData) {
      return null;
    }

    let value: unknown = customData.data;
    for (let i = 1; i < parts.length; i += 1) {
      const pathPart = parts[i];
      if (!pathPart) {
        return null;
      }
      value = (value as Record<string, unknown> | undefined)?.[pathPart];
      if (value === undefined) {
        return null;
      }
    }

    return value;
  }

  throw new Error("Invalid path");
}

export { get };
