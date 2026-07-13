-- CreateTable
CREATE TABLE "CheckFollowUp" (
    "checkId" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "escalatedTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckFollowUp_pkey" PRIMARY KEY ("checkId")
);

-- AddForeignKey
ALTER TABLE "CheckFollowUp" ADD CONSTRAINT "CheckFollowUp_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "SymptomCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
