import { APP_DISPLAY_NAME } from "@pawcareright/config";
import { scanUnsafeText } from "@pawcareright/ai";

import { strings } from "../src/strings";

/**
 * T097 plan AC1 (mobile half) — the real T038 `scanUnsafeText` (never a
 * re-implementation) plus a narrow, second "claims" tier (the detector has
 * no claims rule) run over EVERY user-facing leaf of the whole `strings`
 * tree. Mirrors the T084 `breed-guides-safety.spec.ts` shape: collector ->
 * real `scanUnsafeText` -> `expect(findings).toEqual([])`, plus non-vacuity
 * and positive controls. If a legitimate string ever trips this, the fix is
 * the string (CLAUDE §7 / T097 plan step 8) — this spec never edits the
 * detector and never loosens a pattern.
 *
 * Per-app copy of the collector (T097 plan "apps cannot share test
 * helpers") — see `apps/web/src/strings-detector-lint.spec.ts` for the web
 * counterpart, kept byte-parallel in shape.
 */

const SAMPLE_ARG = "Paw Care Right +";

interface Leaf {
  readonly path: string;
  readonly value: string;
}

// Two `strings` leaves are typed lookups keyed by a closed enum
// (`ReminderType`/`ScheduleFrequency`), not templates that interpolate an
// arbitrary arg — invoking them with `SAMPLE_ARG` (an invalid key) returns
// `undefined`, not a string. Enumerating every real key instead scans every
// authored literal these two functions can actually produce, with no
// product-code change (T097 plan D5's "authored literal segment" scope,
// extended to the closed-enum case the D5 risk note did not anticipate).
const ENUM_OVERRIDES: Readonly<Record<string, readonly string[]>> = {
  "notifications.typeLabel": ["VACCINE", "PARASITE", "MEDICATION", "GROOMING", "DENTAL", "VET_VISIT", "CUSTOM"],
  "reminderForm.freqLabel": ["DAILY", "WEEKLY", "MONTHLY"],
};

function flattenLeaves(node: unknown, path: string): Leaf[] {
  if (typeof node === "string") {
    return [{ path, value: node }];
  }
  if (typeof node === "function") {
    const fn = node as (...args: string[]) => string;
    const overrideKeys = ENUM_OVERRIDES[path];
    if (overrideKeys !== undefined) {
      return overrideKeys.map((key, index) => ({ path: `${path}.${index}`, value: fn(key) }));
    }
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
// Lint B — claims tier (T097 plan D4): the detector has no claims rule, so a
// second, deliberately narrow set of high-precision affirmative-claim
// patterns catches "vet-approved"/"clinically proven"/"we diagnose your
// dog"-style copy. Deliberately NOT a bare `\btreat` — frozen legal/food
// copy legitimately uses "treatment"/"treats" in negations, and a bare
// pattern would force rewording sanctioned safety copy (forbidden).
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
// the default remedy (see plan step 8); this array is empty for mobile —
// today's mobile `strings` tree carries no §7-sanctioned prohibition/warning
// copy the detector cannot contextualize.
interface Exemption {
  readonly value: string;
  readonly code: string;
  readonly sanctionedBy: string;
  readonly why: string;
}

const EXEMPTIONS: readonly Exemption[] = [];
const EXPECTED_EXEMPTION_COUNT = 0;

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

describe("mobile strings tree — AC1 detector + claims lint", () => {
  it("no strings leaf produces a detector finding", () => {
    const findings = ALL_LEAVES.flatMap((leaf) => scanUnsafeText(leaf.value, leaf.path)).filter(
      (findingEntry) => !ALLOWLISTED_NORMALIZED_FINDINGS.has(stripPath(findingEntry)),
    );
    expect(findings).toEqual([]);
  });

  it("the lint actually scanned the whole tree (non-vacuity)", () => {
    expect(ALL_LEAVES.length).toBeGreaterThanOrEqual(600);

    const collectedPaths = new Set(ALL_LEAVES.map((leaf) => leaf.path));
    const KNOWN_DEEP_PATHS = [
      "check.result.disclaimer",
      "chat.safeFallback",
      "medForm.disclaimer",
      "servicesPreview.end.adoptFields.0",
      "agenda.medDoseLabel",
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
    expect(strings.check.result.disclaimer(APP_DISPLAY_NAME)).toBe(
      "Paw Care Right + offers general pet-care guidance, not veterinary care or treatment. Always consult a licensed veterinarian.",
    );
    expect(strings.check.emergency).toEqual({
      goNowBadge: "Emergency",
      detectedHeading: "What we noticed",
      guidanceHeading: "What to do now",
      hotlineHeading: "Pet poison helpline",
      callHotline: "Call the poison helpline",
      hotlineFallback:
        "We don't have a pet poison helpline listed for your area. If poisoning is possible, contact your nearest emergency vet right away.",
      findVet: "Find an emergency vet",
      acknowledge: "I understand — continue",
    });
    expect(strings.check.result.fallbackNotice).toBe(
      "We couldn't fully assess this from what you shared. When in doubt, it's safest to have a vet take a look.",
    );
    expect(strings.check.result.emergencyNoticeTitle).toBe("This may be an emergency");
    expect(strings.check.result.emergencyNoticeBody).toBe(
      "Based on what you shared, your pet may need urgent care right away.",
    );
    expect(strings.check.result.emergencyNoticeCta).toBe("See emergency steps");
    expect(strings.chat.safeFallback).toBe(
      "We can't assess this reliably from what you've shared — please contact a vet.",
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
