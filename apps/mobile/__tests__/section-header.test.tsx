import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { SectionHeader } from "../src/components/section-header";

/**
 * SWEEP-1 plan AC3 (design-system.md §2.3): title carries
 * `accessibilityRole="header"`; when an action is supplied it is a
 * `Pressable` with non-empty `hitSlop` that fires `onAction`.
 */
describe("SectionHeader", () => {
  it("renders the title with accessibilityRole=header", async () => {
    await render(<SectionHeader title="Quick actions" />);

    const title = screen.getByText("Quick actions");
    expect(title.props.accessibilityRole).toBe("header");
  });

  it("renders no action when actionLabel/onAction are omitted", async () => {
    await render(<SectionHeader title="Quick actions" />);

    expect(screen.queryByText("See all")).toBeNull();
  });

  it("action is a Pressable with hitSlop that fires onAction", async () => {
    const onAction = jest.fn();
    await render(
      <SectionHeader
        title="Today"
        actionLabel="See all"
        onAction={onAction}
        actionTestID="section-header-action"
      />,
    );

    const action = screen.getByTestId("section-header-action");
    expect(action.props.accessibilityRole).toBe("button");
    expect(action.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });

    await fireEvent.press(action);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
