// T089 — mobile Sentry wiring. `@sentry/react-native` is a native module,
// so this file mocks it directly (a local `jest.mock` factory, not the
// module's own `__mocks__` auto-mock — verified sufficient before adding
// anything under `apps/mobile/__mocks__/`).
const mockInit = jest.fn();
const mockCaptureException = jest.fn();
const mockWithScope = jest.fn((callback: (scope: { setContext: jest.Mock }) => void) => {
  callback({ setContext: jest.fn() });
});

jest.mock("@sentry/react-native", () => ({
  init: mockInit,
  captureException: mockCaptureException,
  withScope: mockWithScope,
}));

jest.mock("../src/config", () => ({
  getConfig: jest.fn(),
  getAppVersion: jest.fn(() => "1.2.3"),
}));

import { scrubSentryEvent } from "@bombaypetcompany/analytics";

import { getConfig } from "../src/config";
import { captureError, initMobileSentry } from "../src/observability/sentry";

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
