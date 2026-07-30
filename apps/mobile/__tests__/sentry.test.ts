// T089 — mobile Sentry wiring. `@sentry/react-native` is a native module,
// so this file mocks it directly (a local `jest.mock` factory, not the
// module's own `__mocks__` auto-mock — verified sufficient before adding
// anything under `apps/mobile/__mocks__/`).
const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockSetTag = jest.fn();
const mockWithScope = jest.fn((callback: (scope: { setContext: jest.Mock }) => void) => {
  callback({ setContext: jest.fn() });
});

jest.mock("@sentry/react-native", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  withScope: mockWithScope,
  setTag: mockSetTag,
}));

jest.mock("../src/config", () => ({
  getConfig: jest.fn(),
  getAppVersion: jest.fn(() => "1.2.3"),
}));

// T117: `sentry.ts` now reads `readOtaInfo()` for both the release's
// `+{updateId}` slot and the boot tags. Defaults to the all-absent shape
// (mirrors the real `readOtaInfo`'s fallback) so pre-existing tests that
// never touch OTA state keep behaving exactly as before; individual tests
// below override with `mockReturnValueOnce`.
const mockReadOtaInfo = jest.fn(() => ({
  isEnabled: false,
  updateId: null as string | null,
  channel: null as string | null,
  runtimeVersion: null as string | null,
  isEmbeddedLaunch: true,
}));

jest.mock("../src/observability/ota-info", () => ({
  readOtaInfo: () => mockReadOtaInfo(),
}));

import { scrubSentryEvent } from "@bombaypetcompany/analytics";

import { getConfig } from "../src/config";
import { captureError, currentSentryRelease, initMobileSentry } from "../src/observability/sentry";

const mockGetConfig = getConfig as jest.Mock;

// NOTE (test ordering): `sentryModule` is private module-scope state inside
// `src/observability/sentry.ts` (D5 — lazily set by `initMobileSentry`).
// This first test asserts the true "never initialized" starting state, so
// it MUST run before any other test in this file calls `initMobileSentry`
// with a non-empty DSN. Jest runs tests within a file in declaration order
// by default (no `--randomize` configured), so this ordering is stable.
describe("captureError — before any init", () => {
  it("is a safe no-op before initMobileSentry has ever run", () => {
    expect(() => captureError(new Error("boom"))).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
    expect(mockWithScope).not.toHaveBeenCalled();
  });
});

describe("initMobileSentry", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("never touches the native module when the DSN is empty (stub-safe by default)", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "", gitSha: "dev" });

    initMobileSentry();

    expect(mockInit).not.toHaveBeenCalled();
  });

  it("init receives a release built from the app version + git sha and the shared scrubber as beforeSend", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "https://pub@o0.ingest.example/0", gitSha: "abc1234" });

    initMobileSentry();

    expect(mockInit).toHaveBeenCalledTimes(1);
    const options = mockInit.mock.calls[0][0] as {
      dsn: string;
      release: string;
      sendDefaultPii: boolean;
      tracesSampleRate: number;
      beforeSend: (event: unknown) => unknown;
    };
    expect(options.dsn).toBe("https://pub@o0.ingest.example/0");
    expect(options.release).toBe("bombaypetcompany@1.2.3+abc1234");
    expect(options.sendDefaultPii).toBe(false);
    expect(options.tracesSampleRate).toBe(0);

    // The adapter-cast beforeSend must delegate to the shared scrubber, not
    // reimplement or bypass it.
    const marker = { message: "contact owner@example.com" };
    expect(options.beforeSend(marker)).toEqual(scrubSentryEvent(marker));
  });
});

describe("captureError — after init", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("forwards to Sentry.captureException once initialized", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "https://pub@o0.ingest.example/0", gitSha: "abc1234" });
    initMobileSentry();

    const error = new Error("boom");
    captureError(error, { componentStack: "at X" });

    expect(mockWithScope).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error);
  });
});

// T117 D1/step 4: `currentSentryRelease()` is the single function both this
// file's `initMobileSentry` and `apps/mobile/app/feedback.tsx` read.
describe("currentSentryRelease", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("uses the OTA updateId when present", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "", gitSha: "abc1234" });
    mockReadOtaInfo.mockReturnValueOnce({
      isEnabled: true,
      updateId: "update-xyz",
      channel: "production",
      runtimeVersion: "1.0.0",
      isEmbeddedLaunch: false,
    });

    expect(currentSentryRelease()).toBe("bombaypetcompany@1.2.3+update-xyz");
  });

  it("falls back to gitSha when updateId is null", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "", gitSha: "abc1234" });
    mockReadOtaInfo.mockReturnValueOnce({
      isEnabled: false,
      updateId: null,
      channel: null,
      runtimeVersion: null,
      isEmbeddedLaunch: true,
    });

    expect(currentSentryRelease()).toBe("bombaypetcompany@1.2.3+abc1234");
  });
});

describe("initMobileSentry — boot tags (T117 step 2)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("sets updateId/channel/runtimeVersion/isEmbeddedLaunch tags at boot", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "https://pub@o0.ingest.example/0", gitSha: "abc1234" });
    mockReadOtaInfo.mockReturnValue({
      isEnabled: true,
      updateId: "update-xyz",
      channel: "production",
      runtimeVersion: "1.0.0",
      isEmbeddedLaunch: false,
    });

    initMobileSentry();

    expect(mockSetTag).toHaveBeenCalledWith("updateId", "update-xyz");
    expect(mockSetTag).toHaveBeenCalledWith("channel", "production");
    expect(mockSetTag).toHaveBeenCalledWith("runtimeVersion", "1.0.0");
    expect(mockSetTag).toHaveBeenCalledWith("isEmbeddedLaunch", "false");
  });

  it("falls back to embedded/unknown tag values when OTA info is all-absent", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "https://pub@o0.ingest.example/0", gitSha: "abc1234" });
    mockReadOtaInfo.mockReturnValue({
      isEnabled: false,
      updateId: null,
      channel: null,
      runtimeVersion: null,
      isEmbeddedLaunch: true,
    });

    initMobileSentry();

    expect(mockSetTag).toHaveBeenCalledWith("updateId", "embedded");
    expect(mockSetTag).toHaveBeenCalledWith("channel", "unknown");
    expect(mockSetTag).toHaveBeenCalledWith("runtimeVersion", "unknown");
    expect(mockSetTag).toHaveBeenCalledWith("isEmbeddedLaunch", "true");
  });

  it("sets no tag when the DSN is empty (stub-safe path never inits)", () => {
    mockGetConfig.mockReturnValue({ sentryDsn: "", gitSha: "abc1234" });

    initMobileSentry();

    expect(mockSetTag).not.toHaveBeenCalled();
  });
});
