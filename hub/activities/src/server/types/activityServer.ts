import type express from "express";

export type JsonResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

export type ActivityAuthUser = {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
  locale?: string;
};

export type AuthenticatedRequest = express.Request & {
  authMode?: "bearer" | "activity_key" | "development";
  authUser?: ActivityAuthUser;
};

export type ActivityUserRecord = {
  id?: string;
  guildId?: string;
  locale?: string | null;
  economy?: Record<string, unknown> | null;
  crates?: Array<Record<string, unknown>> | null;
  upgrades?: Array<Record<string, unknown>> | null;
  stats?: Record<string, unknown> | null;
  Level?: Record<string, unknown> | null;
};
