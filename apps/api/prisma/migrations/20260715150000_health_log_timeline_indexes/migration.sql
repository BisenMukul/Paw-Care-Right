-- T064: additive indexes for the health-timeline read paths. No column or
-- behavior change to either model.

-- CreateIndex
CREATE INDEX "HealthLog_petId_kind_occurredAt_idx" ON "HealthLog"("petId", "kind", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "ReminderEvent_reminderId_status_completedAt_idx" ON "ReminderEvent"("reminderId", "status", "completedAt" DESC);
