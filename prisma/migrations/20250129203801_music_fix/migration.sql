/*
  Warnings:

  - You are about to drop the column `currentTrack` on the `music_players` table. All the data in the column will be lost.
  - You are about to drop the column `lastUpdated` on the `music_players` table. All the data in the column will be lost.
  - You are about to drop the column `repeatMode` on the `music_players` table. All the data in the column will be lost.
  - You are about to drop the column `textChannelId` on the `music_players` table. All the data in the column will be lost.
  - You are about to drop the column `voiceChannelId` on the `music_players` table. All the data in the column will be lost.
  - Added the required column `last_updated` to the `music_players` table without a default value. This is not possible if the table is not empty.
  - Added the required column `text_channel_id` to the `music_players` table without a default value. This is not possible if the table is not empty.
  - Added the required column `voice_channel_id` to the `music_players` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "music_players" DROP COLUMN "currentTrack",
DROP COLUMN "lastUpdated",
DROP COLUMN "repeatMode",
DROP COLUMN "textChannelId",
DROP COLUMN "voiceChannelId",
ADD COLUMN     "current_track" JSONB,
ADD COLUMN     "last_updated" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "repeat_mode" TEXT NOT NULL DEFAULT 'off',
ADD COLUMN     "text_channel_id" TEXT NOT NULL,
ADD COLUMN     "voice_channel_id" TEXT NOT NULL,
ALTER COLUMN "queue" SET DEFAULT '[]',
ALTER COLUMN "position" SET DEFAULT 0;
