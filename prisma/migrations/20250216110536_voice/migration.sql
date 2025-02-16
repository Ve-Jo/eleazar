-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "joined_at" BIGINT NOT NULL,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_sessions_channel_id_idx" ON "voice_sessions"("channel_id");

-- CreateIndex
CREATE INDEX "voice_sessions_joined_at_idx" ON "voice_sessions"("joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "voice_sessions_user_id_guild_id_key" ON "voice_sessions"("user_id", "guild_id");

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
