import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { AppErrorBoundary } from "../src/error-boundary";
import { captureError } from "../src/observability/sentry";

// T089 finding F2: this mock is what lets us assert the wiring itself (not
// just the fallback UI) — the checker's CP-F3 probe deleted the
// `captureError` call site in `componentDidCatch` and this suite stayed
// green with no mock/assertion to notice. `jest.mock` here closes that gap.
jest.mock("../src/observability/sentry", () => ({
  captureError: jest.fn(),
}));

function ThrowingChild(): never {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the fallback screen when a child throws during render", async () => {
    // React logs the caught error to the console during render; silence it
    // for this expected-throw test only.
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("App failed to start")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();

    consoleErrorSpy.mockRestore();
  });

  it("renders children normally when nothing throws", async () => {
    await render(
      <AppErrorBoundary>
        <Text>All good</Text>
      </AppErrorBoundary>,
    );

    expect(screen.getByText("All good")).toBeTruthy();
  });

  // T089 finding F2 (plan AC1: "error boundary ... forward to captureError").
  it("forwards the caught error to captureError with a componentStack context", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );

    expect(captureError).toHaveBeenCalledTimes(1);
    const [error, context] = (captureError as jest.Mock).mock.calls[0] as [Error, { componentStack: string }];
    expect(error.message).toBe("boom");
    expect(typeof context.componentStack).toBe("string");

    consoleErrorSpy.mockRestore();
  });
});
