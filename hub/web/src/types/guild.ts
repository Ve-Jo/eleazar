export type ManageableGuild = {
  id: string;
  name: string;
  icon?: string | null;
  permissions?: string;
};

export type GuildListResponse = {
  guilds: ManageableGuild[];
};
