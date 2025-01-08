-- CreateIndex
CREATE INDEX "user_bank_amount_idx" ON "user_bank"("amount");

-- CreateIndex
CREATE INDEX "user_bank_started_to_hold_idx" ON "user_bank"("started_to_hold");

-- CreateIndex
CREATE INDEX "user_cooldowns_daily_idx" ON "user_cooldowns"("daily");

-- CreateIndex
CREATE INDEX "user_cooldowns_work_idx" ON "user_cooldowns"("work");

-- CreateIndex
CREATE INDEX "user_cooldowns_crime_idx" ON "user_cooldowns"("crime");

-- CreateIndex
CREATE INDEX "user_cooldowns_message_idx" ON "user_cooldowns"("message");

-- CreateIndex
CREATE INDEX "users_balance_idx" ON "users"("balance");

-- CreateIndex
CREATE INDEX "users_total_xp_idx" ON "users"("total_xp");

-- CreateIndex
CREATE INDEX "users_latest_activity_idx" ON "users"("latest_activity");
