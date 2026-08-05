/**
 * Startup crash trap (founder hotfix): the guard must install a CHAINED
 * global error handler (observe + log, never swallow), tolerate
 * environments without ErrorUtils, and never double-install.
 */

// T089 finding F2: this mock is what lets us assert the wiring itself — the
// checker's CP-F3 probe deleted the `captureError` forward in the global
// handler and this suite stayed green with no mock/assertion to notice.
jest.mock("../src/observability/sentry", () => ({
  captureError: jest.fn(),
}));

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;

interface FakeErrorUtils {
  getGlobalHandler(): GlobalHandler | undefined;
  setGlobalHandler(handler: GlobalHandler): void;
}

function makeFakeErrorUtils(previous: GlobalHandler): FakeErrorUtils & { current: GlobalHandler; setCalls: number } {
  const holder = {
    current: previous,
    setCalls: 0,
    getGlobalHandler() {
      return holder.current;
    },
    setGlobalHandler(handler: GlobalHandler) {
      holder.setCalls += 1;
      holder.current = handler;
    },
  };
  return holder;
}

describe("startup guard", () => {
  const realErrorUtils = (globalThis as { ErrorUtils?: unknown }).ErrorUtils;

  afterEach(() => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = realErrorUtils;
    jest.resetModules();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("logs the fatal error AND chains the previous handler", () => {
    const previous = jest.fn();
    const fake = makeFakeErrorUtils(previous);
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = fake;
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: isolateModules needs a synchronous require to re-evaluate the guard's import side effect
      require("../src/startup-guard");
    });

    const boom = new Error("boom-at-startup");
    fake.current(boom, true);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[bombaypetcompany startup] FATAL"), boom);
    expect(previous).toHaveBeenCalledWith(boom, true);
  });

  it("does not throw when ErrorUtils is absent (bare node)", () => {
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = undefined;

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: isolateModules needs a synchronous require to re-evaluate the guard's import side effect
        require("../src/startup-guard");
      });
    }).not.toThrow();
  });

  it("never double-installs (idempotent across repeat calls)", () => {
    const fake = makeFakeErrorUtils(jest.fn());
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = fake;
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: isolateModules needs a synchronous require to re-evaluate the guard's import side effect
      const guard = require("../src/startup-guard") as typeof import("../src/startup-guard");
      guard.installStartupGuard();
      guard.installStartupGuard();
    });

    expect(fake.setCalls).toBe(1);
  });

  // T089 finding F2 (plan AC1: "startup guard ... forward to captureError").
  // `jest.isolateModules` gives `startup-guard.ts` a FRESH module registry,
  // so its internal `require("./observability/sentry")` resolves to a NEW
  // mock-factory invocation, distinct from the `captureError` imported at
  // the top of this file — the sentry module is therefore also required
  // INSIDE the same isolated block, capturing the exact mock instance
  // `startup-guard.ts` actually wired to.
  it("forwards the trapped error to captureError before chaining the previous handler", () => {
    const previous = jest.fn();
    const fake = makeFakeErrorUtils(previous);
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = fake;
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    let sentryModule!: typeof import("../src/observability/sentry");
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: isolateModules needs a synchronous require to capture the exact captureError mock instance this registry wired to
      sentryModule = require("../src/observability/sentry") as typeof import("../src/observability/sentry");
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- JUSTIFIED: isolateModules needs a synchronous require to re-evaluate the guard's import side effect
      require("../src/startup-guard");
    });

    const boom = new Error("boom-at-startup");
    fake.current(boom, true);

    expect(sentryModule.captureError).toHaveBeenCalledWith(boom, { isFatal: true });
  });
});
