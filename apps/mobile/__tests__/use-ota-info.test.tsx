import { renderHook } from "@testing-library/react-native";

import { useOtaInfo } from "../src/hooks/use-ota-info";
import type { UpdatesLoader, UpdatesNative } from "../src/observability/ota-info";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  updateId: "u-2",
  channel: "production",
  runtimeVersion: "fp-xyz",
  isEmbeddedLaunch: false,
}));

const ABSENT_SHAPE = {
  isEnabled: false,
  updateId: null,
  channel: null,
  runtimeVersion: null,
  isEmbeddedLaunch: true,
};

function fixtureLoader(native: UpdatesNative | null): UpdatesLoader {
  return jest.fn(() => native);
}

describe("useOtaInfo", () => {
  it("exposes updateId, channel, runtimeVersion and isEmbeddedLaunch from the Updates module", async () => {
    const loader = fixtureLoader({
      isEnabled: true,
      updateId: "u-1",
      channel: "preview",
      runtimeVersion: "fp-abc",
      isEmbeddedLaunch: false,
    });

    const { result } = await renderHook(() => useOtaInfo(loader));

    expect(result.current).toEqual({
      isEnabled: true,
      updateId: "u-1",
      channel: "preview",
      runtimeVersion: "fp-abc",
      isEmbeddedLaunch: false,
    });
  });

  it("falls back to the all-absent shape when the native module is missing", async () => {
    const loader = fixtureLoader(null);

    const { result } = await renderHook(() => useOtaInfo(loader));

    expect(result.current).toEqual(ABSENT_SHAPE);
  });

  it("never throws when the Updates module itself throws on load", async () => {
    const loader: UpdatesLoader = jest.fn(() => {
      throw new Error("native binding unavailable");
    });

    let renderResult: Awaited<ReturnType<typeof renderHook>> | undefined;
    await expect(
      (async () => {
        renderResult = await renderHook(() => useOtaInfo(loader));
      })(),
    ).resolves.not.toThrow();

    expect(renderResult?.result.current).toEqual(ABSENT_SHAPE);
  });

  it("normalises an empty-string channel or updateId to null", async () => {
    const loader = fixtureLoader({
      isEnabled: true,
      updateId: "",
      channel: "",
      runtimeVersion: "fp-abc",
      isEmbeddedLaunch: true,
    });

    const { result } = await renderHook(() => useOtaInfo(loader));

    expect(result.current.updateId).toBeNull();
    expect(result.current.channel).toBeNull();
    expect(result.current.isEmbeddedLaunch).toBe(true);
  });

  it("reads the real mocked expo-updates module through the default loader", async () => {
    const { result } = await renderHook(() => useOtaInfo());

    expect(result.current).toEqual({
      isEnabled: true,
      updateId: "u-2",
      channel: "production",
      runtimeVersion: "fp-xyz",
      isEmbeddedLaunch: false,
    });
  });

  it("reads the module once per mount", async () => {
    const loader = fixtureLoader({
      isEnabled: true,
      updateId: "u-1",
      channel: "preview",
      runtimeVersion: "fp-abc",
      isEmbeddedLaunch: false,
    });

    const { rerender } = await renderHook(() => useOtaInfo(loader));
    await rerender({});
    await rerender({});

    expect(loader).toHaveBeenCalledTimes(1);
  });
});
