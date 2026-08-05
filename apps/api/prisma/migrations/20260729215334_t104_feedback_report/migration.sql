-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IDEA', 'OTHER');

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "FeedbackCategory" NOT NULL DEFAULT 'BUG',
    "message" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "logsConsent" BOOLEAN NOT NULL DEFAULT false,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "screenshotKey" TEXT,
    "sentryEventId" TEXT,
    "sentryRelease" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackReport_userId_createdAt_idx" ON "FeedbackReport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeedbackReport_createdAt_idx" ON "FeedbackReport"("createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
