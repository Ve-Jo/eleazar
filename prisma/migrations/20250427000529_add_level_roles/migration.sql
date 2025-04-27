/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/

-- CreateTable
CREATE TABLE "level_roles" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL,

    CONSTRAINT "level_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "level_roles_guild_id_idx" ON "level_roles"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_roles_guild_id_role_id_key" ON "level_roles"("guild_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_roles_guild_id_required_level_key" ON "level_roles"("guild_id", "required_level");
