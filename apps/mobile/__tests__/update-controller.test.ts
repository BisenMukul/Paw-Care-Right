import {
  COLD_START_CHECK_BUDGET_MS,
  hasCriticalMarker,
  isCriticalUpdate,
  runUpdateCycle,
  type OtaCycleEvent,
  type UpdatesApiLoader,
  type UpdatesUpdateApi,
} from "../src/ota/update-controller";

// T114: the global `jest.setup.ts` `expo-updates` mock reports
// `updateId: null` by default — `runUpdateCycle`'s `readOtaInfo()` call
// therefore sees `currentUpdateId: null` unless a test-local
// `jest.mock("expo-updates", ...)` overrides it (mirrors
// `use-ota-info.test.tsx`'s per-file override pattern).
jest.mock("expo-updates", () => ({
  isEnabled: false,
  updateId: "u-1",
  channel: null,
  runtimeVersion: null,
  isEmbeddedLaunch: true,
}));

function fixtureLoader(api: UpdatesUpdateApi | null): UpdatesApiLoader {
  return jest.fn(() => api);
}

describe("update-controller: hasCriticalMarker", () => {
  it("finds the [critical] marker in extra.updateMessage, case-insensitively", () => {
    expect(hasCriticalMarker({ extra: { updateMessage: "T114/M10: hotfix [CRITICAL]" } })).toBe(
      true,
    );
  });

  it("finds the marker in extra.expoClient.extra.updateMessage", () => {
    expect(
      hasCriticalMarker({ extra: { expoClient: { extra: { updateMessage: "fix [critical]" } } } }),
    ).toBe(true);
  });

  it("finds the marker in metadata.updateMessage", () => {
    expect(hasCriticalMarker({ metadata: { updateMessage: "fix [critical]" } })).toBe(true);
  });

  it("returns false when no candidate path carries the marker", () => {
    expect(hasCriticalMarker({ extra: { updateMessage: "just a normal release" } })).toBe(false);
  });

  it("returns false, never throws, for unreadable manifests", () => {
    expect(hasCriticalMarker(null)).toBe(false);
    expect(hasCriticalMarker(undefined)).toBe(false);
    expect(hasCriticalMarker("a string, not an object")).toBe(false);
    expect(hasCriticalMarker(42)).toBe(false);
    expect(hasCriticalMarker({})).toBe(false);
  });
});

describe("update-controller: isCriticalUpdate", () => {
  it("is critical when the manifest marker is present, regardless of criticalOtaVersion", () => {
    expect(
      isCriticalUpdate({
        manifest: { extra: { updateMessage: "[critical]" } },
        criticalOtaVersion: null,
        currentUpdateId: "u-1",
      }),
    ).toBe(true);
  });

  it("is critical when criticalOtaVersion names an updateId we are not running (S9 belt-and-braces)", () => {
    expect(
      isCriticalUpdate({ manifest: {}, criticalOtaVersion: "u-9", currentUpdateId: "u-1" }),
    ).toBe(true);
  });

  it("is NOT critical when criticalOtaVersion equals the current updateId", () => {
    expect(
      isCriticalUpdate({ manifest: {}, criticalOtaVersion: "u-1", currentUpdateId: "u-1" }),
    ).toBe(false);
  });

  it("is NOT critical when no marker and criticalOtaVersion is null", () => {
    expect(
      isCriticalUpdate({ manifest: {}, criticalOtaVersion: null, currentUpdateId: "u-1" }),
    ).toBe(false);
  });
});

