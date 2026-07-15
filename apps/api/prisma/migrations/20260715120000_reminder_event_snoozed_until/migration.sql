-- AlterTable
ALTER TABLE "ReminderEvent" ADD COLUMN "snoozedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ReminderEvent_status_snoozedUntil_idx" ON "ReminderEvent"("status", "snoozedUntil");
