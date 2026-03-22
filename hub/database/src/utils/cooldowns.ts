import { COOLDOWNS, UPGRADES } from "../constants/database.ts";

type CooldownMap = Record<string, number>;

type CooldownRecord = {
  data?: unknown;
};

type CooldownClient = {
  cooldown: {
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
  upgrade: {
    findMany: (args: unknown) => Promise<unknown>;
  };
};

type EnsureUserFn = (guildId: string, userId: string) => Promise<unknown>;

type UpgradeRecord = {
  type?: string;
  level?: number;
};

const cooldownDurations = COOLDOWNS as Record<string, number>;

function parseCooldownData(
  data: unknown,
  guildId: string,
  userId: string
): CooldownMap {
  if (!data) {
    return {};
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, Number(value || 0)])
    );
  }

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (typeof parsed === "object" && parsed && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [key, Number(value || 0)])
        );
      }
    } catch (error) {
      const typedError = error as Error;
      console.warn(
        `Failed to parse cooldown data for ${userId} in guild ${guildId}: ${typedError.message}`
      );
    }
  }

  return {};
}

function hasCrateCooldowns(cooldowns: CooldownMap): boolean {
  return Object.keys(cooldowns).some((key) => key.startsWith("crate_"));
}

async function getCooldown(
  client: CooldownClient,
  guildId: string,
  userId: string,
  type: string
): Promise<number> {
  const cooldownRecord = (await client.cooldown.findUnique({
    where: { guildId_userId: { guildId, userId } },
  })) as CooldownRecord | null;

  const cooldowns = parseCooldownData(cooldownRecord?.data, guildId, userId);
  const lastUsed = cooldowns[type] || 0;
  const baseTime = cooldownDurations[type] || 0;
  const now = Date.now();
  const isAbsoluteExpiry = lastUsed > now;
  let remaining = isAbsoluteExpiry
    ? Math.max(0, lastUsed - now)
    : Math.max(0, lastUsed + baseTime - now);

  if (remaining <= 0) {
    return 0;
  }

  // time_wizard applies percentage reduction to daily/weekly cooldowns only
  const dailyWeeklyTypes = new Set(["daily", "weekly", "crate_daily", "crate_weekly"]);
  const appliesTimeWizard = dailyWeeklyTypes.has(type);

  if (appliesTimeWizard) {
    const userUpgrades = (await client.upgrade.findMany({
      where: { userId, guildId },
    })) as UpgradeRecord[];

    const timeWizardLevel =
      userUpgrades.find((upgrade) => upgrade.type === "time_wizard")?.level || 1;
    const reductionPercent = (timeWizardLevel - 1) * (UPGRADES.time_wizard.effectMultiplier || 0);
    const timeWizardReduction = Math.floor(remaining * reductionPercent);
    remaining = Math.max(0, remaining - timeWizardReduction);
  }

  // crime_mastery provides additional crime-specific cooldown reduction
  if (type === "crime") {
    const userUpgrades = (await client.upgrade.findMany({
      where: { userId, guildId },
    })) as UpgradeRecord[];
    const crimeMasteryUpgrade = userUpgrades.find((upgrade) => upgrade.type === "crime_mastery");
    const crimeMasteryLevel = crimeMasteryUpgrade?.level || 1;
    const reduction = (crimeMasteryLevel - 1) * UPGRADES.crime_mastery.effectValue;
    return Math.max(0, remaining - reduction);
  }

  return remaining;
}

async function updateCooldown(
  client: CooldownClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  type: string
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const cooldownRecord = (await client.cooldown.findUnique({
    where: { guildId_userId: { guildId, userId } },
  })) as CooldownRecord | null;

  const cooldowns = parseCooldownData(cooldownRecord?.data, guildId, userId);
  cooldowns[type] = Date.now();

  const now = Date.now();
  Object.entries(cooldowns).forEach(([cooldownType, timestamp]) => {
    if (cooldownType.startsWith("crate_")) {
      return;
    }

    const baseTime = cooldownDurations[cooldownType];
    if (!baseTime || now >= timestamp + baseTime) {
      delete cooldowns[cooldownType];
    }
  });

  const hasCrates = hasCrateCooldowns(cooldowns);
  if (
    Object.keys(cooldowns).length === 0 ||
    (!hasCrates &&
      Object.keys(cooldowns).every((key) => {
        const baseTime = cooldownDurations[key];
        const value = cooldowns[key];
        return value === undefined || !baseTime || now >= value + baseTime;
      }))
  ) {
    if (cooldownRecord) {
      return client.cooldown.delete({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });
    }

    return { userId, guildId, data: {} };
  }

  try {
    return await client.cooldown.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        userId,
        guildId,
        data: cooldowns,
      },
      update: {
        data: cooldowns,
      },
    });
  } catch (error) {
    console.error(
      `Error updating cooldown for ${userId} in guild ${guildId}:`,
      error
    );
    return { userId, guildId, data: {} };
  }
}

