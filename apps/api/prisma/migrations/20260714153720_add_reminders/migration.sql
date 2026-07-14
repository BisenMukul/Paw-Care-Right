-- CreateEnum
CREATE TYPE "ReminderEventStatus" AS ENUM ('PENDING', 'SENT', 'DONE', 'SNOOZED', 'MISSED');

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "nextFireAt" TIMESTAMP(3) NOT NULL,
    "medNameAsEntered" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderEvent" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderEventStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_petId_idx" ON "Reminder"("petId");

-- CreateIndex
CREATE INDEX "ReminderEvent_dueAt_status_idx" ON "ReminderEvent"("dueAt", "status");

-- CreateIndex
CREATE INDEX "ReminderEvent_reminderId_idx" ON "ReminderEvent"("reminderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderEvent_reminderId_dueAt_key" ON "ReminderEvent"("reminderId", "dueAt");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReminderEvent" ADD CONSTRAINT "ReminderEvent_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
