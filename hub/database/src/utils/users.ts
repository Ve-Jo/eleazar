type GetUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

type CreateUserFn = (
  guildId: string,
  userId: string
) => Promise<unknown>;

async function ensureUser(
  getUser: GetUserFn,
  createUser: CreateUserFn,
  guildId: string,
  userId: string
): Promise<unknown> {
  const user = await getUser(guildId, userId);

  if (!user) {
    return createUser(guildId, userId);
  }

  return user;
}

export { ensureUser };
