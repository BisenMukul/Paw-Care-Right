import { vetDisclaimerLine } from "./vet-disclaimer-copy";

/**
 * T097 plan step 3 — byte-pin + §7 property tests for the vet-disclaimer
 * SSOT. If this spec ever fails, the fix is to the COPY (or a genuine,
 * deliberate, reviewed change to the sentence), never to weaken this spec.
 */
const SAMPLE_APP_NAME = "Test App";

describe("vetDisclaimerLine", () => {
  it("is byte-pinned for a sample app name", () => {
    expect(vetDisclaimerLine(SAMPLE_APP_NAME)).toBe(
      "Test App offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.",
    );
  });

  it("carries no §7 diagnosis vocabulary", () => {
    expect(vetDisclaimerLine(SAMPLE_APP_NAME)).not.toMatch(/diagnos/i);
  });

  it("carries no digit+unit dosing pattern", () => {
    expect(vetDisclaimerLine(SAMPLE_APP_NAME)).not.toMatch(
      /\b\d+(\.\d+)?\s*(mg|ml|mcg|g|kg|iu|tsp|tbsp)\b/i,
    );
  });

  it("contains the app-name argument exactly once", () => {
    const line = vetDisclaimerLine(SAMPLE_APP_NAME);
    const occurrences = line.split(SAMPLE_APP_NAME).length - 1;
    expect(occurrences).toBe(1);
  });

  it("hardcodes no product display name (§1a — appName is always a parameter)", () => {
    expect(vetDisclaimerLine("X")).not.toMatch(/Paw Care Right/);
  });

  it("is a pure function of appName only (same input, same output)", () => {
    expect(vetDisclaimerLine(SAMPLE_APP_NAME)).toBe(vetDisclaimerLine(SAMPLE_APP_NAME));
  });
});
