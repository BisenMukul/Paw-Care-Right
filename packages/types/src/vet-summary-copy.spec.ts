import { VET_SUMMARY_DISCLAIMER, VET_SUMMARY_MAX_CHARS, VET_SUMMARY_STATIC_COPY } from "./vet-summary-copy";

/**
 * Mechanically asserts the T068 plan's constraints on every vet-summary
 * static-copy string (Create list item 2): no "diagnos*" substring (CLAUDE
 * §7 rule 1), no digit+unit dose pattern (CLAUDE §7 rule 2), non-empty, and
 * short enough that the disclaimer always fits inside `VET_SUMMARY_MAX_CHARS`
 * (the builder's truncation algorithm reserves its length up front).
 */
const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
const DOSE_PATTERN = /\d\s*(mg|ml|mcg|g|kg|iu|tablet|tab|capsule|pill)/i;

describe("vet-summary-copy", () => {
  it.each(VET_SUMMARY_STATIC_COPY)("%s: contains no diagnosis-word substring", (copy) => {
    expect(DIAGNOSIS_WORD_PATTERN.test(copy)).toBe(false);
  });

  it.each(VET_SUMMARY_STATIC_COPY)("%s: contains no digit+unit dose pattern", (copy) => {
    expect(DOSE_PATTERN.test(copy)).toBe(false);
  });

  it.each(VET_SUMMARY_STATIC_COPY)("%s: is non-empty", (copy) => {
    expect(copy.length).toBeGreaterThan(0);
  });

  it("VET_SUMMARY_DISCLAIMER is shorter than VET_SUMMARY_MAX_CHARS", () => {
    expect(VET_SUMMARY_DISCLAIMER.length).toBeLessThan(VET_SUMMARY_MAX_CHARS);
  });

  it("VET_SUMMARY_STATIC_COPY is frozen", () => {
    expect(Object.isFrozen(VET_SUMMARY_STATIC_COPY)).toBe(true);
  });
});
