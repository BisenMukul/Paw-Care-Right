import { render, screen } from "@testing-library/react-native";
import React from "react";

import { AnimatedGradientBackground } from "../src/components/home/animated-gradient-background";
import { isNativeGradientAvailable } from "../src/components/home/native-gradient";

/**
 * Founder-hotfix regression pin: a dev client built WITHOUT the
 * expo-linear-gradient native module must get the solid fallback (the
 * native view would crash Fabric); a build WITH it gets the animated
 * gradient. Availability is probed via `native-gradient.ts`, mocked here
 * both ways.
 */

jest.mock("../src/components/home/native-gradient", () => ({
  isNativeGradientAvailable: jest.fn(),
}));

const mockAvailability = isNativeGradientAvailable as jest.Mock;

describe("AnimatedGradientBackground native availability", () => {
  it("renders the animated gradient when the native module exists", async () => {
    mockAvailability.mockReturnValue(true);
    await render(<AnimatedGradientBackground />);

    expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
    expect(screen.queryByTestId("home-gradient-fallback")).toBeNull();
  });

  it("renders the solid fallback (no native view mounted) when the module is absent", async () => {
    mockAvailability.mockReturnValue(false);
    await render(<AnimatedGradientBackground />);

    expect(screen.getByTestId("home-gradient-fallback")).toBeTruthy();
    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
  });
});
