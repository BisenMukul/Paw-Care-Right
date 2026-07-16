import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";

import { AppErrorBoundary } from "../src/error-boundary";

function ThrowingChild(): never {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
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
});
