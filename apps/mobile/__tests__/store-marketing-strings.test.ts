import { APP_DISPLAY_NAME } from "@bombaypetcompany/config";
import { scanUnsafeText } from "@bombaypetcompany/ai";

import { strings } from "../src/strings";
import { storeMarketing } from "../store-assets/marketing-strings";

/**
 * T100 plan step 17 (§6 AC2-b) -- the marketing-string safety lint, shaped
 * after `strings-detector-lint.test.ts`: the real T038 `scanUnsafeText`
 * (never re-implemented) plus a narrow, high-precision "claims" tier for
 * the exact forbidden-token list the plan's copy rules name (step 9), run
 * over every headline/subhead/disclosure leaf of `storeMarketing`. If a
 * legitimate caption ever trips this, the fix is the caption -- this spec
 * never loosens a pattern.
 */

interface Leaf {
  readonly path: string;
  readonly value: string;
}

function flattenLeaves(): Leaf[] {
  const leaves: Leaf[] = [{ path: "en.disclosure", value: storeMarketing.en.disclosure }];
  for (const [shotId, copy] of Object.entries(storeMarketing.en.shots)) {
    leaves.push({ path: `en.shots.${shotId}.headline`, value: copy.headline });
    leaves.push({ path: `en.shots.${shotId}.subhead`, value: copy.subhead });
  }
  return leaves;
}

const ALL_LEAVES = flattenLeaves();

// Forbidden-token tier (T100 plan step 9's binding copy rules) -- `scanUnsafeText`
// alone does not catch bare "dosage"/"mg"/"cure"/"clinically"/"guaranteed"/
// "vet-approved"/"emergency care replacement"/"treat your" (its DOSING patterns
// require a leading digit; its only lexical rule is "diagnos").
const CLAIMS_PATTERNS: readonly RegExp[] = [
  /prescri/i,
  /\bdosage\b/i,
  /\bdose\b/i,
  /\bmg\b/i,
  /\bcure\b/i,
  /treat your/i,
  /vet-approved/i,
  /clinically/i,
  /guaranteed/i,
  /emergency care replacement/i,
];

const CLAIMS_POSITIVE_CONTROLS: readonly string[] = [
  "Get a prescription in minutes.",
  "Follow the exact dosage every time.",
  "Never miss a dose.",
  "Give 5 mg with food.",
  "This will cure your pet's condition.",
  "We treat your dog's illness.",
  "Vet-approved advice, always.",
  "Clinically shown to help.",
  "Guaranteed results in a week.",
  "An emergency care replacement in your pocket.",
];

const EXEMPTIONS: readonly string[] = [];
const EXPECTED_EXEMPTION_COUNT = 0;

describe("store-assets marketing strings — AC2 safety lint", () => {
  it("every one of the 8 shots has a headline and subhead", () => {
    const shotIds = Object.keys(storeMarketing.en.shots);
    expect(shotIds.length).toBe(8);
    for (const id of shotIds) {
      const copy = storeMarketing.en.shots[id as keyof typeof storeMarketing.en.shots];
      expect(copy.headline.length).toBeGreaterThan(0);
      expect(copy.subhead.length).toBeGreaterThan(0);
    }
  });

  it("headline <= 40 and subhead <= 90 characters", () => {
    for (const [id, copy] of Object.entries(storeMarketing.en.shots)) {
      expect(copy.headline.length).toBeLessThanOrEqual(40);
      expect(copy.subhead.length).toBeLessThanOrEqual(90);
      void id;
    }
  });

  it("no marketing leaf produces a scanUnsafeText finding", () => {
    const findings = ALL_LEAVES.flatMap((leaf) => scanUnsafeText(leaf.value, leaf.path));
    expect(findings).toEqual([]);
  });

  it("no affirmative-claim / medical-claim language", () => {
    for (const leaf of ALL_LEAVES) {
      for (const pattern of CLAIMS_PATTERNS) {
        expect(pattern.test(leaf.value)).toBe(false);
      }
    }
  });

  it("positive controls: planted diagnosis/dosing/claim copy IS flagged", () => {
    expect(scanUnsafeText("This is a diagnosis of arthritis.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("Give 5mg twice daily.").length).toBeGreaterThanOrEqual(1);
    for (let index = 0; index < CLAIMS_PATTERNS.length; index += 1) {
      expect(CLAIMS_PATTERNS[index]!.test(CLAIMS_POSITIVE_CONTROLS[index]!)).toBe(true);
    }
  });

  it("the disclosure block is the frozen src/strings.ts disclaimer, byte-identical", () => {
    expect(storeMarketing.en.disclosure).toBe(strings.check.result.disclaimer(APP_DISPLAY_NAME));
    expect(storeMarketing.en.disclosure).toBe(
      "Bombay Pet Company offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.",
    );
  });

  it("allowlist hygiene (exemptions pinned at 0)", () => {
    expect(EXEMPTIONS.length).toBe(EXPECTED_EXEMPTION_COUNT);
  });
});
