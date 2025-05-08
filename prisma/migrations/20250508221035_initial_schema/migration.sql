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
    "locale" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("guild_id","user_id")
);

-- CreateTable
CREATE TABLE "economy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "balance" DECIMAL(30,5) NOT NULL DEFAULT 0,
    "bankBalance" DECIMAL(30,5) NOT NULL DEFAULT 0,
    "bankRate" DECIMAL(10,5) NOT NULL DEFAULT 0,
    "bankStartTime" BIGINT NOT NULL DEFAULT 0,
    "upgrade_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,

    CONSTRAINT "economy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "gameXp" BIGINT NOT NULL DEFAULT 0,
    "season_xp" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statistics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "total_earned" DECIMAL(30,5) NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "command_count" INTEGER NOT NULL DEFAULT 0,
    "last_updated" BIGINT NOT NULL DEFAULT 0,
    "game_records" JSONB NOT NULL DEFAULT '{"2048": {"highScore": 0}, "snake": {"highScore": 0}}',
    "xp_stats" JSONB NOT NULL DEFAULT '{"chat": 0, "voice": 0}',
    "game_xp_stats" JSONB NOT NULL DEFAULT '{"2048": 0, "snake": 0}',
    "interaction_stats" JSONB NOT NULL DEFAULT '{"modals": {}, "buttons": {}, "commands": {}, "selectMenus": {}}',
    "voice_time" BIGINT NOT NULL DEFAULT 0,
    "crypto2_disclaimer_seen" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "statistics_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "music_players" (
    "guild_id" TEXT NOT NULL,
    "voice_channel_id" TEXT NOT NULL,
    "text_channel_id" TEXT NOT NULL,
    "queue" JSONB NOT NULL DEFAULT '[]',
    "current_track" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "volume" INTEGER NOT NULL DEFAULT 100,
    "repeat_mode" TEXT NOT NULL DEFAULT 'off',
    "autoplay" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_players_pkey" PRIMARY KEY ("guild_id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "season_ends" BIGINT NOT NULL,
    "season_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "joined_at" BIGINT NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "acquired" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "crates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_game_data" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "legacy_game_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entry_price" DECIMAL(30,8) NOT NULL,
    "quantity" DECIMAL(30,8) NOT NULL,
    "leverage" INTEGER NOT NULL,
    "take_profit_price" DECIMAL(30,8),
    "stop_loss_price" DECIMAL(30,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_positions_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "level_roles" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "required_level" INTEGER NOT NULL,

    CONSTRAINT "level_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_guild_id_idx" ON "users"("guild_id");

-- CreateIndex
CREATE INDEX "users_last_activity_idx" ON "users"("last_activity");

-- CreateIndex
CREATE INDEX "economy_userId_idx" ON "economy"("userId");

-- CreateIndex
CREATE INDEX "economy_guildId_idx" ON "economy"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "economy_userId_guildId_key" ON "economy"("userId", "guildId");

-- CreateIndex
CREATE INDEX "levels_xp_idx" ON "levels"("xp");

-- CreateIndex
CREATE INDEX "levels_gameXp_idx" ON "levels"("gameXp");

-- CreateIndex
CREATE INDEX "levels_season_xp_idx" ON "levels"("season_xp");

-- CreateIndex
CREATE UNIQUE INDEX "levels_user_id_guild_id_key" ON "levels"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "statistics_total_earned_idx" ON "statistics"("total_earned");

-- CreateIndex
CREATE INDEX "statistics_message_count_idx" ON "statistics"("message_count");

-- CreateIndex
CREATE INDEX "statistics_command_count_idx" ON "statistics"("command_count");

-- CreateIndex
CREATE UNIQUE INDEX "statistics_user_id_guild_id_key" ON "statistics"("user_id", "guild_id");

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

-- CreateIndex
CREATE INDEX "voice_sessions_channel_id_idx" ON "voice_sessions"("channel_id");

-- CreateIndex
CREATE INDEX "voice_sessions_joined_at_idx" ON "voice_sessions"("joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "voice_sessions_user_id_guild_id_key" ON "voice_sessions"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "crates_type_idx" ON "crates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "crates_user_id_guild_id_type_key" ON "crates"("user_id", "guild_id", "type");

-- CreateIndex
CREATE INDEX "legacy_game_data_game_id_idx" ON "legacy_game_data"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_game_data_user_id_guild_id_game_id_key" ON "legacy_game_data"("user_id", "guild_id", "game_id");

-- CreateIndex
CREATE INDEX "crypto_positions_user_id_guild_id_idx" ON "crypto_positions"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "crypto_positions_symbol_idx" ON "crypto_positions"("symbol");

-- CreateIndex
CREATE INDEX "marriages_guild_id_user_id1_idx" ON "marriages"("guild_id", "user_id1");

-- CreateIndex
CREATE INDEX "marriages_guild_id_user_id2_idx" ON "marriages"("guild_id", "user_id2");

-- CreateIndex
CREATE INDEX "marriages_status_idx" ON "marriages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "marriages_guild_id_user_id1_user_id2_key" ON "marriages"("guild_id", "user_id1", "user_id2");

-- CreateIndex
CREATE INDEX "level_roles_guild_id_idx" ON "level_roles"("guild_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_roles_guild_id_role_id_key" ON "level_roles"("guild_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_roles_guild_id_required_level_key" ON "level_roles"("guild_id", "required_level");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guilds"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "economy" ADD CONSTRAINT "economy_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statistics" ADD CONSTRAINT "statistics_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cooldowns" ADD CONSTRAINT "cooldowns_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upgrades" ADD CONSTRAINT "upgrades_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crates" ADD CONSTRAINT "crates_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_game_data" ADD CONSTRAINT "legacy_game_data_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_positions" ADD CONSTRAINT "crypto_positions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
