-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REJECTED');

-- CreateTable
CREATE TABLE "crypto_wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "locked_balance" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "total_deposited" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "total_withdrawn" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_deposits" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(30,8) NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "required_confirmations" INTEGER NOT NULL DEFAULT 6,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "from_address" TEXT,
    "to_address" TEXT NOT NULL,
    "block_height" BIGINT,
    "memo" TEXT,
    "metadata" JSONB,
    "mexc_deposit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "crypto_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crypto_withdrawals" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "tx_hash" TEXT,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(30,8) NOT NULL,
    "fee" DECIMAL(30,8) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(30,8) NOT NULL,
    "to_address" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "required_confirmations" INTEGER NOT NULL DEFAULT 6,
    "memo" TEXT,
    "metadata" JSONB,
    "mexc_withdrawal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "crypto_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crypto_wallets_address_key" ON "crypto_wallets"("address");

-- CreateIndex
CREATE INDEX "crypto_wallets_address_idx" ON "crypto_wallets"("address");

-- CreateIndex
CREATE INDEX "crypto_wallets_currency_idx" ON "crypto_wallets"("currency");

-- CreateIndex
CREATE INDEX "crypto_wallets_guild_id_user_id_idx" ON "crypto_wallets"("guild_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_wallets_guild_id_user_id_currency_key" ON "crypto_wallets"("guild_id", "user_id", "currency");

-- CreateIndex
CREATE INDEX "crypto_deposits_wallet_id_idx" ON "crypto_deposits"("wallet_id");

-- CreateIndex
CREATE INDEX "crypto_deposits_status_idx" ON "crypto_deposits"("status");

-- CreateIndex
CREATE INDEX "crypto_deposits_currency_idx" ON "crypto_deposits"("currency");

-- CreateIndex
CREATE INDEX "crypto_deposits_created_at_idx" ON "crypto_deposits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "crypto_deposits_tx_hash_currency_key" ON "crypto_deposits"("tx_hash", "currency");

-- CreateIndex
CREATE INDEX "crypto_withdrawals_wallet_id_idx" ON "crypto_withdrawals"("wallet_id");

-- CreateIndex
CREATE INDEX "crypto_withdrawals_status_idx" ON "crypto_withdrawals"("status");

-- CreateIndex
CREATE INDEX "crypto_withdrawals_currency_idx" ON "crypto_withdrawals"("currency");

-- CreateIndex
CREATE INDEX "crypto_withdrawals_created_at_idx" ON "crypto_withdrawals"("created_at");

-- AddForeignKey
ALTER TABLE "crypto_wallets" ADD CONSTRAINT "crypto_wallets_guild_id_user_id_fkey" FOREIGN KEY ("guild_id", "user_id") REFERENCES "users"("guild_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_deposits" ADD CONSTRAINT "crypto_deposits_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "crypto_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crypto_withdrawals" ADD CONSTRAINT "crypto_withdrawals_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "crypto_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
