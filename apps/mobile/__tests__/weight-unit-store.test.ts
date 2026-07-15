import { createMMKV } from "react-native-mmkv";
import { act, renderHook } from "@testing-library/react-native";

import { useWeightUnit, useWeightUnitStore } from "../src/weight/weight-unit-store";

const mockGetDeviceRegionCode = jest.fn();

// Mirrors `care-plan-wizard.test.tsx`'s region mock.
jest.mock("../src/checks/region", () => ({
  getDeviceRegionCode: () => mockGetDeviceRegionCode(),
}));

describe("useWeightUnitStore (persistence)", () => {
  beforeEach(() => {
    useWeightUnitStore.setState({ override: null });
    mockGetDeviceRegionCode.mockReturnValue(undefined);
  });

  it("sets and reads the override", () => {
    useWeightUnitStore.getState().setUnit("lb");
    expect(useWeightUnitStore.getState().override).toBe("lb");
  });

  it("persists the override across a simulated reload", async () => {
    useWeightUnitStore.getState().setUnit("lb");

    const mmkv = createMMKV();
    const persistedRaw = mmkv.getString("pawcareright.weight-unit");
    expect(persistedRaw).toBeTruthy();
    expect(persistedRaw).toContain("lb");

    useWeightUnitStore.getState().setUnit("kg");
    expect(useWeightUnitStore.getState().override).toBe("kg");

    // Simulate relaunch: storage still holds the earlier "lb" snapshot.
    mmkv.set("pawcareright.weight-unit", persistedRaw as string);
    await useWeightUnitStore.persist.rehydrate();

    expect(useWeightUnitStore.getState().override).toBe("lb");
  });
});

describe("useWeightUnit", () => {
  beforeEach(() => {
    useWeightUnitStore.setState({ override: null });
    mockGetDeviceRegionCode.mockReset();
  });

  it("falls back to the locale default (metric) when there is no override", async () => {
    mockGetDeviceRegionCode.mockReturnValue("GB");
    const { result } = await renderHook(() => useWeightUnit());
    expect(result.current.unit).toBe("kg");
  });

  it("falls back to the locale default (imperial) when there is no override", async () => {
    mockGetDeviceRegionCode.mockReturnValue("US");
    const { result } = await renderHook(() => useWeightUnit());
    expect(result.current.unit).toBe("lb");
  });

  it("a persisted override wins over the locale default", async () => {
    mockGetDeviceRegionCode.mockReturnValue("US");
    useWeightUnitStore.getState().setUnit("kg");
    const { result } = await renderHook(() => useWeightUnit());
    expect(result.current.unit).toBe("kg");
  });

  it("toggle flips kg -> lb -> kg", async () => {
    mockGetDeviceRegionCode.mockReturnValue("GB");
    const { result } = await renderHook(() => useWeightUnit());
    expect(result.current.unit).toBe("kg");

    await act(() => {
      result.current.toggle();
    });
    expect(result.current.unit).toBe("lb");

    await act(() => {
      result.current.toggle();
    });
    expect(result.current.unit).toBe("kg");
  });
});
