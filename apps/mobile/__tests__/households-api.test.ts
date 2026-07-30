import { createQueryClient } from "@bombaypetcompany/api-client";
import type { AcceptInviteResponse } from "@bombaypetcompany/types";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import { billingKeys } from "../src/api/billing-api";
import { apiClient } from "../src/api/client";
import { householdKeys, useAcceptInvite } from "../src/api/households-api";
import { petsKeys } from "../src/api/pets-api";

// T108 AC4b: an accepted invite now grants a server-side referral
// entitlement to both parties, so `useAcceptInvite` must invalidate billing
// entitlement alongside pets/household -- otherwise the joiner sees a stale
// FREE entitlement until an unrelated refetch. Idiom copied from
// `checks-api.test.ts` (real `apiClient` singleton mocked as a spy).
jest.mock("../src/api/client", () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe("useAcceptInvite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("invalidates petsKeys.all, householdKeys.me, and billingKeys.entitlement on success", async () => {
    const response: AcceptInviteResponse = { householdId: "household-1", name: "The Smiths" };
    mockedPost.mockResolvedValue(response);

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useAcceptInvite(), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ code: "AB3DEFGH" });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: petsKeys.all });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: householdKeys.me });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: billingKeys.entitlement });
  });
});
