-- AlterTable
ALTER TABLE "economy" ADD COLUMN     "upgrade_discounts" JSONB NOT NULL DEFAULT '{}';

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

-- CreateIndex
CREATE INDEX "crates_type_idx" ON "crates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "crates_user_id_guild_id_type_key" ON "crates"("user_id", "guild_id", "type");

-- AddForeignKey
ALTER TABLE "crates" ADD CONSTRAINT "crates_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
