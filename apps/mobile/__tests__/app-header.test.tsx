import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import { AppHeader } from "../src/components/app-header";
import { ScreenScaffold } from "../src/components/screen-scaffold";
import { strings } from "../src/strings";

/**
 * FOUNDER-UX-3 plan AC1/AC2/AC5: the canon compact header bar -- back
 * chevron + optional title, both themes, 44pt/a11y-compliant back control.
 * Also covers AC3's `ScreenScaffold` `onBack` integration (additive: the
 * no-`onBack` path stays byte-identical, verified here alongside the new
 * branch per the plan's "app-header.test.tsx (or header-sweep.test.tsx)"
 * placement note).
 */
describe("AppHeader", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("[AC1] renders the root bar and the back control", async () => {
    const onBack = jest.fn();
    await render(<AppHeader onBack={onBack} />);

    expect(screen.getByTestId("app-header")).toBeTruthy();
    expect(screen.getByTestId("app-header-back")).toBeTruthy();
  });

  it("[AC1] with a title, renders app-header-title with the header role and display-semibold/brand tokens", async () => {
    await render(<AppHeader title="Family" onBack={jest.fn()} />);

    const titleNode = screen.getByTestId("app-header-title");
    expect(titleNode.props.accessibilityRole).toBe("header");
    expect(titleNode.props.className).toContain("font-display-semibold");
    expect(titleNode.props.className).toContain("text-brand-900");
    expect(titleNode.props.className).toContain("dark:text-ink-dark");
    expect(screen.getByText("Family")).toBeTruthy();
  });

  it("[AC1] without a title, renders no app-header-title node (back-only bar)", async () => {
    await render(<AppHeader onBack={jest.fn()} />);

    expect(screen.queryByTestId("app-header-title")).toBeNull();
  });

  it("[AC2] pressing app-header-back invokes onBack exactly once", async () => {
    const onBack = jest.fn();
    await render(<AppHeader onBack={onBack} />);

    await fireEvent.press(screen.getByTestId("app-header-back"));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("[AC5] the back control is a labeled 44pt button with hitSlop", async () => {
    await render(<AppHeader onBack={jest.fn()} />);

    const back = screen.getByTestId("app-header-back");
    expect(back.props.accessibilityRole).toBe("button");
    expect(back.props.accessibilityLabel).toBe(strings.nav.back);
    expect(back.props.className).toContain("h-11");
    expect(back.props.className).toContain("w-11");
    expect(back.props.hitSlop).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });

  it("both themes: the chevron color follows useColorScheme (light #1f6350, dark #2EA57C)", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");
    const { toJSON: lightJson } = await render(<AppHeader onBack={jest.fn()} />);
    expect(JSON.stringify(lightJson())).toContain("#1f6350");

    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");
    const { toJSON: darkJson } = await render(<AppHeader onBack={jest.fn()} />);
    expect(JSON.stringify(darkJson())).toContain("#2EA57C");
  });

  describe("[AC3] ScreenScaffold onBack integration (additive)", () => {
    it("without onBack: renders byte-identically to before (no app-header, in-scroll title unchanged)", async () => {
      await render(
        <ScreenScaffold title="Care" subtitle="Everything on schedule">
          <ReactNative.Text>child content</ReactNative.Text>
        </ScreenScaffold>,
      );

      expect(screen.queryByTestId("app-header")).toBeNull();
      const title = screen.getByText("Care");
      expect(title.props.accessibilityRole).toBe("header");
      expect(title.props.className).toContain("text-2xl");
      expect(screen.getByText("Everything on schedule")).toBeTruthy();
    });

    it("with onBack: renders app-header with the title, suppresses the in-scroll text-2xl title, keeps the subtitle", async () => {
      const onBack = jest.fn();
      await render(
        <ScreenScaffold title="Care" subtitle="Everything on schedule" onBack={onBack}>
          <ReactNative.Text>child content</ReactNative.Text>
        </ScreenScaffold>,
      );

      expect(screen.getByTestId("app-header")).toBeTruthy();
      expect(screen.getByTestId("app-header-title")).toHaveTextContent("Care");
      // The old in-scroll `text-2xl` title node is gone -- "Care" now
      // renders exactly once, as the header-bar title.
      expect(screen.getAllByText("Care")).toHaveLength(1);
      expect(screen.getByText("Everything on schedule")).toBeTruthy();

      await fireEvent.press(screen.getByTestId("app-header-back"));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("with onBack and no title: back-only bar, subtitle-less content is unaffected", async () => {
      await render(
        <ScreenScaffold onBack={jest.fn()}>
          <ReactNative.Text>child only</ReactNative.Text>
        </ScreenScaffold>,
      );

      expect(screen.getByTestId("app-header")).toBeTruthy();
      expect(screen.queryByTestId("app-header-title")).toBeNull();
      expect(screen.getByText("child only")).toBeTruthy();
    });
  });
});
