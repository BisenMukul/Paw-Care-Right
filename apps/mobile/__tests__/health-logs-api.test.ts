import { createQueryClient } from "@pawcareright/api-client";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import React from "react";

import type { VetVisitValue } from "@pawcareright/types";

import {
  healthTimelineKeys,
  useAddActivity,
  useAddNote,
  useAddVetVisit,
  useAddWeight,
  useWeightSeries,
  weightSeriesKeys,
  type WeightSeriesResponse,
} from "../src/api/health-logs-api";
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

describe("useAddNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts kind:NOTE with value.text, no photoKeys, and an occurredAt close to now", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });
    const before = Date.now();

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddNote("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ text: "Ate a bug", photoKeys: [] });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockedPost.mock.calls[0] as [
      string,
      { kind: string; occurredAt: string; value: unknown; photoKeys?: string[] },
    ];
    expect(path).toBe("/v1/pets/pet1/logs");
    expect(body.kind).toBe("NOTE");
    expect(body.value).toEqual({ text: "Ate a bug" });
    expect(body.photoKeys).toBeUndefined();
    expect(Math.abs(new Date(body.occurredAt).getTime() - before)).toBeLessThan(5000);
  });

  it("includes photoKeys only when non-empty", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddNote("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ text: "Ate a bug", photoKeys: ["pets/pet1/original/a.jpg"] });

    const [, body] = mockedPost.mock.calls[0] as [string, { photoKeys?: string[] }];
    expect(body.photoKeys).toEqual(["pets/pet1/original/a.jpg"]);
  });

  it("invalidates healthTimelineKeys.pet(petId) on success", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useAddNote("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ text: "Ate a bug", photoKeys: [] });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: healthTimelineKeys.pet("pet1") });
    });
  });
});

describe("useAddVetVisit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts kind:VET_VISIT with the validated value, no photoKeys, and an occurredAt close to now", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });
    const before = Date.now();
    const value: VetVisitValue = { reason: "Annual checkup" };

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddVetVisit("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ value, photoKeys: [] });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockedPost.mock.calls[0] as [
      string,
      { kind: string; occurredAt: string; value: unknown; photoKeys?: string[] },
    ];
    expect(path).toBe("/v1/pets/pet1/logs");
    expect(body.kind).toBe("VET_VISIT");
    expect(body.value).toEqual(value);
    expect(body.photoKeys).toBeUndefined();
    expect(Math.abs(new Date(body.occurredAt).getTime() - before)).toBeLessThan(5000);
  });

  it("posts optional value fields only when supplied", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });
    const value: VetVisitValue = { reason: "Annual checkup", clinicName: "Maple Vet" };

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddVetVisit("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ value, photoKeys: [] });

    const [, body] = mockedPost.mock.calls[0] as [string, { value: unknown }];
    expect(body.value).toEqual(value);
  });

  it("includes photoKeys only when non-empty (upload-reuse AC)", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddVetVisit("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({
      value: { reason: "Annual checkup" },
      photoKeys: ["pets/pet1/original/a.jpg"],
    });

    const [, body] = mockedPost.mock.calls[0] as [string, { photoKeys?: string[] }];
    expect(body.photoKeys).toEqual(["pets/pet1/original/a.jpg"]);
  });

  it("invalidates healthTimelineKeys.pet(petId) on success", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useAddVetVisit("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ value: { reason: "Annual checkup" }, photoKeys: [] });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: healthTimelineKeys.pet("pet1") });
    });
  });
});

describe("useAddActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("posts kind:ACTIVITY with the given activityType/quantity/unit and an occurredAt close to now", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });
    const before = Date.now();

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddActivity("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ activityType: "FOOD", quantity: 2, unit: "meals" });

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [path, body] = mockedPost.mock.calls[0] as [
      string,
      { kind: string; occurredAt: string; value: unknown },
    ];
    expect(path).toBe("/v1/pets/pet1/logs");
    expect(body.kind).toBe("ACTIVITY");
    expect(body.value).toEqual({ activityType: "FOOD", quantity: 2, unit: "meals" });
    expect(Math.abs(new Date(body.occurredAt).getTime() - before)).toBeLessThan(5000);
  });

  it("omits quantity/unit/note when not supplied (a chips-only GROOMING save)", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddActivity("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ activityType: "GROOMING", unit: "brush" });

    const [, body] = mockedPost.mock.calls[0] as [string, { value: unknown }];
    expect(body.value).toEqual({ activityType: "GROOMING", unit: "brush" });
  });

  it("includes note only when non-empty", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const { result } = await renderHook(() => useAddActivity("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ activityType: "WALK", quantity: 20, unit: "min", note: "Extra long walk" });

    const [, body] = mockedPost.mock.calls[0] as [string, { value: unknown }];
    expect(body.value).toEqual({ activityType: "WALK", quantity: 20, unit: "min", note: "Extra long walk" });
  });

  it("invalidates healthTimelineKeys.pet(petId) on success", async () => {
    mockedPost.mockResolvedValue({ id: "log1" });

    const client = createQueryClient();
    const invalidateSpy = jest.spyOn(client, "invalidateQueries");
    const { result } = await renderHook(() => useAddActivity("pet1"), { wrapper: makeWrapper(client) });

    await result.current.mutateAsync({ activityType: "FOOD", quantity: 1, unit: "meals" });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: healthTimelineKeys.pet("pet1") });
    });
  });
});
