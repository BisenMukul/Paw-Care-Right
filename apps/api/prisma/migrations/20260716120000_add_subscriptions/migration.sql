-- CreateEnum
CREATE TYPE "SubscriptionEntitlement" AS ENUM ('FREE', 'PREMIUM');

-- CreateTable
CREATE TABLE "Subscription" (
    "rcAppUserId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "entitlement" "SubscriptionEntitlement" NOT NULL DEFAULT 'FREE',
    "plan" TEXT,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "rawEventJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("rcAppUserId")
);

-- CreateIndex
CREATE INDEX "Subscription_householdId_idx" ON "Subscription"("householdId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_rcAppUserId_fkey" FOREIGN KEY ("rcAppUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
