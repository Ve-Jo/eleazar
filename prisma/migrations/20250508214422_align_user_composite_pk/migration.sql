/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- Drop existing foreign key constraints
ALTER TABLE "economy" DROP CONSTRAINT "economy_userId_guildId_fkey";
ALTER TABLE "levels" DROP CONSTRAINT "levels_user_id_guild_id_fkey";
ALTER TABLE "statistics" DROP CONSTRAINT "statistics_user_id_guild_id_fkey";
ALTER TABLE "cooldowns" DROP CONSTRAINT "cooldowns_user_id_guild_id_fkey";
ALTER TABLE "upgrades" DROP CONSTRAINT "upgrades_user_id_guild_id_fkey";
ALTER TABLE "voice_sessions" DROP CONSTRAINT "voice_sessions_user_id_guild_id_fkey";
ALTER TABLE "crates" DROP CONSTRAINT "crates_user_id_guild_id_fkey";
ALTER TABLE "legacy_game_data" DROP CONSTRAINT "legacy_game_data_user_id_guild_id_fkey";
ALTER TABLE "crypto_positions" DROP CONSTRAINT "crypto_positions_user_id_guild_id_fkey";

-- Drop the problematic index (if it's not the PK's unique index, which it seems it is)
-- and the old primary key constraint.
-- The DROP INDEX might be redundant if it's the index backing users_pkey, 
-- but let's keep Prisma's original intention if users_guild_id_user_id_key is a separate unique index.
-- If users_guild_id_user_id_key IS the index for users_pkey (composite), then DROP CONSTRAINT users_pkey would drop it.
-- Given the error, users_guild_id_user_id_key is what FKs point to.
-- And users_pkey (likely on single user_id) is what Prisma thinks is the current PK. This is messy.

-- Let's assume users_pkey is the single-column PK that needs to go,
-- and users_guild_id_user_id_key is a unique index that FKs are latched onto.
ALTER TABLE "users" DROP CONSTRAINT "users_pkey"; -- Drop the old single-column PK
DROP INDEX IF EXISTS "users_guild_id_user_id_key"; -- Drop the unique index FKs were using

-- Add the new composite primary key
ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("guild_id", "user_id");

-- Recreate foreign key constraints referencing the new composite primary key
ALTER TABLE "economy" ADD CONSTRAINT "economy_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "levels" ADD CONSTRAINT "levels_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "upgrades" ADD CONSTRAINT "upgrades_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crates" ADD CONSTRAINT "crates_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legacy_game_data" ADD CONSTRAINT "legacy_game_data_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crypto_positions" ADD CONSTRAINT "crypto_positions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
