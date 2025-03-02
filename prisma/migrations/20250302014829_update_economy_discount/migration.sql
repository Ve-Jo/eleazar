/*
  Warnings:

  - You are about to drop the column `upgrade_discounts` on the `economy` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "economy" DROP COLUMN "upgrade_discounts",
ADD COLUMN     "upgrade_discount" DECIMAL(5,2) NOT NULL DEFAULT 0;
