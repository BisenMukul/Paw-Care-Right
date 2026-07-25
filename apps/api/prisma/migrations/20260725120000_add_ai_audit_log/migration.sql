-- CreateEnum
CREATE TYPE "AiAuditSurface" AS ENUM ('CHECK', 'CHAT');

-- CreateTable
CREATE TABLE "AiAuditLog" (
    "id" TEXT NOT NULL,
    "surface" "AiAuditSurface" NOT NULL,
    "checkId" TEXT,
    "threadId" TEXT,
    "promptVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "detectorFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiAuditLog_createdAt_idx" ON "AiAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_checkId_idx" ON "AiAuditLog"("checkId");

-- CreateIndex
CREATE INDEX "AiAuditLog_threadId_idx" ON "AiAuditLog"("threadId");
