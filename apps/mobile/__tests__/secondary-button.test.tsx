import { fireEvent, render, screen } from "@testing-library/react-native";

import { SecondaryButton } from "../src/components/secondary-button";

/**
 * SWEEP-2 plan (design-system.md §2.9): role/state/label, 44pt min height
 * (`py-3`), loading swaps in an inline `ActivityIndicator`, label caps font
 * scaling at 1.5x.
 */
describe("SecondaryButton", () => {
  it("renders role=button, disabled state, the brand-700 outline, and fires onPress", async () => {
    const onPress = jest.fn();
    await render(<SecondaryButton testID="my-secondary" label="Continue with Apple" onPress={onPress} />);

    const button = screen.getByTestId("my-secondary");
    expect(button.props.accessibilityRole).toBe("button");
    expect(button.props.accessibilityState).toEqual({ disabled: false });
    expect(button.props.className).toContain("border-brand-700");
    expect(button.props.className).toContain("py-3");

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    const label = screen.getByText("Continue with Apple");
    expect(label.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it("shows an inline spinner and disables the button when loading", async () => {
    await render(<SecondaryButton testID="my-secondary" label="Continue with Apple" onPress={jest.fn()} loading />);

    expect(screen.getByTestId("my-secondary-spinner")).toBeTruthy();
    expect(screen.queryByText("Continue with Apple")).toBeNull();
    expect(screen.getByTestId("my-secondary").props.accessibilityState).toEqual({ disabled: true });
  });
});
