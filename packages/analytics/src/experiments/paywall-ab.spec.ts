import { PAYWALL_VARIANTS } from "@bombaypetcompany/types";

import { PAYWALL_EXPERIMENT_ARMS, PAYWALL_EXPERIMENT_KEY, PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM } from "./paywall-ab";

/**
 * T107 plan step 5 — pins the experiment's machine identifiers so they can
 * never silently drift: the key string, the arm list (no invented third
 * arm), and the min-sample constant recomputed from its own stated formula
 * (D4) so the number can never be hand-edited out of sync with its
 * derivation.
 */
describe("paywall-ab experiment constants (T107 D2/D4)", () => {
  it("the experiment key is exactly 'paywall_copy_ab'", () => {
    expect(PAYWALL_EXPERIMENT_KEY).toBe("paywall_copy_ab");
  });

  it("the arms are exactly PAYWALL_VARIANTS -- no invented third arm", () => {
    expect(PAYWALL_EXPERIMENT_ARMS).toEqual(PAYWALL_VARIANTS);
    expect(PAYWALL_EXPERIMENT_ARMS.length).toBe(2);
  });

  it("the min sample per arm is 900 and matches its own recomputed formula", () => {
    expect(PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM).toBe(900);
    expect(PAYWALL_EXPERIMENT_MIN_SAMPLE_PER_ARM).toBe(Math.round((16 * 0.1 * 0.9) / 0.04 ** 2));
  });
});
