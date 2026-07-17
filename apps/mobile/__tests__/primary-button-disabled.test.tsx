import { render, screen } from "@testing-library/react-native";
import React from "react";

import { PrimaryButton } from "../src/components/primary-button";

/**
 * SWEEP-1 plan AC1: regression pin for the phantom `brand-300` token
 * (design-system.md §1.1's "known defect"). Before the preset extension,
 * Tailwind silently dropped `bg-brand-300` and the disabled button rendered
 * transparent; now the shade is real.
 *
 * This test pins the COMPONENT half of the contract (it still requests
 * `bg-brand-300` for its disabled state) -- it cannot itself prove the
 * shade resolves to a real color, because NativeWind's CSS pipeline is
 * stubbed under this workspace's jest setup (`\.css$` -> `jest.css-
 * stub.js`, confirmed by every existing snapshot showing `className`
 * passed through as a literal, unresolved prop) and apps/mobile carries no
 * `@types/node` (adding it purely for a test would be a new,
 * unjustified dependency, CLAUDE.md §2.7). The PRESET half of the contract
 * -- that `brand-300` is actually defined with a real hex, not phantom --
 * is pinned by `packages/config/src/tailwind-preset.spec.ts`, which reads
 * the preset file directly and fails if the shade is removed.
 */
describe("PrimaryButton disabled state (phantom-token regression)", () => {
  it("renders className containing bg-brand-300 when disabled", async () => {
    await render(
      <PrimaryButton testID="my-button" label="Save" onPress={() => undefined} disabled />,
    );

    const button = screen.getByTestId("my-button");
    expect(button.props.className).toContain("bg-brand-300");
  });
});
