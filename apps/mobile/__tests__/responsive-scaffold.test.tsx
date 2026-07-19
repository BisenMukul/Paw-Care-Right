import { render, screen } from "@testing-library/react-native";
import React from "react";
import * as ReactNative from "react-native";
import { Text } from "react-native";

import { ScreenScaffold } from "../src/components/screen-scaffold";

/**
 * RESPONSIVE-1 plan: `ScreenScaffold` wide (>=768dp) centered `max-w-3xl`
 * column on the content container AND the footer region (design-system.md
 * §2.1 + the plan's D6/§7.3 reading-column rule). At `regular` width
 * (jest-default 750, D3) the className stays byte-identical to today
 * (no `max-w-3xl`/`self-center`) -- proven by the existing
 * `screen-scaffold.test.tsx` suite staying green, and reinforced here.
 * SafeArea/KeyboardAvoiding/gradient/footer wiring must survive unchanged
 * in both buckets.
 */
function spyWidth(width: number) {
  return jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
    width,
    height: 1200,
    scale: 2,
    fontScale: 1,
  });
}

describe("ScreenScaffold: wide vs regular layout bucket", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("wide (900): content container gets max-w-3xl and self-center", async () => {
    spyWidth(900);

    await render(
      <ScreenScaffold scrollTestID="my-scroll" title="Care">
        <Text>content</Text>
      </ScreenScaffold>,
    );

    const scroll = screen.getByTestId("my-scroll");
    expect(scroll.props.contentContainerClassName).toContain("max-w-3xl");
    expect(scroll.props.contentContainerClassName).toContain("self-center");
    expect(scroll.props.contentContainerClassName).toContain("gap-6 px-4 pb-8");
  });

  it("regular (390): content container className is byte-identical to the base string", async () => {
    spyWidth(390);

    await render(
      <ScreenScaffold scrollTestID="my-scroll" title="Care">
        <Text>content</Text>
      </ScreenScaffold>,
    );

    const scroll = screen.getByTestId("my-scroll");
    expect(scroll.props.contentContainerClassName).toBe("gap-6 px-4 pb-8");
    expect(scroll.props.contentContainerClassName).not.toContain("max-w-3xl");
    expect(scroll.props.contentContainerClassName).not.toContain("self-center");
  });

  it("wide (900): the footer region is centered with the same max-w-3xl column", async () => {
    spyWidth(900);

    await render(
      <ScreenScaffold scrollTestID="my-scroll" footer={<Text testID="my-footer-button">Save</Text>}>
        <Text>content</Text>
      </ScreenScaffold>,
    );

    const footer = screen.getByTestId("screen-scaffold-footer");
    expect(footer.props.className).toContain("max-w-3xl");
    expect(footer.props.className).toContain("self-center");
    expect(footer.props.className).toContain("border-t");
    expect(screen.getByTestId("my-footer-button")).toBeTruthy();
  });

  it("regular (390): the footer region className stays byte-identical to the base string", async () => {
    spyWidth(390);

    await render(
      <ScreenScaffold scrollTestID="my-scroll" footer={<Text testID="my-footer-button">Save</Text>}>
        <Text>content</Text>
      </ScreenScaffold>,
    );

    const footer = screen.getByTestId("screen-scaffold-footer");
    expect(footer.props.className).toBe(
      "border-t border-brand-100 dark:border-hairline-dark bg-brand-50 dark:bg-surface-page-dark px-4 pb-6 pt-3",
    );
  });

  it("wide: gradient, header role, and children still render (SafeArea/KeyboardAvoiding preserved)", async () => {
    spyWidth(900);

    await render(
      <ScreenScaffold gradient title="Home" scrollTestID="my-scroll" footer={<Text testID="my-footer-button">Save</Text>}>
        <Text>child content</Text>
      </ScreenScaffold>,
    );

    expect(screen.getByTestId("home-gradient-background")).toBeTruthy();
    expect(screen.getByTestId("screen-scaffold-footer")).toBeTruthy();
    expect(screen.getByText("Home").props.accessibilityRole).toBe("header");
    expect(screen.getByText("child content")).toBeTruthy();
  });
});
