import type { PrismaService } from "../prisma/prisma.service";
import { AdminKpisService, mergeDailyKpis } from "./admin-kpis.service";

describe("mergeDailyKpis (pure)", () => {
  it("fallbackRate is null when checksDone + checksFallback === 0 for a day (never a fake 0%)", () => {
    const result = mergeDailyKpis(
      [{ day: "2026-07-30", count: 2 }],
      [],
      [],
      [],
    );
    expect(result).toEqual([
      {
        day: "2026-07-30",
        devicesCreated: 2,
        checksCreated: 0,
        checksDone: 0,
        checksFallback: 0,
        fallbackRate: null,
        billingEventsProcessed: 0,
        subscriptionsUpdated: 0,
      },
    ]);
  });

  it("computes 2/(3+2) = 0.4 for a day with 3 DONE and 2 FALLBACK checks", () => {
    const result = mergeDailyKpis(
      [],
      [
        { day: "2026-07-30", status: "DONE", count: 3 },
        { day: "2026-07-30", status: "FALLBACK", count: 2 },
      ],
      [],
      [],
    );
    expect(result[0]!.checksCreated).toBe(5);
    expect(result[0]!.checksDone).toBe(3);
    expect(result[0]!.checksFallback).toBe(2);
    expect(result[0]!.fallbackRate).toBe(0.4);
  });

  it("excludes non-terminal QUEUED/RUNNING checks from the fallback-rate denominator but counts them in checksCreated", () => {
    const result = mergeDailyKpis(
      [],
      [
        { day: "2026-07-30", status: "QUEUED", count: 1 },
        { day: "2026-07-30", status: "RUNNING", count: 1 },
        { day: "2026-07-30", status: "DONE", count: 1 },
      ],
      [],
      [],
    );
    expect(result[0]!.checksCreated).toBe(3);
    expect(result[0]!.fallbackRate).toBe(0);
  });

  it("merges across a gap day: a day present in only one source defaults the other fields to 0", () => {
    const result = mergeDailyKpis(
      [
        { day: "2026-07-29", count: 1 },
        { day: "2026-07-30", count: 2 },
      ],
      [{ day: "2026-07-30", status: "DONE", count: 1 }],
      [],
      [],
    );
    const byDay = new Map(result.map((row) => [row.day, row]));
    expect(byDay.get("2026-07-29")).toEqual({
      day: "2026-07-29",
      devicesCreated: 1,
      checksCreated: 0,
      checksDone: 0,
      checksFallback: 0,
      fallbackRate: null,
      billingEventsProcessed: 0,
      subscriptionsUpdated: 0,
    });
    expect(byDay.get("2026-07-30")!.checksDone).toBe(1);
  });

  it("sorts days newest-first", () => {
    const result = mergeDailyKpis(
      [
        { day: "2026-07-28", count: 1 },
        { day: "2026-07-30", count: 1 },
        { day: "2026-07-29", count: 1 },
      ],
      [],
      [],
      [],
    );
    expect(result.map((row) => row.day)).toEqual(["2026-07-30", "2026-07-29", "2026-07-28"]);
  });
});

describe("AdminKpisService", () => {
  function buildPrisma(overrides: {
    queryRaw?: jest.Mock;
    userCount?: jest.Mock;
    subscriptionCount?: jest.Mock;
    referralGrantCount?: jest.Mock;
  }): PrismaService {
    return {
      $queryRaw: overrides.queryRaw ?? jest.fn().mockResolvedValue([]),
      user: { count: overrides.userCount ?? jest.fn().mockResolvedValue(0) },
      subscription: { count: overrides.subscriptionCount ?? jest.fn().mockResolvedValue(0) },
      referralGrant: { count: overrides.referralGrantCount ?? jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
  }

  it("clamps days above 90 down to 90", async () => {
    const service = new AdminKpisService(buildPrisma({}));
    const result = await service.getKpis(999);
    expect(result.days).toBe(90);
  });

  it("clamps days below 1 up to 1", async () => {
    const service = new AdminKpisService(buildPrisma({}));
    const result = await service.getKpis(0);
    expect(result.days).toBe(1);
  });

  it("every raw query is bound-parameterised (a real Prisma.Sql with a Date in .values, never a string-interpolated cutoff)", async () => {
    const queryRaw = jest.fn().mockResolvedValue([]);
    const service = new AdminKpisService(buildPrisma({ queryRaw }));

    await service.getKpis(30);

    expect(queryRaw).toHaveBeenCalledTimes(4);
    for (const call of queryRaw.mock.calls) {
      const sql = call[0] as { values: unknown[]; strings: readonly string[] };
      expect(sql.values).toHaveLength(1);
      expect(sql.values[0]).toBeInstanceOf(Date);
      // The cutoff must never appear serialized inside the literal SQL text
      // itself (that would be string interpolation, an injection risk).
      const cutoffIso = (sql.values[0] as Date).toISOString();
      for (const fragment of sql.strings) {
        expect(fragment).not.toContain(cutoffIso);
      }
    }
  });

  it("resolves the tier snapshot from user/subscription/referralGrant counts (total - premium = expired/inactive)", async () => {
    const subscriptionCount = jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    const service = new AdminKpisService(
      buildPrisma({
        userCount: jest.fn().mockResolvedValue(50),
        subscriptionCount,
        referralGrantCount: jest.fn().mockResolvedValue(2),
      }),
    );

    const result = await service.getKpis(30);

    expect(result.tiers).toEqual({
      totalUsers: 50,
      premiumSubscriptions: 4,
      expiredOrInactiveSubscriptions: 6,
      activeReferralGrants: 2,
    });
  });
});
