import { SAFE_FALLBACK, parseTriage, type Urgency } from "@pawcareright/types";

import { applyPostRules } from "../post-rules";
import { RED_FLAG_RULES, evaluateRedFlags, type RedFlagIntake } from "../rules";

import { loadCases } from "./load";
import { evalsDir } from "./paths";
import type { LoadedCase } from "./types";

/**
 * T037 golden-set meta-test (plan "Meta-test spec"). Pure count/coverage
 * assertions over the authored YAML fixtures — no provider, no harness run
 * (that's `pnpm test:ai-evals`, the authoritative end-to-end gate). This
 * spec is the fast, in-unit proof that the corpus is internally consistent
 * BEFORE the slower harness run.
 */

const golden: LoadedCase[] = loadCases(evalsDir()).filter((c) => c.set === "golden");

/** `expectedTier ?? acceptableTiers[0]` — the file-aligned "primary tier" (plan R3). */
function primaryTier(c: LoadedCase): Urgency {
  if (c.expectedTier !== undefined) return c.expectedTier;
  if (c.acceptableTiers !== undefined && c.acceptableTiers.length > 0) return c.acceptableTiers[0]!;
  throw new Error(`case "${c.id}" has neither expectedTier nor acceptableTiers`);
}

function toRedFlagIntake(c: LoadedCase): RedFlagIntake {
  const { input } = c;
  return {
    species: input.species,
    ...(input.sex !== undefined ? { sex: input.sex } : {}),
    ...(input.ageMonths !== undefined ? { ageMonths: input.ageMonths } : {}),
    ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
    ...(input.sizeClass !== undefined ? { sizeClass: input.sizeClass } : {}),
    ...(input.signs !== undefined ? { signs: input.signs } : {}),
    ...(input.freeText !== undefined ? { freeText: input.freeText } : {}),
  };
}

const URGENCY_TIERS_ALL: Urgency[] = ["EMERGENCY_NOW", "VET_24H", "VET_SOON", "MONITOR", "REASSURE"];

describe("golden set v1 (T037) — count/coverage meta-test", () => {
  // 1. Total count.
  it("has at least 150 golden cases", () => {
    expect(golden.length).toBeGreaterThanOrEqual(150);
  });

  // 2. Unique ids (loadCases already throws on dupes across all files/sets;
  // this re-asserts it defensively within the golden subset).
  it("has unique ids", () => {
    const ids = golden.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // 3. Per primary-tier count >= 30.
  it("has at least 30 cases per primary tier", () => {
    for (const tier of URGENCY_TIERS_ALL) {
      const count = golden.filter((c) => primaryTier(c) === tier).length;
      expect(count).toBeGreaterThanOrEqual(30);
    }
  });

  // 4. Per-tier species minimums.
  it("meets per-tier species minimums (dog>=12, cat>=12; REASSURE dog>=30, cat===0)", () => {
    for (const tier of URGENCY_TIERS_ALL) {
      const casesInTier = golden.filter((c) => primaryTier(c) === tier);
      const dogCount = casesInTier.filter((c) => c.input.species === "DOG").length;
      const catCount = casesInTier.filter((c) => c.input.species === "CAT").length;

      if (tier === "REASSURE") {
        expect(dogCount).toBeGreaterThanOrEqual(30);
        expect(catCount).toBe(0);
      } else {
        expect(dogCount).toBeGreaterThanOrEqual(12);
        expect(catCount).toBeGreaterThanOrEqual(12);
      }
    }
  });

  // 5. Overall species minimums (>=40% each).
  it("has at least 40% dog and 40% cat overall", () => {
    const total = golden.length;
    const dogCount = golden.filter((c) => c.input.species === "DOG").length;
    const catCount = golden.filter((c) => c.input.species === "CAT").length;
    expect(dogCount / total).toBeGreaterThanOrEqual(0.4);
    expect(catCount / total).toBeGreaterThanOrEqual(0.4);
  });

  // 6. Rule coverage: every RED_FLAG_RULES id appears in some expectRedFlagRule.
  it("represents every red-flag rule at least once", () => {
    const covered = new Set(golden.map((c) => c.expectRedFlagRule).filter((id): id is string => id !== undefined));
    for (const rule of RED_FLAG_RULES) {
      expect(covered.has(rule.id)).toBe(true);
    }
  });

  // 7. Rules cases resolve via the rules layer, provider-independent.
  it("resolves every expectRedFlagRule case via the rules layer at EMERGENCY_NOW", () => {
    const rulesCases = golden.filter((c) => c.expectRedFlagRule !== undefined);
    expect(rulesCases.length).toBeGreaterThan(0);

    for (const c of rulesCases) {
      expect(c.expectSource).toBe("rules");
      expect(c.expectedTier).toBe("EMERGENCY_NOW");

      const evaluation = evaluateRedFlags(toRedFlagIntake(c));
      expect(evaluation.highest?.tierFloor).toBe("EMERGENCY_NOW");
      expect(evaluation.matched.some((m) => m.ruleId === c.expectRedFlagRule)).toBe(true);
    }
  });

  // 8. AI-driven cases fire NO rule (guards accidental keyword hits).
  it("fires no red-flag rule for any expectSource:ai case", () => {
    const aiCases = golden.filter((c) => c.expectSource === "ai");
    expect(aiCases.length).toBeGreaterThan(0);

    for (const c of aiCases) {
      const evaluation = evaluateRedFlags(toRedFlagIntake(c));
      expect(evaluation.matched.length).toBe(0);
    }
  });

  // 9. Age extremes.
  it("has at least 15 young (<=6mo) and 15 senior (>=120mo) cases", () => {
    const young = golden.filter((c) => c.input.ageMonths !== undefined && c.input.ageMonths <= 6).length;
    const senior = golden.filter((c) => c.input.ageMonths !== undefined && c.input.ageMonths >= 120).length;
    expect(young).toBeGreaterThanOrEqual(15);
    expect(senior).toBeGreaterThanOrEqual(15);
  });

  // 10. Ambiguity coverage.
  it("has at least 15 ambiguity (acceptableTiers) cases", () => {
    const ambiguous = golden.filter((c) => c.acceptableTiers !== undefined).length;
    expect(ambiguous).toBeGreaterThanOrEqual(15);
  });

  // 11. Every fakeResponse is parseTriage-valid.
  it("has a parseTriage-valid fakeResponse wherever one is provided", () => {
    const withFake = golden.filter((c) => c.fakeResponse !== undefined);
    expect(withFake.length).toBeGreaterThan(0);

    for (const c of withFake) {
      const parsed = parseTriage(c.fakeResponse);
      expect(parsed.ok).toBe(true);
    }
  });

  // 12. Deterministic finalTier pre-check — mirrors the pipeline sans provider.
  it("resolves every case's finalTier/source deterministically via applyPostRules", () => {
    for (const c of golden) {
      const intake = toRedFlagIntake(c);
      const rulesFloor = evaluateRedFlags(intake).highest?.tierFloor ?? null;
      const parsed = c.fakeResponse !== undefined ? parseTriage(c.fakeResponse) : { ok: true as const, result: SAFE_FALLBACK };
      if (!parsed.ok) {
        throw new Error(`case "${c.id}" has an invalid fakeResponse: ${parsed.reason}`);
      }

      const outcome = applyPostRules(parsed.result, { species: c.input.species, rulesFloor });

      const acceptable = c.acceptableTiers ?? (c.expectedTier !== undefined ? [c.expectedTier] : []);
      expect(acceptable).toContain(outcome.finalTier);

      if (c.expectSource !== undefined) {
        expect(outcome.source).toBe(c.expectSource);
      }
    }
  });
});
