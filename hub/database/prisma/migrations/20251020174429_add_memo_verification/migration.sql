/*
  Warnings:

  - A unique constraint covering the columns `[deposit_memo]` on the table `crypto_wallets` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "crypto_wallets" ADD COLUMN     "deposit_memo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "crypto_wallets_deposit_memo_key" ON "crypto_wallets"("deposit_memo");

-- CreateIndex
CREATE INDEX "crypto_wallets_deposit_memo_idx" ON "crypto_wallets"("deposit_memo");
