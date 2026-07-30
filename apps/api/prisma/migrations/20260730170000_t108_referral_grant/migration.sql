-- CreateTable
CREATE TABLE "ReferralGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counterpartyUserId" TEXT,
    "inviteId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferralGrant_userId_expiresAt_idx" ON "ReferralGrant"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ReferralGrant_counterpartyUserId_idx" ON "ReferralGrant"("counterpartyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralGrant_inviteId_userId_key" ON "ReferralGrant"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "ReferralGrant" ADD CONSTRAINT "ReferralGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralGrant" ADD CONSTRAINT "ReferralGrant_counterpartyUserId_fkey" FOREIGN KEY ("counterpartyUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralGrant" ADD CONSTRAINT "ReferralGrant_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "HouseholdInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
