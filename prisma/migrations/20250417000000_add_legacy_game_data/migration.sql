-- CreateTable
CREATE TABLE "legacy_game_data" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "legacy_game_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legacy_game_data_game_id_idx" ON "legacy_game_data"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_game_data_user_id_guild_id_game_id_key" ON "legacy_game_data"("user_id", "guild_id", "game_id");

-- AddForeignKey
ALTER TABLE "legacy_game_data" ADD CONSTRAINT "legacy_game_data_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE; 