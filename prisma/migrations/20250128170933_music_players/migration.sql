-- CreateTable
CREATE TABLE "music_players" (
    "guild_id" TEXT NOT NULL,
    "voiceChannelId" TEXT NOT NULL,
    "textChannelId" TEXT NOT NULL,
    "queue" JSONB NOT NULL,
    "currentTrack" JSONB,
    "position" INTEGER NOT NULL,
    "volume" INTEGER NOT NULL DEFAULT 100,
    "repeatMode" TEXT NOT NULL DEFAULT 'off',
    "autoplay" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_players_pkey" PRIMARY KEY ("guild_id")
);
