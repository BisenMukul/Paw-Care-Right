import { createQueryClient } from "@pawcareright/api-client";
import type { CheckResponse, CompletedIntake } from "@pawcareright/types";
import type { Query, QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import { checkRefetchInterval, checksKeys, useCreateCheck, CHECK_POLL_INTERVAL_MS } from "../src/api/checks-api";
import { extractPhotoKeys } from "../src/checks/intake";
import { apiClient } from "../src/api/client";

/** Casts a minimal `{ state: { data } }` stand-in to the widened `Query` param (plan Risk 5). */
function fakeQuery(data: CheckResponse | undefined): Query<CheckResponse> {
  return { state: { data } } as unknown as Query<CheckResponse>;
}

// T047 plan "Hook & helper specs" + AC map. `checkRefetchInterval` is the
// pure polling-stop AC (AC1); `useCreateCheck` is the supporting
// Definition-of-Done test (Idempotency-Key header, photoKeys via
// `extractPhotoKeys`). The real `apiClient` singleton is mocked so the
// mutation posts through a spy instead of hitting the network.
jest.mock("../src/api/client", () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe("checkRefetchInterval (pure)", () => {
  it("returns the poll interval when there is no data yet", () => {
    expect(checkRefetchInterval(fakeQuery(undefined))).toBe(CHECK_POLL_INTERVAL_MS);
  });

  it.each(["QUEUED", "RUNNING"] as const)("returns the poll interval for %s", (status) => {
    const data = { status } as CheckResponse;
    expect(checkRefetchInterval(fakeQuery(data))).toBe(CHECK_POLL_INTERVAL_MS);
  });

  it.each(["DONE", "FALLBACK"] as const)("returns false (stops polling) for %s", (status) => {
    const data = { status } as CheckResponse;
    expect(checkRefetchInterval(fakeQuery(data))).toBe(false);
  });
});

describe("useCreateCheck", () => {
  const intake: CompletedIntake = {
    category: "vomiting",
    answers: [
      { questionId: "onset", type: "duration", value: 2, unit: "hours" },
      { questionId: "frequency", type: "single", value: "once" },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts with the right path, body, and Idempotency-Key header", async () => {
    const response: CheckResponse = {
      id: "check1",
      status: "QUEUED",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    mockedPost.mockResolvedValue(response);

    const client = createQueryClient();
    const { result } = await renderHook(() => useCreateCheck("pet1"), { wrapper: makeWrapper(client) });

    const photoKeys = extractPhotoKeys(intake);
    await result.current.mutateAsync({ intake, photoKeys, idempotencyKey: "idem-1" });

    await waitFor(() => {
      expect(mockedPost).toHaveBeenCalledTimes(1);
    });
    expect(mockedPost).toHaveBeenCalledWith(
      "/v1/pets/pet1/checks",
      { intake, photoKeys },
      { headers: { "Idempotency-Key": "idem-1" } },
    );
    expect(photoKeys).toEqual([]);
  });

  it("invalidates checksKeys.list(petId) on success", async () => {
    const response: CheckResponse = {
      id: "check1",
      status: "QUEUED",
      category: "vomiting",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    mockedPost.mockResolvedValue(response);

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useCreateCheck("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ intake, photoKeys: [], idempotencyKey: "idem-1" });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: checksKeys.list("pet1") });
    });
  });
});
