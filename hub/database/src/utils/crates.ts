type CrateRecord = {
  count?: number;
};

type CooldownRecord = {
  data?: Record<string, unknown> | null;
};

type CrateClient = {
  crate: {
    findMany: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  cooldown: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

async function getUserCrates(
  client: CrateClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.crate.findMany({
    where: { userId, guildId },
  });
}

async function getUserCrate(
  client: CrateClient,
  guildId: string,
  userId: string,
  crateType: string
): Promise<unknown> {
  return client.crate.upsert({
    where: {
      guildId_userId_type: { guildId, userId, type: crateType },
    },
    create: {
      userId,
      guildId,
      type: crateType,
      count: 0,
    },
    update: {},
  });
}

async function addCrate(
  client: CrateClient,
  guildId: string,
  userId: string,
  crateType: string,
  amount = 1
): Promise<unknown> {
  return client.crate.upsert({
    where: {
      guildId_userId_type: { guildId, userId, type: crateType },
    },
    create: {
      guildId,
      userId,
      type: crateType,
      count: amount,
    },
    update: {
      count: {
        increment: amount,
      },
    },
  });
}

async function removeCrate(
  client: CrateClient,
  guildId: string,
  userId: string,
  crateType: string,
  amount = 1
): Promise<unknown> {
  const currentCrate = (await getUserCrate(
    client,
    guildId,
    userId,
    crateType
  )) as CrateRecord;

  if ((currentCrate.count ?? 0) < amount) {
    throw new Error(
      `Insufficient crates. Has ${currentCrate.count ?? 0}, trying to remove ${amount}`
    );
  }

  return client.crate.update({
    where: {
      guildId_userId_type: { guildId, userId, type: crateType },
    },
    data: {
      count: {
        decrement: amount,
      },
    },
  });
}

async function getCrateCooldown(
  client: CrateClient,
  guildId: string,
  userId: string,
  crateType: string
): Promise<number | null> {
  const cooldown = (await client.cooldown.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  })) as CooldownRecord | null;

  if (!cooldown || !cooldown.data) {
    return null;
  }

  const crateKey = `crate_${crateType}`;
  const crateCooldown = cooldown.data[crateKey];

  console.log(
    `Getting cooldown for ${crateType}: key=${crateKey}, value=${crateCooldown}, data=`,
    cooldown.data
  );

  return typeof crateCooldown === "number" ? crateCooldown : null;
}

export {
  getUserCrates,
  getUserCrate,
  addCrate,
  removeCrate,
  getCrateCooldown,
};
