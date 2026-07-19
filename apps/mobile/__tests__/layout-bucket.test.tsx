import { render, screen } from "@testing-library/react-native";
import React from "react";
import * as ReactNative from "react-native";
import { Text } from "react-native";

import {
  bucketForWidth,
  LAYOUT_COMPACT_MAX,
  LAYOUT_WIDE_MIN,
  useLayoutBucket,
} from "../src/hooks/use-layout-bucket";

/**
 * RESPONSIVE-1 plan D1/D2/D3: boundary tests for the pure `bucketForWidth`,
 * spy tests for `useLayoutBucket` (mirroring `home-gradient-scheme.test.tsx`'s
 * `jest.spyOn(ReactNative, "useWindowDimensions")` pattern), and the
 * 750->`regular` guard that pins the frozen-snapshot invariant (R1).
 */
function Probe() {
  const bucket = useLayoutBucket();
  return <Text testID="layout-bucket-probe">{bucket}</Text>;
}

describe("bucketForWidth (pure boundaries)", () => {
  it("compact: below LAYOUT_COMPACT_MAX (320, 359)", () => {
    expect(bucketForWidth(320)).toBe("compact");
    expect(bucketForWidth(LAYOUT_COMPACT_MAX - 1)).toBe("compact");
  });

  it("regular: 360 through 767 inclusive (incl. jest-default 750)", () => {
    expect(bucketForWidth(LAYOUT_COMPACT_MAX)).toBe("regular");
    expect(bucketForWidth(390)).toBe("regular");
    expect(bucketForWidth(750)).toBe("regular");
    expect(bucketForWidth(LAYOUT_WIDE_MIN - 1)).toBe("regular");
  });

  it("wide: 768 and above (tablets & large-landscape)", () => {
    expect(bucketForWidth(LAYOUT_WIDE_MIN)).toBe("wide");
    expect(bucketForWidth(834)).toBe("wide");
    expect(bucketForWidth(1024)).toBe("wide");
  });
});

describe("useLayoutBucket (spy on useWindowDimensions)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("compact at 320", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 320,
      height: 640,
      scale: 2,
      fontScale: 1,
    });

    await render(<Probe />);

    expect(screen.getByTestId("layout-bucket-probe")).toHaveTextContent("compact");
  });

  it("regular at 390", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1,
    });

    await render(<Probe />);

    expect(screen.getByTestId("layout-bucket-probe")).toHaveTextContent("regular");
  });

  it("wide at 900", async () => {
    jest.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 900,
      height: 1200,
      scale: 2,
      fontScale: 1,
    });

    await render(<Probe />);

    expect(screen.getByTestId("layout-bucket-probe")).toHaveTextContent("wide");
  });

  // R1 guard: with NO spy, jest's default window width (750, from
  // @react-native/jest-preset's DeviceInfo mock) resolves to "regular" --
  // this is the invariant the whole no-re-record/no-snapshot-edit guarantee
  // rests on. If a future threshold change breaks this, the four pinned
  // snapshots would churn -- this test pins it so that can't happen silently.
  it("guard: with no spy, the jest-default width (750) resolves to regular", async () => {
    await render(<Probe />);

    expect(screen.getByTestId("layout-bucket-probe")).toHaveTextContent("regular");
  });
});
