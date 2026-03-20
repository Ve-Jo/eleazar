type LevelRoleClient = {
  levelRole: {
    findMany: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: LevelRoleClient) => Promise<T>) => Promise<T>;
};

const LEVEL_ROLE_MODES = {
  TEXT: "text",
  VOICE: "voice",
  GAMING: "gaming",
  COMBINED_ACTIVITY: "combined_activity",
  COMBINED_ALL: "combined_all",
} as const;

type LevelRoleMode = (typeof LEVEL_ROLE_MODES)[keyof typeof LEVEL_ROLE_MODES];

const VALID_LEVEL_ROLE_MODES = new Set<string>(Object.values(LEVEL_ROLE_MODES));

function normalizeLevelRoleMode(mode?: string | null): LevelRoleMode {
  const normalized = String(mode || "").trim().toLowerCase();
  if (VALID_LEVEL_ROLE_MODES.has(normalized)) {
    return normalized as LevelRoleMode;
  }
  return LEVEL_ROLE_MODES.TEXT;
}

function ensureValidMode(mode: string): LevelRoleMode {
  const normalized = normalizeLevelRoleMode(mode);
  if (!VALID_LEVEL_ROLE_MODES.has(normalized)) {
    throw new Error(`Invalid level role mode: ${mode}`);
  }
  return normalized;
}

async function getLevelRoles(client: LevelRoleClient, guildId: string): Promise<unknown> {
  return client.levelRole.findMany({
    where: { guildId },
    orderBy: [{ mode: "asc" }, { requiredLevel: "asc" }],
  });
}

async function getEligibleLevelRole(
  client: LevelRoleClient,
  guildId: string,
  currentLevel: number,
  mode = LEVEL_ROLE_MODES.TEXT
): Promise<unknown> {
  const normalizedMode = normalizeLevelRoleMode(mode);

  return client.levelRole.findFirst({
    where: {
      guildId,
      mode: normalizedMode,
      requiredLevel: {
        lte: currentLevel,
      },
    },
    orderBy: {
      requiredLevel: "desc",
    },
  });
}

async function getNextLevelRole(
  client: LevelRoleClient,
  guildId: string,
  currentLevel: number,
  mode = LEVEL_ROLE_MODES.TEXT
): Promise<unknown> {
  const normalizedMode = normalizeLevelRoleMode(mode);

  return client.levelRole.findFirst({
    where: {
      guildId,
      mode: normalizedMode,
      requiredLevel: {
        gt: currentLevel,
      },
    },
    orderBy: {
      requiredLevel: "asc",
    },
  });
}

async function addLevelRole(
  client: LevelRoleClient,
  guildId: string,
  roleId: string,
  requiredLevel: number,
  mode = LEVEL_ROLE_MODES.TEXT,
  replaceLowerRoles = true
): Promise<unknown> {
  if (requiredLevel < 1) {
    throw new Error("Required level must be at least 1.");
  }

  const normalizedMode = ensureValidMode(mode);

  return client.$transaction(async (tx) => {
    const existingRoleForLevel = (await tx.levelRole.findUnique({
      where: {
        guildId_mode_requiredLevel: {
          guildId,
          mode: normalizedMode,
          requiredLevel,
        },
      },
    })) as { roleId?: string } | null;

    if (existingRoleForLevel && existingRoleForLevel.roleId !== roleId) {
      throw new Error(
        `A different role (${existingRoleForLevel.roleId}) is already assigned to level ${requiredLevel} in mode ${normalizedMode}.`
      );
    }

    const existingLevelForRole = (await tx.levelRole.findUnique({
      where: { guildId_roleId: { guildId, roleId } },
    })) as { requiredLevel?: number } | null;

    if (
      existingLevelForRole &&
      existingLevelForRole.requiredLevel !== requiredLevel
    ) {
      throw new Error(
        `This role (${roleId}) is already assigned to level ${existingLevelForRole.requiredLevel}. Remove it first.`
      );
    }

    return tx.levelRole.upsert({
      where: { guildId_roleId: { guildId, roleId } },
      create: {
        guildId,
        roleId,
        requiredLevel,
        mode: normalizedMode,
        replaceLowerRoles: Boolean(replaceLowerRoles),
      },
      update: {
        requiredLevel,
        mode: normalizedMode,
        replaceLowerRoles: Boolean(replaceLowerRoles),
      },
    });
  });
}

async function removeLevelRole(
  client: LevelRoleClient,
  guildId: string,
  roleId: string
): Promise<unknown> {
  const result = (await client.levelRole.deleteMany({
    where: { guildId, roleId },
  })) as { count?: number };

  if (result.count === 0) {
    throw new Error(`Level role with ID ${roleId} not found for this guild.`);
  }

  return result;
}

export {
  LEVEL_ROLE_MODES,
  getLevelRoles,
  getEligibleLevelRole,
  getNextLevelRole,
  addLevelRole,
  removeLevelRole,
};
