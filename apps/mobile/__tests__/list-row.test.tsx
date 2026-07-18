import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { ListRow } from "../src/components/list-row";

/**
 * SWEEP-4 plan (design-system.md §2.6): a `Pressable` (role="button" +
 * `accessibilityState.disabled` + pressed feedback) when `onPress` is
 * supplied, else a plain `View`; optional leading icon tile; a
 * title/subtitle middle column; trailing = the caller's node, else a
 * chevron when `showChevron` (default true).
 */
describe("ListRow", () => {
  it("pressable row: role=button, min-h-[56px], fires onPress, shows a default trailing chevron", async () => {
    const onPress = jest.fn();
    await render(<ListRow testID="my-row" title="Family" leadingIcon="people-outline" onPress={onPress} />);

    const row = screen.getByTestId("my-row");
    expect(row.props.accessibilityRole).toBe("button");
    expect(row.props.accessibilityState).toEqual({ disabled: false });
    expect(row.props.className).toContain("min-h-[56px]");

    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);

    expect(screen.getByText("Family")).toBeTruthy();
  });

  it("static row (no onPress): renders a View, no accessibilityRole, no chevron pressable semantics", async () => {
    await render(<ListRow testID="my-row" title="Info only" />);

    const row = screen.getByTestId("my-row");
    expect(row.props.accessibilityRole).toBeUndefined();
    expect(row.props.onPress).toBeUndefined();
  });

  it("renders a subtitle when supplied", async () => {
    await render(<ListRow testID="my-row" title="Family" subtitle="Manage your household" />);

    expect(screen.getByText("Manage your household")).toBeTruthy();
  });

  it("disabled reflects in accessibilityState when onPress is supplied", async () => {
    await render(<ListRow testID="my-row" title="Restore" onPress={jest.fn()} disabled />);

    expect(screen.getByTestId("my-row").props.accessibilityState).toEqual({ disabled: true });
  });

  it("a custom trailing node overrides the default chevron", async () => {
    await render(
      <ListRow testID="my-row" title="Analytics" trailing={<Text testID="my-trailing">on</Text>} />,
    );

    expect(screen.getByTestId("my-trailing")).toBeTruthy();
  });

  it("showChevron=false renders no trailing chevron when no custom trailing is given", async () => {
    const view = await render(
      <ListRow testID="my-row" title="No chevron" onPress={jest.fn()} showChevron={false} />,
    );

    expect(JSON.stringify(view.toJSON())).not.toContain("chevron-forward-outline");
  });
});
