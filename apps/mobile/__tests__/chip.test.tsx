import { fireEvent, render, screen } from "@testing-library/react-native";

import { Chip } from "../src/components/chip";

/**
 * SWEEP-4 plan (design-system.md §2.5): a single `Pressable` bearing the
 * forwarded `testID`, `accessibilityRole="button"`,
 * `accessibilityState.selected`, and a className that includes the
 * `min-h-[44px]` touch-target contract on top of the §2.5 fills (Risk R2 --
 * `touch-targets.test.tsx` depends on this exact shape). Label caps font
 * scaling at 1.5x (fixed chrome, not body copy).
 */
describe("Chip", () => {
  it("unselected: renders role=button, selected=false, min-h-[44px] + unselected fills, fires onPress", async () => {
    const onPress = jest.fn();
    await render(<Chip testID="my-chip" label="All" selected={false} onPress={onPress} />);

    const chip = screen.getByTestId("my-chip");
    expect(chip.props.accessibilityRole).toBe("button");
    expect(chip.props.accessibilityState).toEqual({ selected: false });
    expect(chip.props.className).toContain("min-h-[44px]");
    expect(chip.props.className).toContain("rounded-full");
    expect(chip.props.className).toContain("border-brand-100");
    expect(chip.props.className).toContain("bg-white");

    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);

    const label = screen.getByText("All");
    expect(label.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it("selected: min-h-[44px] + selected fills, accessibilityState.selected=true", async () => {
    await render(<Chip testID="my-chip" label="Dogs" selected onPress={jest.fn()} />);

    const chip = screen.getByTestId("my-chip");
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    expect(chip.props.className).toContain("min-h-[44px]");
    expect(chip.props.className).toContain("bg-brand-700");

    const label = screen.getByText("Dogs");
    expect(label.props.className).toContain("text-white");
  });

  it("forwards accessibilityLabel when supplied", async () => {
    await render(
      <Chip testID="my-chip" label="Dogs" selected={false} onPress={jest.fn()} accessibilityLabel="Filter: Dogs" />,
    );

    expect(screen.getByTestId("my-chip").props.accessibilityLabel).toBe("Filter: Dogs");
  });
});
