-- CreateTable
CREATE TABLE "UserNotificationPrefs" (
    "userId" TEXT NOT NULL,
    "disabledTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPrefs_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserNotificationPrefs" ADD CONSTRAINT "UserNotificationPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
