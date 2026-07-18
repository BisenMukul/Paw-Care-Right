import { render } from "@testing-library/react-native";
import * as ReactNative from "react-native";

import TabsLayout from "../app/(tabs)/_layout";

/**
 * PAWSAATHI-4 plan decision 6/R5: react-navigation's `tabBarActiveTintColor`/
 * `tabBarInactiveTintColor`/`tabBarStyle` are runtime native props, not
 * `className` -- they never respond to a `dark:` class, so the scheme-aware
 * pair is asserted by capturing the actual `screenOptions` object passed to
 * `Tabs`, mirroring `home-gradient-scheme.test.tsx`'s `jest.spyOn(ReactNative,
 * "useColorScheme")` idiom. `expo-router`'s `Tabs` is replaced with a minimal
 * host-element stand-in that renders `screenOptions` as an inspectable prop
 * (this suite is presentation-only; it never asserts on navigation itself).
 */
let capturedScreenOptions: Record<string, unknown> | undefined;

jest.mock("expo-router", () => {
  function Tabs(props: { screenOptions?: Record<string, unknown>; children?: unknown }) {
    capturedScreenOptions = props.screenOptions;
    return null;
  }
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});

describe("tab bar: scheme-aware native tint/style (decision 6)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    capturedScreenOptions = undefined;
  });

  it("light scheme: byte-identical light tints, no dark tabBarStyle", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("light");

    await render(<TabsLayout />);

    expect(capturedScreenOptions?.tabBarActiveTintColor).toBe("#1f6350");
    expect(capturedScreenOptions?.tabBarInactiveTintColor).toBe("#9ca3af");
    expect(capturedScreenOptions?.tabBarStyle).toBeUndefined();
  });

  it("dark scheme: dark-verified tints + dark tabBarStyle bg/border", async () => {
    jest.spyOn(ReactNative, "useColorScheme").mockReturnValue("dark");

    await render(<TabsLayout />);

    expect(capturedScreenOptions?.tabBarActiveTintColor).toBe("#2EA57C");
    expect(capturedScreenOptions?.tabBarInactiveTintColor).toBe("#9AA8A1");
    expect(capturedScreenOptions?.tabBarStyle).toEqual({
      backgroundColor: "#16241F",
      borderTopColor: "#22392F",
    });
  });
});