describe("update-controller: runUpdateCycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("abandons the cycle when the check exceeds the 3s budget (AC1a)", async () => {
    const fetchUpdateAsync = jest.fn();
    const reloadAsync = jest.fn();
    const checkForUpdateAsync = jest.fn(
      (): Promise<{ isAvailable?: boolean; manifest?: unknown }> => new Promise(() => {}), // never resolves
    );
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync,
      fetchUpdateAsync,
      reloadAsync,
    });

    const promise = runUpdateCycle({ loader, criticalOtaVersion: null });
    await jest.advanceTimersByTimeAsync(COLD_START_CHECK_BUDGET_MS);

    await expect(promise).resolves.toBe("timeout");
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it("FOREGROUND_RECHECK budget constant equals the exported COLD_START_CHECK_BUDGET_MS default", () => {
    expect(COLD_START_CHECK_BUDGET_MS).toBe(3000);
  });

  it("a check that rejects AFTER the timeout has already won produces no unhandled rejection", async () => {
    let rejectCheck: (err: Error) => void = () => {};
    const checkForUpdateAsync = jest.fn(
      (): Promise<{ isAvailable?: boolean; manifest?: unknown }> =>
        new Promise((_resolve, reject) => {
          rejectCheck = reject;
        }),
    );
    const loader = fixtureLoader({ isEnabled: true, checkForUpdateAsync });

    const promise = runUpdateCycle({ loader, criticalOtaVersion: null });
    await jest.advanceTimersByTimeAsync(COLD_START_CHECK_BUDGET_MS);
    await expect(promise).resolves.toBe("timeout");

    // The late rejection must be swallowed, not surfaced.
    rejectCheck(new Error("late failure"));
    await jest.runAllTimersAsync();
  });

  it("returns critical when the fetched manifest carries a [critical] marker (AC1b)", async () => {
    const reloadAsync = jest.fn();
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({
        isNew: true,
        manifest: { extra: { updateMessage: "T114/M10: hotfix [critical]" } },
      })),
      reloadAsync,
    });

    await expect(runUpdateCycle({ loader, criticalOtaVersion: null })).resolves.toBe("critical");
    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it("returns critical when /config.criticalOtaVersion names an updateId we are not running (S9)", async () => {
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({ isNew: true, manifest: {} })),
    });

    await expect(runUpdateCycle({ loader, criticalOtaVersion: "u-9" })).resolves.toBe("critical");
    // Current mocked updateId ("u-1") matches criticalOtaVersion -> silent.
    await expect(runUpdateCycle({ loader, criticalOtaVersion: "u-1" })).resolves.toBe("silent");
  });

  it("fetches and stays silent for a non-critical update (AC1c)", async () => {
    const fetchUpdateAsync = jest.fn(async () => ({ isNew: true, manifest: {} }));
    const reloadAsync = jest.fn();
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync,
      reloadAsync,
    });

    await expect(runUpdateCycle({ loader, criticalOtaVersion: null })).resolves.toBe("silent");
    expect(fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it("returns disabled/none/error without ever reloading (AC1 robustness)", async () => {
    const reloadAsync = jest.fn();

    // loader -> null
    await expect(
      runUpdateCycle({ loader: () => null, criticalOtaVersion: null }),
    ).resolves.toBe("disabled");

    // isEnabled: false
    await expect(
      runUpdateCycle({
        loader: fixtureLoader({ isEnabled: false, checkForUpdateAsync: jest.fn(), reloadAsync }),
        criticalOtaVersion: null,
      }),
    ).resolves.toBe("disabled");

    // no checkForUpdateAsync
    await expect(
      runUpdateCycle({ loader: fixtureLoader({ isEnabled: true }), criticalOtaVersion: null }),
    ).resolves.toBe("disabled");

    // isAvailable: false
    await expect(
      runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
          reloadAsync,
        }),
        criticalOtaVersion: null,
      }),
    ).resolves.toBe("none");

    // check rejects
    await expect(
      runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(async () => {
            throw new Error("network down");
          }),
          reloadAsync,
        }),
        criticalOtaVersion: null,
      }),
    ).resolves.toBe("error");

    // fetch rejects
    await expect(
      runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
          fetchUpdateAsync: jest.fn(async () => {
            throw new Error("fetch failed");
          }),
          reloadAsync,
        }),
        criticalOtaVersion: null,
      }),
    ).resolves.toBe("error");

    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it("a loader that throws resolves to disabled, never throws", async () => {
    await expect(
      runUpdateCycle({
        loader: () => {
          throw new Error("native binding unavailable");
        },
        criticalOtaVersion: null,
      }),
    ).resolves.toBe("disabled");
  });
});

// T117 step 10: `onEvent` (D3) — order, props, inertness of a throwing
// callback, and no-event outcomes. The global `expo-updates` mock at the top
// of this file reports `updateId: "u-1"`, `channel: null` (no `channel`
// field in that fixture) — `readOtaInfo`'s `normalizeNullableString`
// normalises the absent field to `null`.
describe("update-controller: onEvent (T117 D3)", () => {
  it("fires available then downloaded in order with the right props for a non-critical update", async () => {
    const events: OtaCycleEvent[] = [];
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({ isNew: true, manifest: {} })),
    });

    const outcome = await runUpdateCycle({
      loader,
      criticalOtaVersion: null,
      onEvent: (event) => events.push(event),
    });

    expect(outcome).toBe("silent");
    expect(events).toEqual([
      { kind: "available", channel: null, currentUpdateId: "u-1" },
      { kind: "downloaded", channel: null, currentUpdateId: "u-1", critical: false },
    ]);
  });

  it("the downloaded event carries critical: true for a critical update", async () => {
    const events: OtaCycleEvent[] = [];
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({
        isNew: true,
        manifest: { extra: { updateMessage: "T117: hotfix [critical]" } },
      })),
    });

    const outcome = await runUpdateCycle({
      loader,
      criticalOtaVersion: null,
      onEvent: (event) => events.push(event),
    });

    expect(outcome).toBe("critical");
    expect(events).toEqual([
      { kind: "available", channel: null, currentUpdateId: "u-1" },
      { kind: "downloaded", channel: null, currentUpdateId: "u-1", critical: true },
    ]);
  });

  it("a throwing onEvent does not change the outcome (telemetry is inert)", async () => {
    const onEvent = jest.fn(() => {
      throw new Error("telemetry blew up");
    });
    const loader = fixtureLoader({
      isEnabled: true,
      checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
      fetchUpdateAsync: jest.fn(async () => ({ isNew: true, manifest: {} })),
    });

    await expect(runUpdateCycle({ loader, criticalOtaVersion: null, onEvent })).resolves.toBe("silent");
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("no event fires on disabled/none/error/timeout outcomes", async () => {
    jest.useFakeTimers();
    try {
      const onEvent = jest.fn();

      // disabled
      await runUpdateCycle({ loader: () => null, criticalOtaVersion: null, onEvent });
      // none
      await runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
        }),
        criticalOtaVersion: null,
        onEvent,
      });
      // error (check rejects)
      await runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(async () => {
            throw new Error("network down");
          }),
        }),
        criticalOtaVersion: null,
        onEvent,
      });
      // timeout
      const timeoutPromise = runUpdateCycle({
        loader: fixtureLoader({
          isEnabled: true,
          checkForUpdateAsync: jest.fn(() => new Promise(() => {})),
        }),
        criticalOtaVersion: null,
        onEvent,
      });
      await jest.advanceTimersByTimeAsync(COLD_START_CHECK_BUDGET_MS);
      await expect(timeoutPromise).resolves.toBe("timeout");

      expect(onEvent).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
