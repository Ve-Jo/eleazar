type UserReadClient = {
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

type UserReadTransaction = {
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

async function getUser(
  client: UserReadClient,
  guildId: string,
  userId: string,
  includeRelations = true,
  tx: UserReadTransaction | null = null
): Promise<unknown> {
  const prisma = tx || client;

  try {
    return await prisma.user.findUnique({
      where: { guildId_id: { guildId, id: userId } },
      include: includeRelations
        ? {
            economy: true,
            stats: true,
            cooldowns: true,
            upgrades: true,
            Level: true,
            VoiceSession: true,
            crates: true,
          }
        : undefined,
    });
  } catch (error) {
    console.error(`Error fetching user ${userId} in guild ${guildId}:`, error);
    throw error;
  }
}

export { getUser };
