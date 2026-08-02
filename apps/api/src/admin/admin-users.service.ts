import { Injectable, NotFoundException } from "@nestjs/common";
import { adminUserSummarySchema, type AdminUserSummary } from "@bombaypetcompany/types";

import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * T111 step 7: `/v1/admin/users/lookup`'s single-user, read-only lookup.
 *
 * `User.email` is `@unique` and normalised to `.trim().toLowerCase()` on
 * every write path (`auth.service.ts`, `otp.service.ts`,
 * `social-auth.service.ts`) -- the lookup normalises input identically and
 * uses `findUnique`, so it stays index-backed (never a `mode: "insensitive"`
 * table scan). Not found -> `NotFoundException` (-> the global `NOT_FOUND`
 * error envelope).
 *
 * Fields returned are exactly D4's ids/codes/counts allowlist -- never a pet
 * name, symptom/intake text, chat content, photo key, or token. Entitlement
 * is resolved via the real, read-only `BillingService.getEntitlement`
 * (the same resolver `/billing/entitlement` uses) so support answers stay
 * accurate rather than reading the RC-mirror snapshot alone (see R3).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async lookupByEmail(rawEmail: string): Promise<AdminUserSummary> {
    const email = rawEmail.trim().toLowerCase();
    const now = new Date();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        createdAt: true,
        locale: true,
        region: true,
        analyticsOptOut: true,
        deletionScheduledAt: true,
        memberships: { select: { householdId: true } },
      },
    });

    if (user === null) {
      throw new NotFoundException();
    }

    const householdIds = user.memberships.map((membership) => membership.householdId);

    const [
      pets,
      symptomChecksTotal,
      symptomChecksFallback,
      chatThreads,
      chatMessages,
      reminders,
      healthLogs,
      devices,
      feedbackReports,
      accountExports,
      referralGrantsActive,
      entitlement,
    ] = await Promise.all([
      this.prisma.pet.count({ where: { householdId: { in: householdIds }, deletedAt: null } }),
      this.prisma.symptomCheck.count({ where: { createdById: user.id } }),
      this.prisma.symptomCheck.count({ where: { createdById: user.id, status: "FALLBACK" } }),
      this.prisma.chatThread.count({ where: { createdById: user.id } }),
      this.prisma.chatMessage.count({ where: { thread: { createdById: user.id } } }),
      this.prisma.reminder.count({ where: { pet: { householdId: { in: householdIds } } } }),
      this.prisma.healthLog.count({ where: { pet: { householdId: { in: householdIds } } } }),
      this.prisma.device.count({ where: { userId: user.id } }),
      this.prisma.feedbackReport.count({ where: { userId: user.id } }),
      this.prisma.accountExport.count({ where: { userId: user.id } }),
      this.prisma.referralGrant.count({ where: { userId: user.id, expiresAt: { gt: now } } }),
      this.billingService.getEntitlement(user.id, householdIds[0] ?? ""),
    ]);

    return adminUserSummarySchema.parse({
      userId: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      locale: user.locale,
      region: user.region,
      analyticsOptOut: user.analyticsOptOut,
      deletionScheduledAt: user.deletionScheduledAt?.toISOString() ?? null,
      householdIds,
      entitlement,
      counters: {
        pets,
        symptomChecksTotal,
        symptomChecksFallback,
        chatThreads,
        chatMessages,
        reminders,
        healthLogs,
        devices,
        feedbackReports,
        accountExports,
        referralGrantsActive,
      },
    });
  }
}
