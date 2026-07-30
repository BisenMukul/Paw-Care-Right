import { Injectable } from "@nestjs/common";
import type { BillingEntitlement } from "@bombaypetcompany/types";

import { PrismaService } from "../prisma/prisma.service";
import { pickEntitlement, type SubscriptionRow } from "./entitlement.util";
import type { ReferralGrantRow } from "./referral-grant.util";

/**
 * Resolves the caller's billing entitlement (T072 plan decision 4; T108
 * step 14): THREE bounded queries -- an own-row PK lookup (identity,
 * survives household moves), a household-scoped list (family grants,
 * scoped to the caller's CURRENT household), and the caller's own active
 * (`expiresAt > now`) referral grants (index-backed by
 * `ReferralGrant`'s `@@index([userId, expiresAt])`) -- then an in-memory
 * strongest-pick via `pickEntitlement`. No N+1: exactly one `findUnique` +
 * two `findMany`, regardless of household size or grant history.
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlement(userId: string, householdId: string): Promise<BillingEntitlement> {
    const now = new Date();
    const [own, householdSubs, grants] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { rcAppUserId: userId } }),
      this.prisma.subscription.findMany({ where: { householdId } }),
      this.prisma.referralGrant.findMany({
        where: { userId, expiresAt: { gt: now } },
        select: { startsAt: true, expiresAt: true },
      }),
    ]);

    return pickEntitlement(
      own as SubscriptionRow | null,
      householdSubs as SubscriptionRow[],
      grants as ReferralGrantRow[],
      now,
    );
  }
}
