// T104 checker finding F1 (MED): the content-free-breadcrumb invariant
// (D5) was previously only exercised through a wholesale mock of
// `../src/observability/sentry` in `feedback-screen.test.tsx`, so
// `addFeedbackBreadcrumb`/`getLastSentryEventId`'s REAL bodies had zero
// coverage. This file mirrors `sentry.test.ts`'s pattern (mocks the
// NATIVE `@sentry/react-native` module directly, never the wrapper under
// test) so the real implementations run.
const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockWithScope = jest.fn((callback: (scope: { setContext: jest.Mock }) => void) => {
  callback({ setContext: jest.fn() });
});
const mockAddBreadcrumb = jest.fn();
const mockLastEventId = jest.fn();
// T117: `initMobileSentry` now also calls `Sentry.setTag(...)` for the four
// boot tags (inside the SAME try/catch as `Sentry.init`) -- this mock must
// provide it, or the real `initMobileSentry` throws on `setTag` being
// undefined and silently falls into its outer catch (`sentryModule =
// undefined`), which would make every test below fail for a reason
// unrelated to what it actually tests.
const mockSetTag = jest.fn();

jest.mock("@sentry/react-native", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  withScope: mockWithScope,
  addBreadcrumb: mockAddBreadcrumb,
  lastEventId: mockLastEventId,
  setTag: mockSetTag,
}));

jest.mock("../src/config", () => ({
  getConfig: jest.fn(),
  getAppVersion: jest.fn(() => "1.2.3"),
}));

import { scrubBreadcrumb, type Breadcrumb } from "@bombaypetcompany/analytics";

import { getConfig } from "../src/config";
import { addFeedbackBreadcrumb, getLastSentryEventId, initMobileSentry } from "../src/observability/sentry";

const mockGetConfig = getConfig as jest.Mock;

function emittedBreadcrumb(): Breadcrumb {
  expect(mockAddBreadcrumb).toHaveBeenCalledTimes(1);
  return mockAddBreadcrumb.mock.calls[0]![0] as Breadcrumb;
}

// NOTE (test ordering, mirrors sentry.test.ts): `sentryModule` is private
// module-scope state inside `src/observability/sentry.ts`, lazily set by
// `initMobileSentry()`. These "before any init" cases must run before any
// other test in this file calls `initMobileSentry()`.
describe("getLastSentryEventId / addFeedbackBreadcrumb — before any init", () => {
  it("getLastSentryEventId returns undefined without throwing when Sentry was never initialized (lazy-require no-op path)", () => {
    expect(() => getLastSentryEventId()).not.toThrow();
    expect(getLastSentryEventId()).toBeUndefined();
    expect(mockLastEventId).not.toHaveBeenCalled();
  });

  it("addFeedbackBreadcrumb is a safe no-op before initMobileSentry has ever run", () => {
    expect(() => addFeedbackBreadcrumb("BUG")).not.toThrow();
    expect(mockAddBreadcrumb).not.toHaveBeenCalled();
  });
});

describe("after initMobileSentry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockReturnValue({ sentryDsn: "https://pub@o0.ingest.example/0", gitSha: "abc1234" });
    initMobileSentry();
  });

  it("getLastSentryEventId forwards to the real Sentry.lastEventId()", () => {
    mockLastEventId.mockReturnValue("a".repeat(32));

    expect(getLastSentryEventId()).toBe("a".repeat(32));
  });

  it("getLastSentryEventId returns undefined without throwing if the native call throws", () => {
    mockLastEventId.mockImplementation(() => {
      throw new Error("native binding unavailable");
    });

    expect(() => getLastSentryEventId()).not.toThrow();
    expect(getLastSentryEventId()).toBeUndefined();
  });

  it("addFeedbackBreadcrumb emits a breadcrumb with NO `message` key and only the allowlisted {category, level, data.category} shape", () => {
    addFeedbackBreadcrumb("IDEA");

    const breadcrumb = emittedBreadcrumb();
    expect("message" in breadcrumb).toBe(false);
    expect(breadcrumb).toEqual({ category: "feedback", level: "info", data: { category: "IDEA" } });
    expect(Object.keys(breadcrumb).sort()).toEqual(["category", "data", "level"]);
    expect(Object.keys(breadcrumb.data as object)).toEqual(["category"]);
  });

  it("carries no user content for any of the three feedback categories", () => {
    for (const category of ["BUG", "IDEA", "OTHER"] as const) {
      mockAddBreadcrumb.mockClear();
      addFeedbackBreadcrumb(category);
      const breadcrumb = emittedBreadcrumb();
      expect(JSON.stringify(breadcrumb)).not.toMatch(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/); // no email-shaped content
      expect(breadcrumb.data).toEqual({ category });
    }
  });

  it("the emitted breadcrumb survives the REAL scrubBreadcrumb (packages/analytics) intact — category/data.category preserved, no message key introduced", () => {
    addFeedbackBreadcrumb("OTHER");
    const breadcrumb = emittedBreadcrumb();

    const scrubbed = scrubBreadcrumb(breadcrumb);

    expect(scrubbed).not.toBeNull();
    expect(scrubbed!.category).toBe("feedback");
    expect(scrubbed!.level).toBe("info");
    expect(scrubbed!.data).toEqual({ category: "OTHER" });
    expect("message" in scrubbed!).toBe(false);
  });
});
