import { render, screen } from "@testing-library/react-native";

import { SaveConfirmation } from "../src/components/save-confirmation";

/**
 * CRAFT-1 plan "Tests to write" — save-confirmation.test.tsx. The §7.5
 * Peak-End banner: renders `message`, an optional `nudge`, carries
 * `accessibilityRole="alert"`, and has no dismiss control (parent owns
 * lifetime — mutation-proof #1 target: an empty render must fail this AND
 * at least one screen's confirmation test).
 */
describe("SaveConfirmation", () => {
  it("renders the message with an alert role", async () => {
    await render(<SaveConfirmation testID="save-confirmation" message="Weight saved." />);

    const banner = screen.getByTestId("save-confirmation");
    expect(banner.props.accessibilityRole).toBe("alert");
    expect(screen.getByText("Weight saved.")).toBeTruthy();
  });

  it("renders an optional nudge line", async () => {
    await render(<SaveConfirmation testID="save-confirmation" message="Note saved." nudge="It's on the timeline." />);

    expect(screen.getByText("Note saved.")).toBeTruthy();
    expect(screen.getByText("It's on the timeline.")).toBeTruthy();
  });

  it("omits the nudge line when not supplied", async () => {
    await render(<SaveConfirmation testID="save-confirmation" message="Visit saved." />);

    expect(screen.queryByText(/timeline|chart/i)).toBeNull();
  });

  it("renders no dismiss/close control", async () => {
    await render(<SaveConfirmation testID="save-confirmation" message="Weight saved." nudge="It's on the chart." />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
