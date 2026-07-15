import { createQueryClient } from "@pawcareright/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import { useAddWeight, useWeightSeries, weightSeriesKeys, type WeightSeriesResponse } from "../src/api/health-logs-api";
import { apiClient } from "../src/api/client";

// Mirrors `checks-api.test.ts`'s mocked-client pattern.
jest.mock("../src/api/client", () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));

const mockedPost = apiClient.post as jest.Mock;
const mockedGet = apiClient.get as jest.Mock;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

describe("useWeightSeries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GETs the weight-series path for the pet", async () => {
    const response: WeightSeriesResponse = {
      points: [{ t: "2024-01-01T00:00:00.000Z", grams: 25000 }],
      sampled: false,
    };
    mockedGet.mockResolvedValue(response);

    const client = createQueryClient();
    const { result } = await renderHook(() => useWeightSeries("pet1"), { wrapper: makeWrapper(client) });

    await waitFor(() => {
      expect(result.current.data).toEqual(response);
    });
    expect(mockedGet).toHaveBeenCalledWith("/v1/pets/pet1/weight-series");
  });
});

describe("useAddWeight", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts kind:WEIGHT with value.weightGrams and an occurredAt close to now", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });
    const before = Date.now();

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddWeight("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ grams: 25000 });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockedPost.mock.calls[0] as [string, { kind: string; occurredAt: string; value: unknown }];
    expect(path).toBe("/v1/pets/pet1/logs");
    expect(body.kind).toBe("WEIGHT");
    expect(body.value).toEqual({ weightGrams: 25000 });
    expect(Math.abs(new Date(body.occurredAt).getTime() - before)).toBeLessThan(5000);
  });

  it("invalidates weightSeriesKeys.pet(petId) on success", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useAddWeight("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ grams: 25000 });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: weightSeriesKeys.pet("pet1") });
    });
  });
});
