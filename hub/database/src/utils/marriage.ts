type MarriageClient = {
  marriage: {
    create: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    findFirst: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

type EnsureUserFn = (guildId: string, userId: string) => Promise<unknown>;

type GetMarriageStatusFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type MarriageRecord = {
  id: string;
  userId1: string;
  userId2: string;
  status: string;
  createdAt?: Date;
};

async function proposeMarriage(
  client: MarriageClient,
  ensureUser: EnsureUserFn,
  getMarriageStatus: GetMarriageStatusFn,
  guildId: string,
  userId1: string,
  userId2: string
): Promise<unknown> {
  await ensureUser(guildId, userId1);
  await ensureUser(guildId, userId2);

  const existingMarriage = await getMarriageStatus(guildId, userId1);
  if (existingMarriage) {
    throw new Error("User 1 is already married or has a pending proposal.");
  }

  const existingMarriage2 = await getMarriageStatus(guildId, userId2);
  if (existingMarriage2) {
    throw new Error("User 2 is already married or has a pending proposal.");
  }

  return client.marriage.create({
    data: {
      guildId,
      userId1,
      userId2,
      status: "PENDING",
    },
  });
}

async function acceptMarriage(
  client: MarriageClient,
  guildId: string,
  userId1: string,
  userId2: string
): Promise<unknown> {
  const pendingProposal = (await client.marriage.findUnique({
    where: {
      guildId_userId1_userId2: {
        guildId,
        userId1,
        userId2,
      },
      status: "PENDING",
    },
  })) as MarriageRecord | null;

  if (!pendingProposal) {
    const reverseProposal = (await client.marriage.findUnique({
      where: {
        guildId_userId1_userId2: {
          guildId,
          userId1: userId2,
          userId2: userId1,
        },
        status: "PENDING",
      },
    })) as MarriageRecord | null;

    if (!reverseProposal) {
      throw new Error("No pending marriage proposal found from this user.");
    }

    return client.marriage.update({
      where: {
        id: reverseProposal.id,
      },
      data: {
        status: "MARRIED",
      },
    });
  }

  return client.marriage.update({
    where: {
      id: pendingProposal.id,
    },
    data: {
      status: "MARRIED",
    },
  });
}

async function rejectMarriage(
  client: MarriageClient,
  guildId: string,
  userId1: string,
  userId2: string
): Promise<unknown> {
  const pendingProposal = (await client.marriage.findUnique({
    where: {
      guildId_userId1_userId2: {
        guildId,
        userId1,
        userId2,
      },
      status: "PENDING",
    },
  })) as MarriageRecord | null;

  if (!pendingProposal) {
    const reverseProposal = (await client.marriage.findUnique({
      where: {
        guildId_userId1_userId2: {
          guildId,
          userId1: userId2,
          userId2: userId1,
        },
        status: "PENDING",
      },
    })) as MarriageRecord | null;

    if (!reverseProposal) {
      throw new Error(
        "No pending marriage proposal found involving these users."
      );
    }

    return client.marriage.delete({ where: { id: reverseProposal.id } });
  }

  return client.marriage.delete({ where: { id: pendingProposal.id } });
}

async function getMarriageStatus(
  client: MarriageClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  const marriage = (await client.marriage.findFirst({
    where: {
      guildId,
      OR: [{ userId1: userId }, { userId2: userId }],
    },
  })) as MarriageRecord | null;

  if (!marriage) {
    return null;
  }

  const partnerId = marriage.userId1 === userId ? marriage.userId2 : marriage.userId1;
  return {
    partnerId,
    status: marriage.status,
    createdAt: marriage.createdAt,
  };
}

async function dissolveMarriage(
  client: MarriageClient,
  guildId: string,
  userId1: string,
  userId2: string
): Promise<unknown> {
  const marriage = (await client.marriage.findFirst({
    where: {
      guildId,
      OR: [
        { userId1, userId2 },
        { userId1: userId2, userId2: userId1 },
      ],
      status: "MARRIED",
    },
  })) as MarriageRecord | null;

  if (!marriage) {
    throw new Error("No active marriage found between these users.");
  }

  return client.marriage.delete({
    where: {
      id: marriage.id,
    },
  });
}

export {
  proposeMarriage,
  acceptMarriage,
  rejectMarriage,
  getMarriageStatus,
  dissolveMarriage,
};
