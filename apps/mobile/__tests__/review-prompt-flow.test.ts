import { createMMKV } from "react-native-mmkv";

import { maybeRequestReview } from "../src/review/request-review";
import {
  readReviewGateState,
  recordEmergencySeen,
  recordReminderEvent,
  writeLastPromptedAt,
} from "../src/review/review-state";
import { requestStoreReview, type StoreReviewApi, type StoreReviewLoader } from "../src/review/store-review";

// T109 AC2: state persistence + native lazy-require safety + the
// stamp-before-await integration, proven through the real (mocked-MMKV)
// persistence layer, mirroring `update-throttle.test.ts`'s "fresh
// `createMMKV()` handle" round-trip idiom.

const LAST_PROMPTED_AT_KEY = "bombaypetcompany.review-last-prompted-at";
const LAST_EMERGENCY_AT_KEY = "bombaypetcompany.review-last-emergency-at";
const COMPLETION_STREAK_KEY = "bombaypetcompany.review-completion-streak";

const NOW = 1_700_000_000_000;

function clearReviewState(): void {
  const mmkv = createMMKV();
  mmkv.remove(LAST_PROMPTED_AT_KEY);
  mmkv.remove(LAST_EMERGENCY_AT_KEY);
  mmkv.remove(COMPLETION_STREAK_KEY);
}

function fixtureLoader(api: StoreReviewApi | null): StoreReviewLoader {
  return jest.fn(() => api);
}

describe("review-state + store-review + request-review (AC2)", () => {
  beforeEach(() => {
    clearReviewState();
  });

  it("AC2.1: persists and reads back the gate state", () => {
    writeLastPromptedAt(NOW);
    recordEmergencySeen(NOW - 1000);
    recordReminderEvent("completed");
    recordReminderEvent("completed");

    expect(readReviewGateState()).toEqual({
      lastPromptedAt: NOW,
      lastEmergencyAt: NOW - 1000,
      completionStreak: 2,
    });
  });

  it("AC2.2: treats a poisoned stored value as never-prompted / zero streak", () => {
    const mmkv = createMMKV();
    mmkv.set(LAST_PROMPTED_AT_KEY, "not-a-number");
    mmkv.set(LAST_EMERGENCY_AT_KEY, "-5");
    mmkv.set(COMPLETION_STREAK_KEY, "NaN");

    expect(readReviewGateState()).toEqual({
      lastPromptedAt: null,
      lastEmergencyAt: null,
      completionStreak: 0,
    });
  });

  it("AC2.3: requestStoreReview no-ops when the native module is absent (null loader, throwing loader)", async () => {
    await expect(requestStoreReview(fixtureLoader(null))).resolves.toBe(false);

    const throwingLoader: StoreReviewLoader = () => {
      throw new Error("native module unavailable");
    };
    await expect(requestStoreReview(throwingLoader)).resolves.toBe(false);
  });

  it("AC2.4: requestStoreReview no-ops when the OS says review is unavailable", async () => {
    const unavailableRequestReview = jest.fn(async () => undefined);
    await expect(
      requestStoreReview(
        fixtureLoader({ isAvailableAsync: jest.fn(async () => false), requestReview: unavailableRequestReview }),
      ),
    ).resolves.toBe(false);
    expect(unavailableRequestReview).not.toHaveBeenCalled();

    const noActionRequestReview = jest.fn(async () => undefined);
    await expect(
      requestStoreReview(
        fixtureLoader({ hasAction: jest.fn(async () => false), requestReview: noActionRequestReview }),
      ),
    ).resolves.toBe(false);
    expect(noActionRequestReview).not.toHaveBeenCalled();
  });

  it("AC2.5: requestStoreReview swallows a rejecting requestReview", async () => {
    const rejectingRequestReview = jest.fn(async () => {
      throw new Error("dialog failed");
    });

    await expect(requestStoreReview(fixtureLoader({ requestReview: rejectingRequestReview }))).resolves.toBe(false);
  });

  it("AC2.6: maybeRequestReview stamps the throttle before awaiting the native call", async () => {
    const neverResolvingRequestReview = jest.fn(() => new Promise<void>(() => {}));
    const loader = fixtureLoader({ requestReview: neverResolvingRequestReview });

    // Deliberately not awaited: the assertion below proves the throttle
    // stamp already happened synchronously, before the native call settles.
    void maybeRequestReview("reassure-acknowledged", { now: NOW, loader });
    await Promise.resolve();
    await Promise.resolve();

    expect(readReviewGateState().lastPromptedAt).toBe(NOW);

    const second = await maybeRequestReview("reassure-acknowledged", { now: NOW, loader });
    expect(second).toBe("suppressed-throttle");
    expect(neverResolvingRequestReview).toHaveBeenCalledTimes(1);
  });

  it("AC2.7: a suppressed decision never touches the native module and never stamps", async () => {
    recordEmergencySeen(NOW);
    const requestReview = jest.fn(async () => undefined);
    const loader = fixtureLoader({ requestReview });

    const decision = await maybeRequestReview("reassure-acknowledged", { now: NOW, loader });

    expect(decision).toBe("suppressed-emergency");
    expect(requestReview).not.toHaveBeenCalled();
    expect(readReviewGateState().lastPromptedAt).toBeNull();
  });

  it("AC2.8: recordEmergencySeen makes an immediately-following positive moment suppressed", async () => {
    recordEmergencySeen();

    const decision = await maybeRequestReview("reassure-acknowledged");

    expect(decision).toBe("suppressed-emergency");
  });
});
