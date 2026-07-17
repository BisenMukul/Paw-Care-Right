import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { useReducedMotion } from "../src/hooks/use-reduced-motion";

/**
 * SWEEP-1 plan AC2: the hook is a thin, single-import-point wrapper over
 * reanimated's own `useReducedMotion` (mocked globally in `jest.setup.ts`,
 * default `false`). Mirrors the value both ways.
 */
function Probe() {
  const reduced = useReducedMotion();
  return <Text testID="reduced-motion-probe">{String(reduced)}</Text>;
}

describe("useReducedMotion", () => {
  afterEach(() => {
    jest.requireMock("react-native-reanimated").useReducedMotion.mockReturnValue(false);
  });

  it("mirrors the reanimated hook when false", async () => {
    jest.requireMock("react-native-reanimated").useReducedMotion.mockReturnValue(false);

    await render(<Probe />);

    expect(screen.getByTestId("reduced-motion-probe")).toHaveTextContent("false");
  });

  it("mirrors the reanimated hook when true", async () => {
    jest.requireMock("react-native-reanimated").useReducedMotion.mockReturnValue(true);

    await render(<Probe />);

    expect(screen.getByTestId("reduced-motion-probe")).toHaveTextContent("true");
  });
});
