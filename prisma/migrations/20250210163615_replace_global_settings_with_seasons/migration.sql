/*
  Warnings:

  - You are about to drop the `global_settings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "global_settings";

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL DEFAULT 'current',
    "season_ends" BIGINT NOT NULL,
    "season_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);
