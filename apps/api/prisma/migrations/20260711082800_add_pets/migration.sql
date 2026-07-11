-- CreateEnum
CREATE TYPE "Species" AS ENUM ('DOG', 'CAT');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "species" "Species" NOT NULL,
    "breedSlug" TEXT,
    "name" TEXT NOT NULL,
    "sex" "Sex" NOT NULL DEFAULT 'UNKNOWN',
    "neutered" BOOLEAN NOT NULL DEFAULT false,
    "birthDate" TIMESTAMP(3),
    "ageEstimateMonths" INTEGER,
    "weightGrams" INTEGER,
    "photoKey" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pet_householdId_deletedAt_idx" ON "Pet"("householdId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
