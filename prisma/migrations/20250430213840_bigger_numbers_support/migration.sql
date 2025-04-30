/*
  Warnings:

  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/

-- AlterTable
ALTER TABLE "crypto_positions" ALTER COLUMN "entry_price" SET DATA TYPE DECIMAL(30,8),
ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(30,8),
ALTER COLUMN "take_profit_price" SET DATA TYPE DECIMAL(30,8),
ALTER COLUMN "stop_loss_price" SET DATA TYPE DECIMAL(30,8);

-- AlterTable
ALTER TABLE "economy" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(30,5),
ALTER COLUMN "bankBalance" SET DATA TYPE DECIMAL(30,5);

-- AlterTable
ALTER TABLE "statistics" ALTER COLUMN "total_earned" SET DATA TYPE DECIMAL(30,5);
