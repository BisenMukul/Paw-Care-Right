-- CreateEnum
CREATE TYPE "AccountExportStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AccountExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AccountExportStatus" NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT,
    "failureReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AccountExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountExport_userId_requestedAt_idx" ON "AccountExport"("userId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "AccountExport_requestedAt_idx" ON "AccountExport"("requestedAt");

-- CreateIndex
CREATE INDEX "User_deletionScheduledAt_idx" ON "User"("deletionScheduledAt");

-- AddForeignKey
ALTER TABLE "AccountExport" ADD CONSTRAINT "AccountExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
