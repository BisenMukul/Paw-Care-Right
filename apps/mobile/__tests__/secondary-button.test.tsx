import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

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

  /**
   * PAWSAATHI-2 follow-up 1: the spinner/icon `color` prop is a native
   * value (not a `className`), so it must be computed scheme-aware at the
   * call site (design-system.md §1.6). Light/null both resolve to the
   * pre-existing `#1f6350`; dark resolves to `#2EA57C` (accent-bright,
   * matching the label's `dark:text-accent-bright` and clearing the 3:1 UI
   * floor -- brand-700 on `surface-card-dark` measures only 2.27:1).
   */
  describe("scheme-aware spinner/icon color", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("dark scheme: spinner and icon use #2EA57C", async () => {
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

      const spinnerScreen = await render(
        <SecondaryButton testID="my-secondary" label="Continue with Apple" onPress={jest.fn()} loading />,
      );
      expect(spinnerScreen.getByTestId("my-secondary-spinner").props.color).toBe("#2EA57C");

      const iconScreen = await render(
        <SecondaryButton testID="my-secondary-icon" label="Continue with Apple" onPress={jest.fn()} icon="paw" />,
      );
      expect(JSON.stringify(iconScreen.toJSON())).toContain('"color":"#2EA57C"');
    });

    it.each(["light", null] as const)("%s scheme: spinner and icon use #1f6350", async (scheme) => {
      // `useColorScheme()`'s real return type is `null | undefined |
      // ColorSchemeName` (react-native's own `useColorScheme.d.ts`), but the
      // barrel-exported type `jest.spyOn` infers here is narrower
      // (`ColorSchemeName`, non-nullable) -- this mirrors the
      // `home-gradient-scheme.test.tsx` precedent's runtime-accurate "light"
      // case plus this file's own "null" (no OS preference yet) case.
      jest.spyOn(ReactNative, "useColorScheme").mockReturnValue(scheme as unknown as ReactNative.ColorSchemeName);

      const spinnerScreen = await render(
        <SecondaryButton testID="my-secondary" label="Continue with Apple" onPress={jest.fn()} loading />,
      );
      expect(spinnerScreen.getByTestId("my-secondary-spinner").props.color).toBe("#1f6350");

      const iconScreen = await render(
        <SecondaryButton testID="my-secondary-icon" label="Continue with Apple" onPress={jest.fn()} icon="paw" />,
      );
      expect(JSON.stringify(iconScreen.toJSON())).toContain('"color":"#1f6350"');
    });
  });
});
