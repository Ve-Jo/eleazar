type LocaleRecord = {
  locale?: string | null;
};

type UserLocaleClient = {
  user: {
    findUnique: (args: unknown) => Promise<unknown>;
  };
};

type UpdateUserFn = (
  guildId: string,
  userId: string,
  data: Record<string, unknown>
) => Promise<unknown>;

async function getUserLocale(
  client: UserLocaleClient,
  guildId: string,
  userId: string
): Promise<string | null> {
  const user = (await client.user.findUnique({
    where: { guildId_id: { guildId, id: userId } },
    select: { locale: true },
  })) as LocaleRecord | null;

  return user ? (user.locale ?? null) : null;
}

async function setUserLocale(
  updateUser: UpdateUserFn,
  guildId: string,
  userId: string,
  locale: string
): Promise<void> {
  await updateUser(guildId, userId, { locale });
}

export { getUserLocale, setUserLocale };
