-- CreateIndex
CREATE INDEX "AiAuditLog_createdAt_id_idx" ON "AiAuditLog"("createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Device_createdAt_idx" ON "Device"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_processedAt_idx" ON "ProcessedWebhookEvent"("processedAt");

-- CreateIndex
CREATE INDEX "Subscription_lastEventAt_idx" ON "Subscription"("lastEventAt");

-- CreateIndex
CREATE INDEX "SymptomCheck_createdAt_idx" ON "SymptomCheck"("createdAt");
