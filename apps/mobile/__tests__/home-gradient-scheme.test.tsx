import { render, screen } from "@testing-library/react-native";
import React from "react";
import * as ReactNative from "react-native";

import { AnimatedGradientBackground } from "../src/components/home/animated-gradient-background";
import { isNativeGradientAvailable } from "../src/components/home/native-gradient";

/**
 * PAWSAATHI-1 plan Risk R3: `className` is not a runtime-flippable
 * mechanism under this workspace's jest setup (see `dual-theme-
 * tokens.test.tsx`'s header comment) -- the ONLY surface this sweep makes
 * genuinely runtime-flippable is the gradient's `colors` prop, chosen via
 * `useColorScheme()`. This is the definitive evidence that the
 * `darkMode:"media"`/Appearance flip actually drives real color selection,
 * not just class-string content.
 */
jest.mock("../src/components/home/native-gradient", () => ({
  isNativeGradientAvailable: jest.fn(),
}));

const mockAvailability = isNativeGradientAvailable as jest.Mock;

const LIGHT_BASE_COLORS = ["#f2f8f6", "#ffffff", "#dcece6"];
const DARK_BASE_COLORS = ["#0c140f", "#0b1712", "#143026"];

describe("AnimatedGradientBackground: useColorScheme drives the LinearGradient colors prop", () => {
  beforeEach(() => {
    mockAvailability.mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("light scheme: the base LinearGradient receives the light color stops", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    const { toJSON } = await render(<AnimatedGradientBackground />);

    const tree = toJSON();
    expect(JSON.stringify(tree)).toContain(JSON.stringify(LIGHT_BASE_COLORS));
    expect(JSON.stringify(tree)).not.toContain(JSON.stringify(DARK_BASE_COLORS));
  });

  it("dark scheme: the base LinearGradient receives the dark color stops", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    const { toJSON } = await render(<AnimatedGradientBackground />);

    const tree = toJSON();
    expect(JSON.stringify(tree)).toContain(JSON.stringify(DARK_BASE_COLORS));
    expect(JSON.stringify(tree)).not.toContain(JSON.stringify(LIGHT_BASE_COLORS));
  });

  it("dark scheme, native gradient unavailable: the solid fallback uses the dark page color", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    mockAvailability.mockReturnValue(false);

    await render(<AnimatedGradientBackground />);

    const fallback = screen.getByTestId("home-gradient-fallback");
    expect(fallback.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#0c140f" })]),
    );
  });

  it("light scheme, native gradient unavailable: the solid fallback keeps the light page color", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    mockAvailability.mockReturnValue(false);

    await render(<AnimatedGradientBackground />);

    const fallback = screen.getByTestId("home-gradient-fallback");
    expect(fallback.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#f2f8f6" })]),
    );
  });
});
