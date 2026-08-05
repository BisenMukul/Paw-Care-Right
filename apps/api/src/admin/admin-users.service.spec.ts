import { NotFoundException } from "@nestjs/common";

import type { BillingService } from "../billing/billing.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminUsersService } from "./admin-users.service";

const ENTITLEMENT = { entitled: false, source: "none" as const, plan: null, expiresAt: null, billingIssue: false };

describe("AdminUsersService", () => {
  function buildUserRow(overrides: Partial<{ memberships: { householdId: string }[] }> = {}) {
    return {
      id: "user-1",
      email: "foo@example.com",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      locale: "en",
      region: "US",
      analyticsOptOut: false,
      deletionScheduledAt: null,
      memberships: overrides.memberships ?? [{ householdId: "household-1" }],
    };
  }

  function buildPrisma(overrides: {
    findUnique?: jest.Mock;
    counts?: Partial<
      Record<
        "pet" | "symptomCheck" | "chatThread" | "chatMessage" | "reminder" | "healthLog" | "device" | "feedbackReport" | "accountExport" | "referralGrant",
        jest.Mock
      >
    >;
  }): PrismaService {
    const defaultCount = () => jest.fn().mockResolvedValue(0);
    return {
      user: { findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(buildUserRow()) },
      pet: { count: overrides.counts?.pet ?? defaultCount() },
      symptomCheck: { count: overrides.counts?.symptomCheck ?? defaultCount() },
      chatThread: { count: overrides.counts?.chatThread ?? defaultCount() },
      chatMessage: { count: overrides.counts?.chatMessage ?? defaultCount() },
      reminder: { count: overrides.counts?.reminder ?? defaultCount() },
      healthLog: { count: overrides.counts?.healthLog ?? defaultCount() },
      device: { count: overrides.counts?.device ?? defaultCount() },
      feedbackReport: { count: overrides.counts?.feedbackReport ?? defaultCount() },
      accountExport: { count: overrides.counts?.accountExport ?? defaultCount() },
      referralGrant: { count: overrides.counts?.referralGrant ?? defaultCount() },
    } as unknown as PrismaService;
  }

  function buildBillingService(getEntitlement?: jest.Mock): BillingService {
    return { getEntitlement: getEntitlement ?? jest.fn().mockResolvedValue(ENTITLEMENT) } as unknown as BillingService;
  }

  it("normalises the email (trim + lowercase) before the lookup", async () => {
    const findUnique = jest.fn().mockResolvedValue(buildUserRow());
    const service = new AdminUsersService(buildPrisma({ findUnique }), buildBillingService());

    await service.lookupByEmail("  Foo@Example.COM  ");

    expect(findUnique).toHaveBeenCalledTimes(1);
    const call = findUnique.mock.calls[0]![0] as { where: { email: string } };
    expect(call.where.email).toBe("foo@example.com");
  });

  it("the Prisma select keys equal the pinned allowlist (privacy pin -- ids/codes/counts only)", async () => {
    const findUnique = jest.fn().mockResolvedValue(buildUserRow());
    const service = new AdminUsersService(buildPrisma({ findUnique }), buildBillingService());

    await service.lookupByEmail("foo@example.com");

    const call = findUnique.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(new Set(Object.keys(call.select))).toEqual(
      new Set(["id", "email", "createdAt", "locale", "region", "analyticsOptOut", "deletionScheduledAt", "memberships"]),
    );
  });

  it("not found -> NotFoundException", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new AdminUsersService(buildPrisma({ findUnique }), buildBillingService());

    await expect(service.lookupByEmail("nobody@example.com")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("resolves entitlement via BillingService.getEntitlement(userId, firstHouseholdId)", async () => {
    const getEntitlement = jest.fn().mockResolvedValue(ENTITLEMENT);
    const service = new AdminUsersService(buildPrisma({}), buildBillingService(getEntitlement));

    const result = await service.lookupByEmail("foo@example.com");

    expect(getEntitlement).toHaveBeenCalledWith("user-1", "household-1");
    expect(result.entitlement).toEqual(ENTITLEMENT);
  });

  it("passes an empty-string household id when the user belongs to no household (still a valid, safe call)", async () => {
    const findUnique = jest.fn().mockResolvedValue(buildUserRow({ memberships: [] }));
    const getEntitlement = jest.fn().mockResolvedValue(ENTITLEMENT);
    const service = new AdminUsersService(buildPrisma({ findUnique }), buildBillingService(getEntitlement));

    await service.lookupByEmail("foo@example.com");

    expect(getEntitlement).toHaveBeenCalledWith("user-1", "");
  });

  it("issues a single Promise.all of bounded count() calls -- no N+1, and returns the assembled counters", async () => {
    const counts = {
      pet: jest.fn().mockResolvedValue(2),
      symptomCheck: jest.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(1),
      chatThread: jest.fn().mockResolvedValue(1),
      chatMessage: jest.fn().mockResolvedValue(3),
      reminder: jest.fn().mockResolvedValue(4),
      healthLog: jest.fn().mockResolvedValue(6),
      device: jest.fn().mockResolvedValue(1),
      feedbackReport: jest.fn().mockResolvedValue(0),
      accountExport: jest.fn().mockResolvedValue(0),
      referralGrant: jest.fn().mockResolvedValue(0),
    };
    const service = new AdminUsersService(buildPrisma({ counts }), buildBillingService());

    const result = await service.lookupByEmail("foo@example.com");

    expect(result.counters).toEqual({
      pets: 2,
      symptomChecksTotal: 5,
      symptomChecksFallback: 1,
      chatThreads: 1,
      chatMessages: 3,
      reminders: 4,
      healthLogs: 6,
      devices: 1,
      feedbackReports: 0,
      accountExports: 0,
      referralGrantsActive: 0,
    });
    expect(counts.pet).toHaveBeenCalledTimes(1);
    expect(counts.symptomCheck).toHaveBeenCalledTimes(2);
  });
});
