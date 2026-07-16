import { Injectable } from "@nestjs/common";
import type { BillingEntitlement } from "@pawcareright/types";

import { PrismaService } from "../prisma/prisma.service";
import { pickEntitlement, type SubscriptionRow } from "./entitlement.util";

/**
 * Resolves the caller's billing entitlement (T072 plan decision 4): two
 * bounded queries -- an own-row PK lookup (identity, survives household
 * moves) and a household-scoped list (family grants, scoped to the
 * caller's CURRENT household) -- then an in-memory strongest-pick via
 * `pickEntitlement`. No N+1: exactly one `findUnique` + one `findMany`,
 * regardless of household size.
 */
@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getEntitlement(userId: string, householdId: string): Promise<BillingEntitlement> {
    const [own, householdSubs] = await Promise.all([
      this.prisma.subscription.findUnique({ where: { rcAppUserId: userId } }),
      this.prisma.subscription.findMany({ where: { householdId } }),
    ]);

    return pickEntitlement(own as SubscriptionRow | null, householdSubs as SubscriptionRow[], new Date());
  }
}
