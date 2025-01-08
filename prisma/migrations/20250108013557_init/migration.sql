-- CreateTable
CREATE TABLE "guilds" (
    "guild_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "counting" JSONB NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "users" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "total_xp" BIGINT NOT NULL DEFAULT 0,
    "banner_url" TEXT,
    "latest_activity" BIGINT NOT NULL,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "commands_used" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(20,5) NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("guild_id","user_id")
);

-- CreateTable
CREATE TABLE "user_cooldowns" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "daily_timestamp" BIGINT NOT NULL DEFAULT 0,
    "work_timestamp" BIGINT NOT NULL DEFAULT 0,
    "crime_timestamp" BIGINT NOT NULL DEFAULT 0,
    "message_timestamp" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "user_cooldowns_pkey" PRIMARY KEY ("guild_id","user_id")
);

-- CreateTable
CREATE TABLE "user_bank" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "started_to_hold" BIGINT NOT NULL,
    "holding_percentage" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_bank_pkey" PRIMARY KEY ("guild_id","user_id")
);

-- CreateTable
CREATE TABLE "user_upgrades" (
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "upgrade_type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "user_upgrades_pkey" PRIMARY KEY ("guild_id","user_id","upgrade_type")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cooldowns" ADD CONSTRAINT "user_cooldowns_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_bank" ADD CONSTRAINT "user_bank_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_upgrades" ADD CONSTRAINT "user_upgrades_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
