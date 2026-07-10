import { render, screen } from "@testing-library/react-native";

import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { AppTitle } from "../src/components/app-title";

describe("AppTitle", () => {
  it("renders the product display name from the shared constant", async () => {
    // RNTL v14's render is async (React 19 concurrent roots) — must be awaited.
    await render(<AppTitle />);

    expect(screen.getByTestId("app-title")).toBeTruthy();
    expect(screen.getByText(APP_DISPLAY_NAME)).toBeTruthy();
  });
});
