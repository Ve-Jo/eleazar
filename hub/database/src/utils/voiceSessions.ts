type EnsureGuildUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type AddXPFn = (
  guildId: string,
  userId: string,
  amount: number,
  type: string
) => Promise<{ levelUp?: unknown }>;

type VoiceSessionClient = {
  guild: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
  voiceSession: {
    upsert: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown>;
  };
  statistics: {
    update: (args: unknown) => Promise<unknown>;
  };
};

type GuildSettingsRecord = {
  settings?: {
    xp_per_voice_minute?: number;
  } | null;
};

type VoiceSessionRecord = {
  joinedAt: number | bigint | string;
};

async function createVoiceSession(
  client: VoiceSessionClient,
  ensureGuildUser: EnsureGuildUserFn,
  guildId: string,
  userId: string,
  channelId: string,
  joinedAt: number | bigint | string
): Promise<unknown> {
  await ensureGuildUser(guildId, userId);

  return client.voiceSession.upsert({
    where: {
      guildId_userId: { guildId, userId },
    },
    create: {
      channelId,
      joinedAt: BigInt(joinedAt),
      user: {
        connect: {
          guildId_id: { guildId, id: userId },
        },
      },
    },
    update: {
      channelId,
      joinedAt: BigInt(joinedAt),
    },
  });
}

async function removeVoiceSession(
  client: VoiceSessionClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.voiceSession.delete({
    where: {
      guildId_userId: { guildId, userId },
    },
  });
}

async function getVoiceSession(
  client: VoiceSessionClient,
  guildId: string,
  userId: string
): Promise<unknown> {
  return client.voiceSession.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  });
}

async function getAllVoiceSessions(
  client: VoiceSessionClient,
  guildId: string,
  channelId: string
): Promise<unknown> {
  return client.voiceSession.findMany({
    where: {
      guildId,
      channelId,
    },
  });
}

async function calculateAndAddVoiceXP(
  client: VoiceSessionClient,
  addXP: AddXPFn,
  guildId: string,
  userId: string,
  session: VoiceSessionRecord
): Promise<{ timeSpent: number; xpAmount: number; levelUp: unknown | null }> {
  const timeSpent = Date.now() - Number(session.joinedAt);

  const guildSettings = (await client.guild.findUnique({
    where: { id: guildId },
    select: { settings: true },
  })) as GuildSettingsRecord | null;

  const xpPerMinute = guildSettings?.settings?.xp_per_voice_minute || 1;
  const xpAmount = Math.floor((timeSpent / 60000) * xpPerMinute);

  if (xpAmount > 0) {
    const xpResult = await addXP(guildId, userId, xpAmount, "voice");

    await client.statistics.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data: {
        voiceTime: {
          increment: timeSpent,
        },
      },
    });

    return { timeSpent, xpAmount, levelUp: xpResult.levelUp ?? null };
  }

  return { timeSpent, xpAmount: 0, levelUp: null };
}

export {
  createVoiceSession,
  removeVoiceSession,
  getVoiceSession,
  getAllVoiceSessions,
  calculateAndAddVoiceXP,
};
