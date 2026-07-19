import { PrismaClient } from "@prisma/client";

import { buildDemo, persistDemo, wipeDemo } from "./seed/persist";

// Fixed dev fixtures — obviously non-production values. Fixed UUID constants
// let this script upsert-by-id for Household/Membership (which have no
// natural business-unique key), making repeated runs a true no-op.
const DEV_USER_EMAIL = "dev@pawcareright.local";
const DEV_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
const DEV_MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000002";

const prisma = new PrismaClient();

/**
 * Wipes and recreates the realistic DEMO fixture (owner+family users, one
 * shared household, 3 pets with divergent data density, 60-day health
 * timelines, care-plan + medication reminders, checks across every urgency
 * tier + FALLBACK + a red-flag EMERGENCY, and a premium family
 * subscription) — see `prisma/seed/README.md`. Idempotent: re-running
 * produces identical row counts and NEVER touches the dev fixture above or
 * any other non-demo row (`prisma/seed/persist.ts`'s `wipeDemo`).
 */
export async function runSeed(prisma: PrismaClient): Promise<void> {
  await wipeDemo(prisma);
  await persistDemo(prisma, buildDemo(new Date()));
}

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    update: {},
    create: {
      email: DEV_USER_EMAIL,
      locale: "en",
      region: "US",
    },
  });

  const household = await prisma.household.upsert({
    where: { id: DEV_HOUSEHOLD_ID },
    update: {},
    create: {
      id: DEV_HOUSEHOLD_ID,
      name: "Dev Household",
      ownerId: user.id,
    },
  });

  await prisma.membership.upsert({
    where: { userId_householdId: { userId: user.id, householdId: household.id } },
    update: {},
    create: {
      id: DEV_MEMBERSHIP_ID,
      userId: user.id,
      householdId: household.id,
      role: "OWNER",
    },
  });

  await runSeed(prisma);
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
