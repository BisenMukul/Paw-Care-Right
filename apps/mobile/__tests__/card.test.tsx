import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { Card } from "../src/components/card";

/**
 * SWEEP-1 plan AC3 (design-system.md §2.2): static variant renders the
 * canonical surface classes; pressable variant (`onPress`) exposes
 * `accessibilityRole="button"` and fires `onPress`; `testID` forwards
 * either way.
 */
describe("Card", () => {
  it("static variant renders children with the canonical surface classes", async () => {
    await render(
      <Card testID="my-card">
        <Text>content</Text>
      </Card>,
    );

    const card = screen.getByTestId("my-card");
    expect(card.props.className).toContain("rounded-2xl");
    expect(card.props.className).toContain("bg-white");
    expect(card.props.className).toContain("p-4");
    expect(card.props.className).toContain("shadow-md");
    expect(screen.getByText("content")).toBeTruthy();
  });

  it("pressable variant exposes accessibilityRole=button and fires onPress", async () => {
    const onPress = jest.fn();
    await render(
      <Card testID="pressable-card" onPress={onPress}>
        <Text>content</Text>
      </Card>,
    );

    const card = screen.getByTestId("pressable-card");
    expect(card.props.accessibilityRole).toBe("button");

    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
