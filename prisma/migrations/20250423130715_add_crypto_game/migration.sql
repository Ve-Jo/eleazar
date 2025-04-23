-- CreateTable
CREATE TABLE "crypto_positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entry_price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "leverage" INTEGER NOT NULL,
    "take_profit_price" DECIMAL(20,8),
    "stop_loss_price" DECIMAL(20,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crypto_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crypto_positions_user_id_guild_id_idx" ON "crypto_positions"("user_id", "guild_id");

-- CreateIndex
CREATE INDEX "crypto_positions_symbol_idx" ON "crypto_positions"("symbol");

-- AddForeignKey
ALTER TABLE "crypto_positions" ADD CONSTRAINT "crypto_positions_user_id_guild_id_fkey" FOREIGN KEY ("user_id", "guild_id") REFERENCES "users"("user_id", "guild_id") ON DELETE CASCADE ON UPDATE CASCADE;
