import { execFileSync } from "node:child_process";
import path from "node:path";

import { FAMILY_PLAN_PRODUCT_ID } from "@pawcareright/types";
import { PrismaClient } from "@prisma/client";

import apiPackageJson from "../../package.json";

import {
  BUDDY_PET_ID,
  CLEO_PET_ID,
  DEMO_HOUSEHOLD_ID,
  FAMILY_EMAIL,
  FAMILY_EMPTY_HOUSEHOLD_ID,
  FAMILY_USER_ID,
  LUNA_PET_ID,
  OWNER_EMAIL,
  OWNER_USER_ID,
} from "../../prisma/seed/constants";
import { buildDemo, persistDemo, wipeDemo } from "../../prisma/seed/persist";

/**
 * DB smoke + idempotency (plan AC1/AC6/AC7). Exercises `wipeDemo` +
 * `persistDemo(buildDemo(now))` directly against a real local Postgres (no
 * Nest app needed — this is pure data-shape verification) — the exact
 * composition `../../prisma/seed.ts`'s `runSeed` performs, without
 * importing that script itself (its top-level `main()` runs eagerly on
 * import, which a test module must not trigger as a side effect). Mirrors
 * `../../prisma/seed.ts`'s own dev fixture (same fixed ids/email, upserted
 * here so this file is a self-contained "control" for the
 * untouched-by-wipe assertion) rather than depending on
 * `pnpm --filter api prisma:seed` having run first.
 */
async function runDemoSeed(prisma: PrismaClient): Promise<void> {
  await wipeDemo(prisma);
  await persistDemo(prisma, buildDemo(new Date()));
}

const DEV_USER_EMAIL = "dev@pawcareright.local";
const DEV_HOUSEHOLD_ID = "00000000-0000-4000-8000-000000000001";
const DEV_MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000002";

