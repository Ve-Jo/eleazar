-- CreateTable
CREATE TABLE "guilds" (
    "guild_id" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "guilds_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "banner_url" TEXT,
    "last_activity" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "economy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "balance" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "bankBalance" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "bankRate" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "bankStartTime" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "economy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "total_earned" DECIMAL(20,5) NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "command_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cooldowns" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "cooldowns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "upgrades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics" (
    "id" SERIAL NOT NULL,
    "timestamp" BIGINT NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_guild_id_idx" ON "users"("guild_id");

-- CreateIndex
CREATE INDEX "users_last_activity_idx" ON "users"("last_activity");

-- CreateIndex
CREATE UNIQUE INDEX "users_guild_id_user_id_key" ON "users"("guild_id", "user_id");

-- CreateIndex
CREATE INDEX "economy_userId_idx" ON "economy"("userId");

-- CreateIndex
CREATE INDEX "economy_guildId_idx" ON "economy"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_userId_guildId_key" ON "economy"("userId", "guildId");

-- CreateIndex
CREATE INDEX "statistics_total_earned_idx" ON "statistics"("total_earned");

-- CreateIndex
CREATE INDEX "statistics_message_count_idx" ON "statistics"("message_count");

-- CreateIndex
CREATE INDEX "statistics_command_count_idx" ON "statistics"("command_count");

-- CreateIndex
CREATE UNIQUE INDEX "statistics_user_id_guild_id_key" ON "statistics"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "levels_xp_idx" ON "levels"("xp");

-- CreateIndex
CREATE UNIQUE INDEX "levels_user_id_guild_id_key" ON "levels"("user_id", "guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "cooldowns_user_id_guild_id_key" ON "cooldowns"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "upgrades_type_idx" ON "upgrades"("type");

-- CreateIndex
CREATE UNIQUE INDEX "upgrades_user_id_guild_id_type_key" ON "upgrades"("user_id", "guild_id", "type");

-- CreateIndex
CREATE INDEX "analytics_timestamp_idx" ON "analytics"("timestamp");

-- CreateIndex
CREATE INDEX "analytics_type_idx" ON "analytics"("type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy" ADD CONSTRAINT "economy_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrades" ADD CONSTRAINT "upgrades_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
