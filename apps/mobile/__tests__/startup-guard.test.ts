/**
 * Startup crash trap (founder hotfix): the guard must install a CHAINED
 * global error handler (observe + log, never swallow), tolerate
 * environments without ErrorUtils, and never double-install.
 */

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

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[pawcareright startup] FATAL"), boom);
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
});
