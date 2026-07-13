-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FALLBACK');

-- CreateTable
CREATE TABLE "SymptomCheck" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "CheckStatus" NOT NULL DEFAULT 'QUEUED',
    "category" TEXT NOT NULL,
    "intakeJson" JSONB NOT NULL,
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redFlagHit" BOOLEAN NOT NULL DEFAULT false,
    "redFlagRuleId" TEXT,
    "redFlagPayloadKey" TEXT,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SymptomCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriageResult" (
    "checkId" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageResult_pkey" PRIMARY KEY ("checkId")
);

-- CreateIndex
CREATE INDEX "SymptomCheck_petId_createdAt_idx" ON "SymptomCheck"("petId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SymptomCheck_createdById_idx" ON "SymptomCheck"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "SymptomCheck_createdById_idempotencyKey_key" ON "SymptomCheck"("createdById", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "SymptomCheck" ADD CONSTRAINT "SymptomCheck_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SymptomCheck" ADD CONSTRAINT "SymptomCheck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriageResult" ADD CONSTRAINT "TriageResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "SymptomCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
