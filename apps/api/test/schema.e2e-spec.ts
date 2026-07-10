import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Awaits `promise`, asserting it rejects with a Prisma "unique constraint
 * violation" error (P2002). Any other outcome (success, or a different
 * error) fails the assertion.
 */
async function expectUniqueConstraintViolation(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
  throw new Error("expected a P2002 unique constraint violation, but the operation succeeded");
}

describe("Prisma schema constraints (e2e)", () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects a duplicate User.email", async () => {
    const email = `test-${randomUUID()}@pawcareright.local`;
    const user = await prisma.user.create({ data: { email, locale: "en", region: "US" } });

    try {
      await expectUniqueConstraintViolation(
        prisma.user.create({ data: { email, locale: "en", region: "US" } }),
      );
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("rejects a duplicate Membership (userId, householdId) pair", async () => {
    const email = `test-${randomUUID()}@pawcareright.local`;
    const user = await prisma.user.create({ data: { email, locale: "en", region: "US" } });
    const household = await prisma.household.create({
      data: { name: "Test Household", ownerId: user.id },
    });
    const membership = await prisma.membership.create({
      data: { userId: user.id, householdId: household.id, role: "MEMBER" },
    });

    try {
      await expectUniqueConstraintViolation(
        prisma.membership.create({
          data: { userId: user.id, householdId: household.id, role: "MEMBER" },
        }),
      );
    } finally {
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.household.delete({ where: { id: household.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("rejects a duplicate Device.expoPushToken", async () => {
    const email = `test-${randomUUID()}@pawcareright.local`;
    const user = await prisma.user.create({ data: { email, locale: "en", region: "US" } });
    const expoPushToken = `ExponentPushToken[${randomUUID()}]`;
    const device = await prisma.device.create({
      data: { userId: user.id, expoPushToken, platform: "ios" },
    });

    try {
      await expectUniqueConstraintViolation(
        prisma.device.create({ data: { userId: user.id, expoPushToken, platform: "ios" } }),
      );
    } finally {
      await prisma.device.delete({ where: { id: device.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("has indexes on the Membership.householdId and Device.userId foreign key columns", async () => {
    const indexes = await prisma.$queryRaw<Array<{ tablename: string; indexdef: string }>>`
      SELECT tablename, indexdef FROM pg_indexes
      WHERE tablename IN ('Membership', 'Device')
    `;

    const hasMembershipHouseholdIdIndex = indexes.some(
      (index) => index.tablename === "Membership" && index.indexdef.includes("householdId"),
    );
    const hasDeviceUserIdIndex = indexes.some(
      (index) => index.tablename === "Device" && index.indexdef.includes("userId"),
    );

    expect(hasMembershipHouseholdIdIndex).toBe(true);
    expect(hasDeviceUserIdIndex).toBe(true);
  });
});
