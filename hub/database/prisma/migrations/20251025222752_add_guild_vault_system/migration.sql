-- CreateTable
CREATE TABLE "guild_vaults" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "balance" DECIMAL(30,5) NOT NULL DEFAULT 0,
    "total_fees" DECIMAL(30,5) NOT NULL DEFAULT 0,
    "last_distribution" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guild_vault_distributions" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(30,5) NOT NULL,
    "distribution_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,

    CONSTRAINT "guild_vault_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_vaults_guild_id_key" ON "guild_vaults"("guild_id");

-- CreateIndex
CREATE INDEX "guild_vault_distributions_guild_id_idx" ON "guild_vault_distributions"("guild_id");

-- CreateIndex
CREATE INDEX "guild_vault_distributions_user_id_idx" ON "guild_vault_distributions"("user_id");

-- CreateIndex
CREATE INDEX "guild_vault_distributions_distribution_date_idx" ON "guild_vault_distributions"("distribution_date");

-- CreateIndex
CREATE UNIQUE INDEX "guild_vault_distributions_guild_id_user_id_distribution_dat_key" ON "guild_vault_distributions"("guild_id", "user_id", "distribution_date");

-- AddForeignKey
ALTER TABLE "guild_vault_distributions" ADD CONSTRAINT "guild_vault_distributions_guild_id_fkey" FOREIGN KEY ("guild_id") REFERENCES "guild_vaults"("guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
