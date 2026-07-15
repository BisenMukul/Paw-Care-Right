-- CreateEnum
CREATE TYPE "HealthLogKind" AS ENUM ('WEIGHT', 'MEAL', 'NOTE', 'VET_VISIT', 'MED_GIVEN', 'CHECK_REF');

-- CreateTable
CREATE TABLE "HealthLog" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "kind" "HealthLogKind" NOT NULL,
    "valueJson" JSONB NOT NULL,
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthLog_petId_occurredAt_idx" ON "HealthLog"("petId", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "HealthLog" ADD CONSTRAINT "HealthLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