async function setCooldown(
  client: CooldownClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  type: string,
  duration: number
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const cooldownRecord = (await client.cooldown.findUnique({
    where: { guildId_userId: { guildId, userId } },
  })) as CooldownRecord | null;

  const cooldowns = parseCooldownData(cooldownRecord?.data, guildId, userId);
  cooldowns[type] = Date.now() + duration;

  const now = Date.now();
  Object.entries(cooldowns).forEach(([cooldownType, timestamp]) => {
    if (cooldownType.startsWith("crate_")) {
      return;
    }

    const baseTime = cooldownDurations[cooldownType];
    if (!baseTime || now >= timestamp) {
      delete cooldowns[cooldownType];
    }
  });

  const hasCrates = hasCrateCooldowns(cooldowns);
  if (
    Object.keys(cooldowns).length === 0 ||
    (!hasCrates &&
      Object.keys(cooldowns).every((key) => {
        const baseTime = cooldownDurations[key];
        const value = cooldowns[key];
        return value === undefined || !baseTime || now >= value;
      }))
  ) {
    if (cooldownRecord) {
      return client.cooldown.delete({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });
    }

    return { userId, guildId, data: {} };
  }

  try {
    return await client.cooldown.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      create: {
        userId,
        guildId,
        data: cooldowns,
      },
      update: {
        data: cooldowns,
      },
    });
  } catch (error) {
    console.error(
      `Error setting cooldown for ${userId} in guild ${guildId}:`,
      error
    );
    return { userId, guildId, data: {} };
  }
}

async function updateCrateCooldown(
  client: CooldownClient,
  ensureUser: EnsureUserFn,
  guildId: string,
  userId: string,
  type: string
): Promise<unknown> {
  await ensureUser(guildId, userId);

  const cooldownRecord = (await client.cooldown.findUnique({
    where: { guildId_userId: { guildId, userId } },
  })) as CooldownRecord | null;

  const cooldowns = parseCooldownData(cooldownRecord?.data, guildId, userId);
  const crateKey = `crate_${type}`;
  const timestamp = Date.now();
  cooldowns[crateKey] = timestamp;

  console.log(`Setting cooldown for ${type}: ${timestamp} (key: ${crateKey})`);

  const now = Date.now();
  Object.entries(cooldowns).forEach(([key, value]) => {
    if (!key.startsWith("crate_")) {
      const baseTime = cooldownDurations[key];
      if (!baseTime || now >= value + baseTime) {
        delete cooldowns[key];
      }
    }
  });

  return client.cooldown.upsert({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    create: {
      userId,
      guildId,
      data: cooldowns,
    },
    update: {
      data: cooldowns,
    },
  });
}

async function reduceCooldown(
  client: CooldownClient,
  guildId: string,
  userId: string,
  type: string,
  amount: number
): Promise<unknown> {
  const cooldownRecord = (await client.cooldown.findUnique({
    where: { guildId_userId: { guildId, userId } },
  })) as CooldownRecord | null;

  if (!cooldownRecord) {
    return null;
  }

  const cooldowns = parseCooldownData(cooldownRecord.data, guildId, userId);
  const cooldownKey = type.startsWith("crate_")
    ? type
    : ["daily", "weekly"].includes(type)
      ? `crate_${type}`
      : type;

  if (!cooldowns[cooldownKey]) {
    return null;
  }

  const currentValue = cooldowns[cooldownKey];
  cooldowns[cooldownKey] = Math.max(currentValue - amount, Date.now() - 60 * 1000);

  return client.cooldown.update({
    where: {
      guildId_userId: {
        guildId,
        userId,
      },
    },
    data: {
      data: cooldowns,
    },
  });
}

export {
  getCooldown,
  updateCooldown,
  setCooldown,
  updateCrateCooldown,
  reduceCooldown,
};
