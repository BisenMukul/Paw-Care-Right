import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { ScreenScaffold } from "../src/components/screen-scaffold";

/**
 * SWEEP-1 plan AC3 (design-system.md §2.1): the one screen wrapper. Title/
 * subtitle render with `accessibilityRole="header"`, `gradient` mounts the
 * home-signature `AnimatedGradientBackground` (and omits it otherwise), and
 * `scrollTestID` reaches the underlying `ScrollView`.
 */
describe("ScreenScaffold", () => {
  it("renders title, subtitle, and children", async () => {
    await render(
      <ScreenScaffold title="Care" subtitle="Everything on schedule">
        <Text>child content</Text>
      </ScreenScaffold>,
    );

    const title = screen.getByText("Care");
    expect(title.props.accessibilityRole).toBe("header");
    expect(screen.getByText("Everything on schedule")).toBeTruthy();
    expect(screen.getByText("child content")).toBeTruthy();
  });

  it("omits the header block when no title is supplied", async () => {
    await render(
      <ScreenScaffold>
        <Text>child only</Text>
      </ScreenScaffold>,
    );

    expect(screen.getByText("child only")).toBeTruthy();
  });

  it("mounts the animated gradient background when gradient is true", async () => {
    await render(
      <ScreenScaffold gradient>
        <Text>content</Text>
      </ScreenScaffold>,
    );

    expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
  });

  it("omits the gradient background when gradient is false (default)", async () => {
    await render(
      <ScreenScaffold>
        <Text>content</Text>
      </ScreenScaffold>,
    );

    expect(screen.queryByTestId("home-gradient-background")).toBeNull();
    expect(screen.queryByTestId("home-gradient-fallback")).toBeNull();
  });

  it("applies scrollTestID to the ScrollView", async () => {
    await render(
      <ScreenScaffold scrollTestID="my-scroll">
        <Text>content</Text>
      </ScreenScaffold>,
    );

    expect(screen.getByTestId("my-scroll")).toBeTruthy();
  });

  // Design-system.md §7.4 thumb zone (CRAFT-1 plan): an optional footer slot
  // renders below the scroll; omitting it renders exactly as before (no
  // `screen-scaffold-footer`) — mutation-proof #2 target: removing the
  // wiring must fail this "renders below" assertion.
  it("renders the footer below the scroll when supplied", async () => {
    await render(
      <ScreenScaffold scrollTestID="my-scroll" footer={<Text testID="my-footer-button">Save</Text>}>
        <Text>content</Text>
      </ScreenScaffold>,
    );

    expect(screen.getByTestId("screen-scaffold-footer")).toBeTruthy();
    expect(screen.getByTestId("my-footer-button")).toBeTruthy();
  });

  it("omits the footer region entirely when footer is not supplied", async () => {
    await render(
      <ScreenScaffold scrollTestID="my-scroll">
        <Text>content</Text>
      </ScreenScaffold>,
    );

    expect(screen.queryByTestId("screen-scaffold-footer")).toBeNull();
  });
});
