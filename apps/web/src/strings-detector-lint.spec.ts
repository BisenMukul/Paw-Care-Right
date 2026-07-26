import { scanUnsafeText } from "@pawcareright/ai";
import { APP_DISPLAY_NAME } from "@pawcareright/config";

import { strings } from "./strings";

/**
 * T097 plan AC1 (web half) — the real T038 `scanUnsafeText` (never a
 * re-implementation) plus a narrow, second "claims" tier (the detector has
 * no claims rule) run over EVERY user-facing leaf of the whole `strings`
 * tree (incl. `legal.*` and `foodPage.*`). Mirrors the T084
 * `breed-guides-safety.spec.ts` shape: collector -> real `scanUnsafeText` ->
 * `expect(findings).toEqual([])`, plus non-vacuity and positive controls. If
 * a legitimate string ever trips this, the fix is the string (CLAUDE §7 /
 * T097 plan step 8) — this spec never edits the detector and never loosens
 * a pattern. See `apps/mobile/__tests__/strings-detector-lint.test.ts` for
 * the mobile counterpart, kept byte-parallel in shape ("apps cannot share
 * test helpers").
 */

const SAMPLE_ARG = "Paw Care Right +";

interface Leaf {
  readonly path: string;
  readonly value: string;
}

function flattenLeaves(node: unknown, path: string): Leaf[] {
  if (typeof node === "string") {
    return [{ path, value: node }];
  }
  if (typeof node === "function") {
    const fn = node as (...args: string[]) => string;
    const args = Array.from({ length: fn.length }, () => SAMPLE_ARG);
    return [{ path, value: fn(...args) }];
  }
  if (Array.isArray(node)) {
    return node.flatMap((value, index) => flattenLeaves(value, `${path}.${index}`));
  }
  if (node !== null && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      flattenLeaves(value, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const ALL_LEAVES: Leaf[] = flattenLeaves(strings, "");

// ---------------------------------------------------------------------------
// Lint B — claims tier (T097 plan D4): identical patterns to the mobile
// spec — see that file's header comment for the "no bare `\btreat`"
// rationale.
const CLAIMS_PATTERNS: readonly RegExp[] = [
  /vet[-\s]?approved/i,
  /veterinarian[-\s]?approved/i,
  /clinically (proven|tested|validated)/i,
  /medically (proven|accurate)/i,
  /guaranteed (safe|accurate|results?)/i,
  /we (can |will )?diagnose/i,
  /(diagnose|treat|cure|heal) your (pet|dog|cat)/i,
  /(will|can) (cure|heal|fix) (your|the) (pet|dog|cat)/i,
];

const CLAIMS_POSITIVE_CONTROLS: readonly string[] = [
  "This is vet-approved advice.",
  "This is veterinarian-approved advice.",
  "This is clinically proven to work.",
  "This is medically accurate information.",
  "This is guaranteed safe.",
  "We diagnose your dog in seconds.",
  "We can treat your cat.",
  "This will cure your pet.",
];

// ---------------------------------------------------------------------------
// Lint C — exemptions (T097 plan D3): an exact-string allowlist with a
// §-citation and a pinned count, never a pattern loosening. Fix-the-copy is
// the default remedy (plan step 8/9); the ONE entry below is the terms
// "acceptable use" prohibition clause, which legitimately names the harm it
// forbids ("do-it-yourself sedation, do-it-yourself surgery") — rewording it
// to dodge the `HARM_ENABLING` pattern would weaken, not strengthen, the
// clause, and it is separately byte-pinned verbatim by
// `apps/web/src/legal/legal-content.spec.ts`, so it cannot be reworded here
// without also breaking that spec.
interface Exemption {
  readonly value: string;
  readonly code: string;
  readonly sanctionedBy: string;
  readonly why: string;
}

const ACCEPTABLE_USE_CLAUSE =
  `You agree not to use ${SAMPLE_ARG} to harm animals in any way, including animal fighting, cruelty, do-it-yourself sedation, do-it-yourself surgery, or breeding malpractice, and not to use the service for any unlawful purpose. We may suspend or terminate accounts that violate this section.`;

const EXEMPTIONS: readonly Exemption[] = [
  {
    value: ACCEPTABLE_USE_CLAUSE,
    code: "HARM_ENABLING",
    sanctionedBy: "CLAUDE §7 rule 6 / PRODUCT_SPEC §5",
    why:
      "This is the terms-of-service clause that PROHIBITS animal-fighting/cruelty/DIY-sedation/DIY-surgery/breeding " +
      "malpractice — it names the forbidden acts so the prohibition is unambiguous. Rewording it to avoid the " +
      "detector's DIY+procedure-word pattern would weaken the clause's clarity, and the exact wording is separately " +
      "byte-pinned by legal-content.spec.ts, so it may never be reworded here.",
  },
];
const EXPECTED_EXEMPTION_COUNT = 1;

/** Strips the `path` segment of a `scanUnsafeText` finding, keeping only `CODE: excerpt`, so an exemption computed against a placeholder path still matches the same finding found at its real leaf path. */
function stripPath(findingEntry: string): string {
  const separatorIndex = findingEntry.indexOf(": ");
  const rest = separatorIndex === -1 ? findingEntry : findingEntry.slice(separatorIndex + 2);
  const secondSeparator = rest.indexOf(": ");
  return secondSeparator === -1 ? findingEntry : `${findingEntry.slice(0, separatorIndex)}: ${rest.slice(secondSeparator + 2)}`;
}

const ALLOWLISTED_NORMALIZED_FINDINGS = new Set(
  EXEMPTIONS.flatMap((exemption) => scanUnsafeText(exemption.value, "EXEMPT").map(stripPath)),
);

describe("web strings tree — AC1 detector + claims lint", () => {
  it("no strings leaf produces a detector finding", () => {
    const findings = ALL_LEAVES.flatMap((leaf) => scanUnsafeText(leaf.value, leaf.path)).filter(
      (findingEntry) => !ALLOWLISTED_NORMALIZED_FINDINGS.has(stripPath(findingEntry)),
    );
    expect(findings).toEqual([]);
  });

  it("the lint actually scanned the whole tree (non-vacuity)", () => {
    expect(ALL_LEAVES.length).toBeGreaterThanOrEqual(150);

    const collectedPaths = new Set(ALL_LEAVES.map((leaf) => leaf.path));
    const KNOWN_DEEP_PATHS = [
      "disclaimer",
      "legal.terms.acceptableUse.paragraphs.0",
      "foodPage.whatToDo.emergency",
      "landing.emergencyNote",
    ];
    for (const knownPath of KNOWN_DEEP_PATHS) {
      expect(collectedPaths.has(knownPath)).toBe(true);
    }
  });

  it("positive controls: planted dosing / diagnosis / harm / drug-name copy IS flagged", () => {
    expect(scanUnsafeText("Give 5mg of medication twice daily.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("This is a diagnosis of arthritis.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("Here's how to sedate your dog at home yourself.").length).toBeGreaterThanOrEqual(1);
    expect(scanUnsafeText("Give your dog ibuprofen for the pain.").length).toBeGreaterThanOrEqual(1);
  });

  it("no affirmative-claim language", () => {
    for (const leaf of ALL_LEAVES) {
      for (const pattern of CLAIMS_PATTERNS) {
        expect(pattern.test(leaf.value)).toBe(false);
      }
    }
  });

  it("the claims patterns catch planted claim copy", () => {
    for (let index = 0; index < CLAIMS_PATTERNS.length; index += 1) {
      expect(CLAIMS_PATTERNS[index]!.test(CLAIMS_POSITIVE_CONTROLS[index]!)).toBe(true);
    }
  });

  it("frozen copy is byte-identical", () => {
    expect(strings.disclaimer(APP_DISPLAY_NAME)).toBe(
      "Paw Care Right + offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.",
    );
    expect(strings.landing.emergencyNote).toBe(
      "If something is seriously wrong right now, do not wait for an app — contact your vet or your nearest emergency veterinary clinic.",
    );
    expect(strings.foodPage.emergency.heading).toBe("If your pet has eaten this, act now");
    expect(strings.foodPage.emergency.body).toBe(
      "Contact your nearest emergency vet. If you cannot reach one, these pet poison helplines can advise:",
    );
    expect(strings.foodPage.emergency.fallback).toBe(
      "If your region is not listed, contact your nearest emergency vet clinic right away.",
    );
    expect(strings.foodPage.whatToDo.toxic).toBe(
      "Contact your vet or a pet poison helpline straight away, even if your pet seems fine. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
    );
    expect(strings.foodPage.whatToDo.emergency).toBe(
      "Contact your nearest emergency vet or a pet poison helpline right now. Do not wait for symptoms, do not try to treat this at home, and do not try to make your pet vomit unless a vet tells you to.",
    );
  });

  it("allowlist hygiene", () => {
    expect(EXEMPTIONS.length).toBe(EXPECTED_EXEMPTION_COUNT);
    for (const exemption of EXEMPTIONS) {
      expect(exemption.code.length).toBeGreaterThan(0);
      expect(exemption.sanctionedBy.length).toBeGreaterThan(0);
      expect(exemption.why.length).toBeGreaterThan(0);
      // Stale-entry check: every exemption must still exist verbatim in the tree.
      expect(ALL_LEAVES.some((leaf) => leaf.value === exemption.value)).toBe(true);
    }
  });
});
