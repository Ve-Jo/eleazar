type UserRecord = {
  lastActivity?: number | bigint | string | null;
};

type ErrorWithCode = {
  code?: string;
};

type EnsureGuildUserClient = {
  guild: {
    upsert: (args: unknown) => Promise<unknown>;
  };
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    create: (args: unknown) => Promise<unknown>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  $transaction: <T>(callback: (tx: EnsureGuildUserClient) => Promise<T>) => Promise<T>;
};

async function ensureGuildUser(
  client: EnsureGuildUserClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  try {
    const existingUser = (await client.user.findUnique({
      where: {
        guildId_id: {
          guildId,
          id: userId,
        },
      },
    })) as UserRecord | null;

    if (existingUser) {
      const currentTime = Date.now();
      const lastActivityTime = Number(existingUser.lastActivity || 0);
      const lastActivityAge = currentTime - lastActivityTime;

      if (lastActivityAge > 5 * 60 * 1000) {
        return client.user.update({
          where: {
            guildId_id: {
              guildId,
              id: userId,
            },
          },
          data: {
            lastActivity: Date.now(),
          },
        });
      }

      return existingUser;
    }

    return client.$transaction(async (prisma) => {
      await prisma.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, settings: {} },
        update: {},
      });

      try {
        return await prisma.user.create({
          data: {
            id: userId,
            guildId,
            lastActivity: Date.now(),
          },
        });
      } catch (error) {
        const typedError = error as ErrorWithCode;

        if (typedError.code === "P2002") {
          try {
            return await prisma.user.findUnique({
              where: {
                guildId_id: {
                  guildId,
                  id: userId,
                },
              },
            });
          } catch (findError) {
            console.error("Error finding existing user:", findError);
            throw findError;
          }
        }

        throw error;
      }
    });
  } catch (error) {
    console.error(
      `Error in ensureGuildUser for userId ${userId} in guild ${guildId}:`,
      error
    );

    try {
      await client.guild.upsert({
        where: { id: guildId },
        create: { id: guildId, settings: {} },
        update: {},
      });

      return await client.user.upsert({
        where: {
          guildId_id: {
            guildId,
            id: userId,
          },
        },
        create: {
          id: userId,
          guildId,
          lastActivity: Date.now(),
        },
        update: {
          lastActivity: Date.now(),
        },
      });
    } catch (secondError) {
      console.error(
        `Final fallback failed for userId ${userId} in guild ${guildId}:`,
        secondError
      );
      throw secondError;
    }
  }
}

export { ensureGuildUser };
