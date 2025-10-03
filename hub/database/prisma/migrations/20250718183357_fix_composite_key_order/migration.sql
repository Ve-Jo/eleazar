/*
  Warnings:

  - You are about to drop the `legacy_game_data` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[guild_id,user_id]` on the table `cooldowns` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guild_id,user_id,type]` on the table `crates` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guildId,userId]` on the table `economy` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guild_id,user_id]` on the table `levels` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guild_id,user_id]` on the table `statistics` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guild_id,user_id,type]` on the table `upgrades` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[guild_id,user_id]` on the table `voice_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "cooldowns" DROP CONSTRAINT "cooldowns_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "crates" DROP CONSTRAINT "crates_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "crypto_positions" DROP CONSTRAINT "crypto_positions_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "economy" DROP CONSTRAINT "economy_userId_guildId_fkey";

-- DropForeignKey
ALTER TABLE "legacy_game_data" DROP CONSTRAINT "legacy_game_data_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "levels" DROP CONSTRAINT "levels_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "statistics" DROP CONSTRAINT "statistics_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "upgrades" DROP CONSTRAINT "upgrades_user_id_guild_id_fkey";

-- DropForeignKey
ALTER TABLE "voice_sessions" DROP CONSTRAINT "voice_sessions_user_id_guild_id_fkey";

-- DropIndex
DROP INDEX "cooldowns_user_id_guild_id_key";

-- DropIndex
DROP INDEX "crates_user_id_guild_id_type_key";

-- DropIndex
DROP INDEX "crypto_positions_user_id_guild_id_idx";

-- DropIndex
DROP INDEX "economy_userId_guildId_key";

-- DropIndex
DROP INDEX "levels_user_id_guild_id_key";

-- DropIndex
DROP INDEX "statistics_user_id_guild_id_key";

-- DropIndex
DROP INDEX "upgrades_user_id_guild_id_type_key";

-- DropIndex
DROP INDEX "voice_sessions_user_id_guild_id_key";

-- DropTable
DROP TABLE "legacy_game_data";

-- CreateIndex
CREATE UNIQUE INDEX "cooldowns_guild_id_user_id_key" ON "cooldowns"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "crates_guild_id_user_id_type_key" ON "crates"("guild_id", "user_id", "type");

-- CreateIndex
CREATE INDEX "crypto_positions_guild_id_user_id_idx" ON "crypto_positions"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "economy_guildId_userId_key" ON "economy"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "levels_guild_id_user_id_key" ON "levels"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "statistics_guild_id_user_id_key" ON "statistics"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "upgrades_guild_id_user_id_type_key" ON "upgrades"("guild_id", "user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "voice_sessions_guild_id_user_id_key" ON "voice_sessions"("guild_id", "user_id");

-- AddForeignKey
ALTER TABLE "economy" ADD CONSTRAINT "economy_guildId_userId_fkey" FOREIGN KEY ("guildId", "userId") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrades" ADD CONSTRAINT "upgrades_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crates" ADD CONSTRAINT "crates_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_positions" ADD CONSTRAINT "crypto_positions_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
