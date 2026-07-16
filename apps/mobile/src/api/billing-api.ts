import type { BillingEntitlement } from "@pawcareright/types";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

export const billingKeys = {
  entitlement: ["billing", "entitlement"] as const,
};

/** GET `/v1/billing/entitlement` (T072/T076): the caller's resolved billing entitlement. */
export function useEntitlement() {
  return useQuery({
    queryKey: billingKeys.entitlement,
    queryFn: () => apiClient.get<BillingEntitlement>("/v1/billing/entitlement"),
  });
}
