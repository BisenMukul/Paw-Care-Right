import { scanUnsafeText } from "../evals/detector";
import { SAFETY_RULES_SECTION, SAFE_FALLBACK_CHAT_MESSAGE, UNTRUSTED_INPUT_RULE } from "./policy";

describe("SAFETY_RULES_SECTION", () => {
  it('contains the no-diagnosis wording ("possible causes" / "what this could be")', () => {
    expect(SAFETY_RULES_SECTION).toMatch(/never use the words "diagnosis" or "diagnose"/i);
  });

  it("contains the no-dosing / no-drug-recommendation wording", () => {
    expect(SAFETY_RULES_SECTION).toMatch(/never give medication dosages/i);
    expect(SAFETY_RULES_SECTION).toMatch(/never recommend or name a drug to give/i);
  });

  it("contains the choose-more-urgent-and-lower-confidence fail-upward wording", () => {
    expect(SAFETY_RULES_SECTION).toMatch(/choose the more urgent tier and lower confidence/i);
  });

  it("contains the one-tier cat urgency bias wording", () => {
    expect(SAFETY_RULES_SECTION).toMatch(/treat a cat as one tier more urgent than a dog/i);
  });

  it("contains the refuse-harm wording", () => {
    expect(SAFETY_RULES_SECTION).toMatch(/refuse anything that could harm an animal/i);
  });

  it("contains the life-threatening -> EMERGENCY_NOW/VET_24H wording", () => {
    expect(SAFETY_RULES_SECTION).toMatch(/life-threatening sign, use EMERGENCY_NOW or VET_24H/i);
  });
});

describe("SAFE_FALLBACK_CHAT_MESSAGE", () => {
  it("scans clean via scanUnsafeText", () => {
    expect(scanUnsafeText(SAFE_FALLBACK_CHAT_MESSAGE)).toEqual([]);
  });

  it("contains no diagnosis/dosage language", () => {
    expect(SAFE_FALLBACK_CHAT_MESSAGE).not.toMatch(/diagnos/i);
    expect(SAFE_FALLBACK_CHAT_MESSAGE).not.toMatch(/\d/);
  });
});

describe("UNTRUSTED_INPUT_RULE", () => {
  it("is a single non-empty line declaring owner content as data, never instructions", () => {
    expect(UNTRUSTED_INPUT_RULE).not.toContain("\n");
    expect(UNTRUSTED_INPUT_RULE.length).toBeGreaterThan(0);
    expect(UNTRUSTED_INPUT_RULE).toMatch(/never/i);
  });
});
