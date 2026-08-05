-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "appVersion" TEXT,
ADD COLUMN     "otaUpdateId" TEXT;

-- CreateIndex
CREATE INDEX "Device_lastSeenAt_idx" ON "Device"("lastSeenAt");
