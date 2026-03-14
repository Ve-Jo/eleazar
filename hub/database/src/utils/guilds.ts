type GuildClient = {
  guild: {
    upsert: (args: unknown) => Promise<unknown>;
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

async function ensureGuild(client: GuildClient, guildId: string): Promise<unknown> {
  return client.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, settings: {} },
    update: {},
  });
}

async function getGuild(client: GuildClient, guildId: string): Promise<unknown> {
  return client.guild.findUnique({
    where: { id: guildId },
    include: { users: true },
  });
}

async function upsertGuild(
  client: GuildClient,
  guildId: string,
  data: Record<string, unknown> = {}
): Promise<unknown> {
  return client.guild.upsert({
    where: { id: guildId },
    create: { id: guildId, ...data },
    update: data,
  });
}

export { ensureGuild, getGuild, upsertGuild };