describe("demo seed — DB smoke + idempotency (e2e)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // The non-demo "control" fixture (mirrors `prisma/seed.ts`'s dev block
    // verbatim) — proves `wipeDemo` never touches anything outside the
    // demo subgraph.
    const devUser = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL, locale: "en", region: "US" },
    });
    const devHousehold = await prisma.household.upsert({
      where: { id: DEV_HOUSEHOLD_ID },
      update: {},
      create: { id: DEV_HOUSEHOLD_ID, name: "Dev Household", ownerId: devUser.id },
    });
    await prisma.membership.upsert({
      where: { userId_householdId: { userId: devUser.id, householdId: devHousehold.id } },
      update: {},
      create: { id: DEV_MEMBERSHIP_ID, userId: devUser.id, householdId: devHousehold.id, role: "OWNER" },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function demoCounts(): Promise<Record<string, number>> {
    const petIds = [BUDDY_PET_ID, CLEO_PET_ID, LUNA_PET_ID];
    return {
      users: await prisma.user.count({ where: { email: { in: [OWNER_EMAIL, FAMILY_EMAIL] } } }),
      households: await prisma.household.count({ where: { id: { in: [DEMO_HOUSEHOLD_ID, FAMILY_EMPTY_HOUSEHOLD_ID] } } }),
      memberships: await prisma.membership.count({ where: { householdId: DEMO_HOUSEHOLD_ID } }),
      devices: await prisma.device.count({ where: { userId: { in: [OWNER_USER_ID, FAMILY_USER_ID] } } }),
      pets: await prisma.pet.count({ where: { householdId: DEMO_HOUSEHOLD_ID } }),
      healthLogs: await prisma.healthLog.count({ where: { petId: { in: petIds } } }),
      reminders: await prisma.reminder.count({ where: { petId: { in: petIds } } }),
      events: await prisma.reminderEvent.count({ where: { reminder: { petId: { in: petIds } } } }),
      checks: await prisma.symptomCheck.count({ where: { petId: { in: petIds } } }),
      triageResults: await prisma.triageResult.count({ where: { check: { petId: { in: petIds } } } }),
      followUps: await prisma.checkFollowUp.count({ where: { check: { petId: { in: petIds } } } }),
      subscriptions: await prisma.subscription.count({ where: { rcAppUserId: OWNER_USER_ID } }),
    };
  }

  it("seeds owner+member in one household, with a throwaway owned household for the joiner (AC1)", async () => {
    await runDemoSeed(prisma);

    const ownerMembership = await prisma.membership.findUnique({
      where: { userId_householdId: { userId: OWNER_USER_ID, householdId: DEMO_HOUSEHOLD_ID } },
    });
    const familyMembership = await prisma.membership.findUnique({
      where: { userId_householdId: { userId: FAMILY_USER_ID, householdId: DEMO_HOUSEHOLD_ID } },
    });
    expect(ownerMembership?.role).toBe("OWNER");
    expect(familyMembership?.role).toBe("MEMBER");

    // Both users own exactly one membership (the auth invariant this seed
    // must satisfy for OTP sign-in — plan ground truth).
    expect(await prisma.membership.count({ where: { userId: OWNER_USER_ID } })).toBe(1);
    expect(await prisma.membership.count({ where: { userId: FAMILY_USER_ID } })).toBe(1);

    const membersOfDemoHousehold = await prisma.membership.findMany({ where: { householdId: DEMO_HOUSEHOLD_ID } });
    expect(membersOfDemoHousehold).toHaveLength(2);

    const familyOwnedHousehold = await prisma.household.findUnique({ where: { id: FAMILY_EMPTY_HOUSEHOLD_ID } });
    expect(familyOwnedHousehold?.ownerId).toBe(FAMILY_USER_ID);
    expect(await prisma.membership.count({ where: { householdId: FAMILY_EMPTY_HOUSEHOLD_ID } })).toBe(0);
  });

  it("seeds a premium family subscription on the demo household (AC6)", async () => {
    const subscription = await prisma.subscription.findUnique({ where: { rcAppUserId: OWNER_USER_ID } });
    expect(subscription).not.toBeNull();
    expect(subscription?.householdId).toBe(DEMO_HOUSEHOLD_ID);
    expect(subscription?.entitlement).toBe("PREMIUM");
    expect(subscription?.plan).toBe(FAMILY_PLAN_PRODUCT_ID);
    expect(subscription?.status).toBe("active");
    expect(subscription?.expiresAt?.getTime()).toBeGreaterThan(Date.now());
  });

  it("is idempotent — identical counts after a second run, dev fixture untouched (AC7)", async () => {
    const before = await demoCounts();

    await runDemoSeed(prisma);

    const after = await demoCounts();
    expect(after).toEqual(before);
    // Sanity: the seed actually wrote something (a regression-proof no-op wipe would also "match").
    expect(after.pets).toBe(3);
    expect(after.checks).toBeGreaterThan(0);

    const devUser = await prisma.user.findUnique({ where: { email: DEV_USER_EMAIL } });
    expect(devUser).not.toBeNull();
    const devHousehold = await prisma.household.findUnique({ where: { id: DEV_HOUSEHOLD_ID } });
    expect(devHousehold?.ownerId).toBe(devUser?.id);
  });

  /**
   * Gap-closure (checker finding, `loop/reviews/SEEDER-1.review.md`): every
   * test above calls `runDemoSeed` (`wipeDemo`/`persistDemo`/`buildDemo`)
   * DIRECTLY under ts-jest, which resolves `@pawcareright/data`/
   * `@pawcareright/types` via plain Node module resolution — it never
   * proves the REAL `pnpm --filter api prisma:seed` command (which runs
   * `prisma db seed` -> `tsx --tsconfig prisma/seed/tsconfig.json
   * prisma/seed.ts`) actually works, since `tsx` resolves bare
   * `@pawcareright/*` specifiers via tsconfig `paths` at RUNTIME (ts-jest
   * does not), so a broken `paths` target is invisible to every spec above
   * — a true false-green risk. This spawns the LITERAL configured command
   * (read from `package.json` at test time, so a future edit can't silently
   * drift back out of coverage) as a real child process against the same
   * local Postgres, and asserts both a clean exit AND a real, correct
   * sentinel row count afterward (a silently-no-op wipe would also exit 0,
   * so the count assertion is the non-vacuity guard).
   */
  it(
    "the REAL `pnpm --filter api prisma:seed` command (tsx runtime, not ts-jest) runs cleanly and writes the full demo graph",
    async () => {
      const apiRoot = path.resolve(__dirname, "../..");
      const seedCommand = apiPackageJson.prisma?.seed;
      expect(typeof seedCommand).toBe("string");

      const [bin, ...args] = (seedCommand as string).split(" ");
      // `tsx` is a package-local binary (node_modules/.bin), not on the
      // ambient PATH for a raw `execFileSync` — mirror what `pnpm`/`prisma`
      // normally inject by prepending the api package's own `.bin` dir.
      const pathWithLocalBin = [path.join(apiRoot, "node_modules", ".bin"), process.env.PATH].filter(Boolean).join(path.delimiter);

      let stdout: string;
      try {
        stdout = execFileSync(bin, args, {
          cwd: apiRoot,
          env: { ...process.env, PATH: pathWithLocalBin },
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string; message: string };
        throw new Error(
          `real seed command "${seedCommand}" failed: ${failure.message}\n--- stdout ---\n${failure.stdout ?? ""}\n--- stderr ---\n${failure.stderr ?? ""}`,
        );
      }

      // tsx prints nothing on success (CLAUDE §8 "no console.log"); a
      // non-empty stderr-free run with no "error" text is the clean-exit
      // signal (execFileSync itself throws on a non-zero exit code).
      expect(stdout).not.toMatch(/error/i);

      const counts = await demoCounts();
      expect(counts.pets).toBe(3);
      expect(counts.checks).toBeGreaterThan(0);
      expect(counts.reminders).toBeGreaterThan(0);
      expect(counts.subscriptions).toBe(1);
    },
    60_000,
  );
});
