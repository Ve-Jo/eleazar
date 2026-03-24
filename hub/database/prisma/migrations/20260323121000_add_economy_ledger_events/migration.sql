-- CreateTable
CREATE TABLE "economy_ledger_events" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" DECIMAL(30,5) NOT NULL,
    "balance_after" DECIMAL(30,5),
    "bank_balance_after" DECIMAL(30,5),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economy_ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "economy_ledger_events_guild_id_user_id_created_at_idx" ON "economy_ledger_events"("guild_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "economy_ledger_events_source_created_at_idx" ON "economy_ledger_events"("source", "created_at");

-- CreateIndex
CREATE INDEX "economy_ledger_events_created_at_idx" ON "economy_ledger_events"("created_at");
