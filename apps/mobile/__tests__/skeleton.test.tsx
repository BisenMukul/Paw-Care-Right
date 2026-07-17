import { render, screen } from "@testing-library/react-native";
import React from "react";

import { Skeleton } from "../src/components/skeleton";

/**
 * SWEEP-1 plan AC3 (design-system.md §2.11): `lines` `bg-brand-100` bones
 * always render (content-shaped placeholder), in BOTH reduced-motion
 * states. Reduced ⇒ the repeating pulse never starts (`withRepeat` is not
 * invoked); the bone renders a static opacity instead of the animated
 * style.
 */
describe("Skeleton", () => {
  const reanimatedMock = jest.requireMock<{
    useReducedMotion: jest.Mock;
    withRepeat: (...args: unknown[]) => unknown;
  }>("react-native-reanimated");

  afterEach(() => {
    reanimatedMock.useReducedMotion.mockReturnValue(false);
    jest.restoreAllMocks();
  });

  it("renders the requested number of bg-brand-100 bones (not reduced)", async () => {
    reanimatedMock.useReducedMotion.mockReturnValue(false);

    await render(<Skeleton testID="my-skeleton" lines={4} />);

    for (let index = 0; index < 4; index += 1) {
      const bone = screen.getByTestId(`my-skeleton-bone-${index}`);
      expect(bone.props.className).toContain("bg-brand-100");
    }
  });

  it("renders the requested number of bg-brand-100 bones (reduced)", async () => {
    reanimatedMock.useReducedMotion.mockReturnValue(true);

    await render(<Skeleton testID="my-skeleton" lines={4} />);

    for (let index = 0; index < 4; index += 1) {
      const bone = screen.getByTestId(`my-skeleton-bone-${index}`);
      expect(bone.props.className).toContain("bg-brand-100");
    }
  });

  it("defaults to 3 lines, the last one narrower", async () => {
    reanimatedMock.useReducedMotion.mockReturnValue(false);

    await render(<Skeleton testID="my-skeleton" />);

    expect(screen.getByTestId("my-skeleton-bone-0")).toBeTruthy();
    expect(screen.getByTestId("my-skeleton-bone-1")).toBeTruthy();
    const lastBone = screen.getByTestId("my-skeleton-bone-2");
    expect(lastBone.props.className).toContain("w-2/3");
    expect(screen.queryByTestId("my-skeleton-bone-3")).toBeNull();
  });

  it("reduced: renders a static opacity and never starts the repeating pulse", async () => {
    reanimatedMock.useReducedMotion.mockReturnValue(true);
    const withRepeatSpy = jest.spyOn(reanimatedMock, "withRepeat");

    await render(<Skeleton testID="my-skeleton" lines={2} />);

    expect(withRepeatSpy).not.toHaveBeenCalled();
    const bone = screen.getByTestId("my-skeleton-bone-0");
    expect(bone.props.style).toEqual({ opacity: 0.6 });
  });

  it("not reduced: starts the repeating pulse", async () => {
    reanimatedMock.useReducedMotion.mockReturnValue(false);
    const withRepeatSpy = jest.spyOn(reanimatedMock, "withRepeat");

    await render(<Skeleton testID="my-skeleton" lines={2} />);

    expect(withRepeatSpy).toHaveBeenCalledTimes(1);
  });
});
