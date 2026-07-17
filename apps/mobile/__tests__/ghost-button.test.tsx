import { fireEvent, render, screen } from "@testing-library/react-native";

import { GhostButton } from "../src/components/ghost-button";

/**
 * SWEEP-2 plan (design-system.md §2.9): role/state/label/hitSlop for
 * "Skip"/"Not now"/tertiary row actions; label caps font scaling at 1.5x.
 */
describe("GhostButton", () => {
  it("renders role=button, disabled state, a >=44pt hitSlop, and fires onPress", async () => {
    const onPress = jest.fn();
    await render(<GhostButton testID="my-ghost" label="Skip" onPress={onPress} />);

    const button = screen.getByTestId("my-ghost");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual({ disabled: false });
    expect(button.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    const label = screen.getByText("Skip");
    expect(label.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it("reflects disabled in accessibilityState when disabled is true", async () => {
    await render(<GhostButton testID="my-ghost" label="Skip" onPress={jest.fn()} disabled />);

    expect(screen.getByTestId("my-ghost").props.accessibilityState).toEqual({ disabled: true });
  });
});
