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

async function getLevelRoles(client: LevelRoleClient, guildId: string): Promise<unknown> {
  return client.levelRole.findMany({
    where: { guildId },
    orderBy: { requiredLevel: "asc" },
  });
}

async function getEligibleLevelRole(
  client: LevelRoleClient,
  guildId: string,
  currentLevel: number
): Promise<unknown> {
  return client.levelRole.findFirst({
    where: {
      guildId,
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
  currentLevel: number
): Promise<unknown> {
  return client.levelRole.findFirst({
    where: {
      guildId,
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
  requiredLevel: number
): Promise<unknown> {
  if (requiredLevel < 1) {
    throw new Error("Required level must be at least 1.");
  }

  return client.$transaction(async (tx) => {
    const existingRoleForLevel = (await tx.levelRole.findUnique({
      where: { guildId_requiredLevel: { guildId, requiredLevel } },
    })) as { roleId?: string } | null;

    if (existingRoleForLevel && existingRoleForLevel.roleId !== roleId) {
      throw new Error(
        `A different role (${existingRoleForLevel.roleId}) is already assigned to level ${requiredLevel}.`
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
      create: { guildId, roleId, requiredLevel },
      update: { requiredLevel },
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
  getLevelRoles,
  getEligibleLevelRole,
  getNextLevelRole,
  addLevelRole,
  removeLevelRole,
};
