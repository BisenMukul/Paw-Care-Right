import { Injectable } from "@nestjs/common";

import type { Entitlement } from "./quota.types";

/** DI token for the injectable {@link EntitlementResolver}. */
export const ENTITLEMENT_RESOLVER = "ENTITLEMENT_RESOLVER";

export interface EntitlementResolver {
  resolve(userId: string): Promise<Entitlement>;
}

/**
 * v1 placeholder resolver: everyone is FREE, no bypass. Real entitlement
 * resolution (RevenueCat mirror) lands at P7 — out of scope for T039.
 */
@Injectable()
export class StaticEntitlementResolver implements EntitlementResolver {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async resolve(_userId: string): Promise<Entitlement> {
    return { tier: "FREE", bypassQuota: false };
  }
}
