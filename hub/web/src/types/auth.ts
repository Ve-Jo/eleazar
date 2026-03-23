export type SessionUser = {
  id: string;
  username?: string;
  avatar?: string | null;
  locale?: string;
};

export type SessionInfo = {
  authenticated: boolean;
  user: SessionUser | null;
};
