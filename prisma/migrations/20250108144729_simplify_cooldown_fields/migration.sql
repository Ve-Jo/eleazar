/*
  Warnings:

  - The primary key for the `user_cooldowns` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `crime_timestamp` on the `user_cooldowns` table. All the data in the column will be lost.
  - You are about to drop the column `daily_timestamp` on the `user_cooldowns` table. All the data in the column will be lost.
  - You are about to drop the column `guild_id` on the `user_cooldowns` table. All the data in the column will be lost.
  - You are about to drop the column `message_timestamp` on the `user_cooldowns` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `user_cooldowns` table. All the data in the column will be lost.
  - You are about to drop the column `work_timestamp` on the `user_cooldowns` table. All the data in the column will be lost.
  - Added the required column `guildId` to the `user_cooldowns` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `user_cooldowns` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "user_cooldowns" DROP CONSTRAINT "user_cooldowns_guild_id_user_id_fkey";

-- AlterTable
ALTER TABLE "user_cooldowns" DROP CONSTRAINT "user_cooldowns_pkey",
DROP COLUMN "crime_timestamp",
DROP COLUMN "daily_timestamp",
DROP COLUMN "guild_id",
DROP COLUMN "message_timestamp",
DROP COLUMN "user_id",
DROP COLUMN "work_timestamp",
ADD COLUMN     "crime" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "daily" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "guildId" TEXT NOT NULL,
ADD COLUMN     "message" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "work" BIGINT NOT NULL DEFAULT 0,
ADD CONSTRAINT "user_cooldowns_pkey" PRIMARY KEY ("guildId", "userId");

-- CreateIndex
CREATE INDEX "user_cooldowns_guildId_idx" ON "user_cooldowns"("guildId");

-- AddForeignKey
ALTER TABLE "user_cooldowns" ADD CONSTRAINT "user_cooldowns_guildId_userId_fkey" FOREIGN KEY ("guildId", "userId") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
