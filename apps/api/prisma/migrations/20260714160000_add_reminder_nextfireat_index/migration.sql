-- CreateIndex
CREATE INDEX "Reminder_active_nextFireAt_idx" ON "Reminder"("active", "nextFireAt");
