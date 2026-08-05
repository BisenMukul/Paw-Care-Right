import { Injectable } from "@nestjs/common";
import { adminKpisResponseSchema, type AdminKpiDay, type AdminKpisResponse } from "@bombaypetcompany/types";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

const MIN_DAYS = 1;
const MAX_DAYS = 90;

interface DayCountRow {
  day: string;
  count: number;
}

interface CheckDayCountRow {
  day: string;
  status: string;
  count: number;
}

/**
 * T111 step 6: `/v1/admin/kpis`'s day-bucket aggregate + tier snapshot.
 *
 * Every raw query is a `Prisma.sql` tagged template with a single BOUND
 * parameter (`${cutoff}`) -- never string interpolation, mirroring the
 * `ClientVersionsService` idiom (T117). Each source query is independent
 * (own `GROUP BY`, own index-backed `WHERE`) and the results are merged
 * in memory keyed by day -- a day present in only one source still
 * produces a full `AdminKpiDay` row with the other fields defaulted to 0.
 *
 * "MRR events" honesty (plan R1): `billingEventsProcessed` /
 * `subscriptionsUpdated` are EVENT COUNTS from `ProcessedWebhookEvent` /
 * `Subscription.lastEventAt` -- RC webhooks (T072/T073) persist no amount,
 * currency or event type, so this is never a revenue figure.
 */
@Injectable()
export class AdminKpisService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpis(requestedDays: number): Promise<AdminKpisResponse> {
    const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, requestedDays));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    const [deviceRows, checkRows, billingRows, subscriptionRows, tiers] = await Promise.all([
      this.prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
        SELECT
          to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM "Device"
        WHERE "createdAt" >= ${cutoff}
        GROUP BY 1
      `),
      this.prisma.$queryRaw<CheckDayCountRow[]>(Prisma.sql`
        SELECT
          to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
          "status",
          COUNT(*)::int AS count
        FROM "SymptomCheck"
        WHERE "createdAt" >= ${cutoff}
        GROUP BY 1, 2
      `),
      this.prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
        SELECT
          to_char(date_trunc('day', "processedAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM "ProcessedWebhookEvent"
        WHERE "processedAt" >= ${cutoff}
        GROUP BY 1
      `),
      this.prisma.$queryRaw<DayCountRow[]>(Prisma.sql`
        SELECT
          to_char(date_trunc('day', "lastEventAt"), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS count
        FROM "Subscription"
        WHERE "lastEventAt" >= ${cutoff}
        GROUP BY 1
      `),
      this.getTierSnapshot(now),
    ]);

    const daily = mergeDailyKpis(deviceRows, checkRows, billingRows, subscriptionRows);

    return adminKpisResponseSchema.parse({
      days,
      generatedAt: now.toISOString(),
      daily,
      tiers,
    });
  }

  private async getTierSnapshot(now: Date) {
    const [totalUsers, totalSubscriptions, premiumSubscriptions, activeReferralGrants] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({
        where: { entitlement: "PREMIUM", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      this.prisma.referralGrant.count({ where: { expiresAt: { gt: now } } }),
    ]);

    return {
      totalUsers,
      premiumSubscriptions,
      expiredOrInactiveSubscriptions: totalSubscriptions - premiumSubscriptions,
      activeReferralGrants,
    };
  }
}

/**
 * Pure merge (exported for unit testing): keyed by day, defaulting any
 * source that has no row for that day to 0. `fallbackRate` is `null` when
 * `checksDone + checksFallback === 0` for the day (never a fake 0%).
 */
export function mergeDailyKpis(
  deviceRows: readonly DayCountRow[],
  checkRows: readonly CheckDayCountRow[],
  billingRows: readonly DayCountRow[],
  subscriptionRows: readonly DayCountRow[],
): AdminKpiDay[] {
  const devicesByDay = new Map(deviceRows.map((row) => [row.day, row.count]));
  const billingByDay = new Map(billingRows.map((row) => [row.day, row.count]));
  const subscriptionsByDay = new Map(subscriptionRows.map((row) => [row.day, row.count]));

  const checksByDay = new Map<string, Record<string, number>>();
  for (const row of checkRows) {
    const existing = checksByDay.get(row.day) ?? {};
    existing[row.status] = row.count;
    checksByDay.set(row.day, existing);
  }

  const allDays = new Set<string>([
    ...devicesByDay.keys(),
    ...checksByDay.keys(),
    ...billingByDay.keys(),
    ...subscriptionsByDay.keys(),
  ]);

  return [...allDays]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((day) => {
      const statuses = checksByDay.get(day) ?? {};
      const checksDone = statuses.DONE ?? 0;
      const checksFallback = statuses.FALLBACK ?? 0;
      const checksCreated = Object.values(statuses).reduce((sum, count) => sum + count, 0);
      const terminalTotal = checksDone + checksFallback;

      return {
        day,
        devicesCreated: devicesByDay.get(day) ?? 0,
        checksCreated,
        checksDone,
        checksFallback,
        fallbackRate: terminalTotal === 0 ? null : checksFallback / terminalTotal,
        billingEventsProcessed: billingByDay.get(day) ?? 0,
        subscriptionsUpdated: subscriptionsByDay.get(day) ?? 0,
      };
    });
}
