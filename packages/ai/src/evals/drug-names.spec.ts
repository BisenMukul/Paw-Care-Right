import { DRUG_NAME_RE, DRUG_NAME_TOKENS } from "./drug-names";

describe("DRUG_NAME_TOKENS", () => {
  it("is non-empty", () => {
    expect(DRUG_NAME_TOKENS.length).toBeGreaterThan(0);
  });

  it("is all lowercase", () => {
    for (const token of DRUG_NAME_TOKENS) {
      expect(token).toBe(token.toLowerCase());
    }
  });

  it("is de-duped", () => {
    expect(new Set(DRUG_NAME_TOKENS).size).toBe(DRUG_NAME_TOKENS.length);
  });

  it("contains human-med-derived single-word names/aliases", () => {
    for (const expected of ["ibuprofen", "paracetamol", "benadryl", "aspirin"]) {
      expect(DRUG_NAME_TOKENS).toContain(expected);
    }
  });

  it("contains the local VET_DRUG_NAMES supplement", () => {
    for (const expected of ["carprofen", "meloxicam"]) {
      expect(DRUG_NAME_TOKENS).toContain(expected);
    }
  });

  it("excludes multi-word descriptive names (no token contains a space)", () => {
    for (const token of DRUG_NAME_TOKENS) {
      expect(token).not.toContain(" ");
    }
  });

  it("excludes descriptive category words like 'medication'", () => {
    expect(DRUG_NAME_TOKENS).not.toContain("medication");
  });
});

describe("DRUG_NAME_RE", () => {
  it("matches a drug name embedded in ordinary prose", () => {
    expect(DRUG_NAME_RE.test("you could try ibuprofen")).toBe(true);
  });

  it("supports safe repeated scanning via a fresh regex clone (avoids shared-lastIndex bugs)", () => {
    // NB: `DRUG_NAME_RE` itself is `g`-flagged and stateful (`lastIndex` persists
    // across `.test()`/`matchAll()` calls on the SAME object) — callers that scan
    // more than once per process must construct a fresh regex from
    // `DRUG_NAME_RE.source`/`.flags` each time, exactly as `detector.ts` does.
    const scan = (text: string): number =>
      Array.from(text.matchAll(new RegExp(DRUG_NAME_RE.source, DRUG_NAME_RE.flags))).length;
    expect(scan("give him benadryl")).toBe(1);
    expect(scan("give him benadryl")).toBe(1);
  });
});
