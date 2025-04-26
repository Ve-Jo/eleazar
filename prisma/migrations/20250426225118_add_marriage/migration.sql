/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
-- DROP INDEX "users_guild_id_user_id_key";

-- AlterTable
-- ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
-- ADD CONSTRAINT "users_pkey" PRIMARY KEY ("guild_id", "user_id");

-- CreateTable
CREATE TABLE "marriages" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id1" TEXT NOT NULL,
    "user_id2" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marriages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marriages_guild_id_user_id1_idx" ON "marriages"("guild_id", "user_id1");

-- CreateIndex
CREATE INDEX "marriages_guild_id_user_id2_idx" ON "marriages"("guild_id", "user_id2");

-- CreateIndex
CREATE INDEX "marriages_status_idx" ON "marriages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marriages_guild_id_user_id1_user_id2_key" ON "marriages"("guild_id", "user_id1", "user_id2");
