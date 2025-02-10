-- AlterTable
ALTER TABLE "statistics" ADD COLUMN     "interaction_stats" JSONB NOT NULL DEFAULT '{"commands":{}, "buttons":{}, "selectMenus":{}, "modals":{}}',
ADD COLUMN     "voice_time" BIGINT NOT NULL DEFAULT 0;
