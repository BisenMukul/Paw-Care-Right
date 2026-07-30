import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FOOD_VERDICTS } from "@bombaypetcompany/types";

import { allBreedGuides, publishedBreedGuides } from "../breed-guides";
import { allBreeds, catBreeds, dogBreeds } from "../breeds";
import { LIFE_STAGES, PROTOCOL_GROUPS } from "../care-templates/schema";
import { EMERGENCY_PAYLOADS } from "../emergency";
import { REGION_HOTLINES } from "../regions";
import { toxins } from "../toxins";
import { TOXIN_CATEGORIES } from "../toxins/schema";

import {
  HOTLINE_VERIFICATION_STATUS,
  computeDatasetAudit,
  renderDatasetAuditDoc,
  toxinSpotCheckOrder,
  topToxinSpotCheck,
} from "./dataset-audit";
import { TOXIN_SOURCE_FILES, TOXIN_SOURCE_REGISTRY } from "./toxin-sources";

const toxinDataDir = join(__dirname, "..", "toxins", "data");

/**
 * The header comments are hand-wrapped JSDoc (`/** ... *​/` with a leading
 * ` * ` on each line), so a multi-word source name can legitimately be split
 * across a line break in the source file. Collapsing all whitespace (line
 * breaks, comment asterisks, repeated spaces) to single spaces compares the
 * *content* verbatim without being defeated by that formatting artifact.
 */
function normalizeWhitespace(text: string): string {
  return text
    .split("\n")
    .map((textLine) => textLine.replace(/^\s*\*\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("T1 — the sources registry is transcribed verbatim from each category data file header", () => {
  it.each(TOXIN_CATEGORIES)("category %s's registered sources all appear in its data file header", (category) => {
    const header = normalizeWhitespace(readFileSync(join(toxinDataDir, TOXIN_SOURCE_FILES[category]), "utf8").slice(0, 400));
    expect(header).toContain("Sources consulted");
    for (const source of TOXIN_SOURCE_REGISTRY[category]) {
      expect(header).toContain(normalizeWhitespace(source));
    }
  });
});

describe("T2 — the spot check is exactly 100 rows, all drawn from the toxin dataset, with no duplicates", () => {
  const spotCheck = topToxinSpotCheck();

  it("has exactly 100 rows", () => {
    expect(spotCheck.length).toBe(100);
  });

  it("every row is drawn from the toxin dataset", () => {
    const toxinIds = new Set(toxins.map((t) => t.id));
    for (const row of spotCheck) {
      expect(toxinIds.has(row.id)).toBe(true);
    }
  });

  it("has no duplicate ids", () => {
    const ids = spotCheck.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("T3 — spot-check ordering is deterministic and severity-first", () => {
  it("two calls give identical id arrays", () => {
    const first = topToxinSpotCheck().map((r) => r.id);
    const second = topToxinSpotCheck().map((r) => r.id);
    expect(second).toEqual(first);
  });

  it("a shuffled copy of the input yields the same output", () => {
    const shuffled = [...toxins].reverse();
    const fromOriginal = topToxinSpotCheck(toxins).map((r) => r.id);
    const fromShuffled = topToxinSpotCheck(shuffled).map((r) => r.id);
    expect(fromShuffled).toEqual(fromOriginal);
  });

  it("severity is non-increasing down the list, and row 1's max severity equals the dataset maximum", () => {
    const severityOf = (verdict: (typeof FOOD_VERDICTS)[number]): number =>
      FOOD_VERDICTS.indexOf(verdict);

    const audit = computeDatasetAudit();
    const maxSeverities = audit.spotCheck.map((row) => Math.max(severityOf(row.dog), severityOf(row.cat)));

    for (let i = 1; i < maxSeverities.length; i += 1) {
      const current = maxSeverities[i];
      const previous = maxSeverities[i - 1];
      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      if (current !== undefined && previous !== undefined) {
        expect(current).toBeLessThanOrEqual(previous);
      }
    }

    const datasetMax = Math.max(
      ...toxins.map((row) => Math.max(severityOf(row.verdicts.dog), severityOf(row.verdicts.cat))),
    );
    expect(maxSeverities[0]).toBe(datasetMax);
  });

  it("toxinSpotCheckOrder is a valid comparator (antisymmetric on distinct rows)", () => {
    const [a, b] = toxins;
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (a && b && a.id !== b.id) {
      expect(Math.sign(toxinSpotCheckOrder(a, b))).toBe(-Math.sign(toxinSpotCheckOrder(b, a)));
    }
  });
});

describe("T4 — every spot-check row has a schema-valid verdict pair and a category-level source", () => {
  const audit = computeDatasetAudit();

  it("every row's dog/cat verdicts are valid FOOD_VERDICTS", () => {
    for (const row of audit.spotCheck) {
      expect(FOOD_VERDICTS as readonly string[]).toContain(row.dog);
      expect(FOOD_VERDICTS as readonly string[]).toContain(row.cat);
    }
  });

  it("every row's category resolves to at least one declared source, matching sourceCount", () => {
    for (const row of audit.spotCheck) {
      const registered = TOXIN_SOURCE_REGISTRY[row.category];
      expect(registered.length).toBeGreaterThanOrEqual(1);
      expect(row.sourceCount).toBe(registered.length);
    }
  });
});

describe("T5 — every hotline row carries UNVERIFIED and no other status value exists", () => {
  const audit = computeDatasetAudit();

  it("HOTLINE_VERIFICATION_STATUS is exactly 'UNVERIFIED'", () => {
    expect(HOTLINE_VERIFICATION_STATUS).toBe("UNVERIFIED");
  });

  it("every hotline row's verifiedByHuman is UNVERIFIED", () => {
    for (const row of audit.hotlines) {
      expect(row.verifiedByHuman).toBe("UNVERIFIED");
    }
  });

  it("every spot-check row's human column is UNVERIFIED", () => {
    for (const row of audit.spotCheck) {
      expect(row.verdictCorrectnessVerifiedByHuman).toBe("UNVERIFIED");
    }
  });
});

describe("T6 — hotline coverage equals the regions dataset and every number is format-valid", () => {
  const audit = computeDatasetAudit();

  it("region-code set equals REGION_HOTLINES codes exactly (no extra, none missing)", () => {
    const auditCodes = new Set(audit.hotlines.map((row) => row.regionCode));
    const datasetCodes = new Set(REGION_HOTLINES.map((row) => row.regionCode));
    expect(auditCodes).toEqual(datasetCodes);
    expect(audit.hotlines.length).toBe(REGION_HOTLINES.length);
  });

  it("every row is format-valid and non-empty", () => {
    for (const row of audit.hotlines) {
      expect(row.regionCode).toMatch(/^[A-Z]{2}$/);
      expect(row.dialNumber).toMatch(/^[+0-9]+$/);
      expect(row.displayNumber.length).toBeGreaterThan(0);
      expect(row.poisonHotlineName.length).toBeGreaterThan(0);
      expect(row.source.length).toBeGreaterThan(0);
    }
  });
});

describe("T7 — the breed-guide inventory partitions allBreedGuides into reviewed + unreviewed with provenance", () => {
  const audit = computeDatasetAudit();
  const { reviewed, unreviewed } = audit.breedGuideInventory;

  it("reviewed.length + unreviewed.length === allBreedGuides.length", () => {
    expect(reviewed.length + unreviewed.length).toBe(allBreedGuides.length);
  });

  it("reviewed.length === publishedBreedGuides.length", () => {
    expect(reviewed.length).toBe(publishedBreedGuides.length);
  });

  it("every reviewed entry has non-empty reviewedBy and reviewedAt", () => {
    for (const entry of reviewed) {
      expect(entry.reviewedBy).toBeTruthy();
      expect(entry.reviewedAt).toBeTruthy();
    }
  });

  it("every unreviewed guide appears explicitly by slug (no truncation)", () => {
    const unreviewedSlugs = new Set(unreviewed.map((entry) => `${entry.species}/${entry.slug}`));
    const expectedSlugs = new Set(
      allBreedGuides.filter((g) => !g.reviewed).map((g) => `${g.species}/${g.slug}`),
    );
    expect(unreviewedSlugs).toEqual(expectedSlugs);
    for (const entry of unreviewed) {
      expect(entry.slug).not.toContain("…");
    }
  });
});

describe("T8 — renderDatasetAuditDoc is a pure function of the audit (stable across calls)", () => {
  it("two calls return the identical string", () => {
    const audit = computeDatasetAudit();
    const first = renderDatasetAuditDoc(audit);
    const second = renderDatasetAuditDoc(audit);
    expect(second).toBe(first);
  });

  it("two independently computed audits render identically (no timestamp/randomness)", () => {
    const first = renderDatasetAuditDoc(computeDatasetAudit());
    const second = renderDatasetAuditDoc(computeDatasetAudit());
    expect(second).toBe(first);
  });
});

/**
 * Checker fix (M3b): the byte-equality drift guard (T9) only proves the
 * committed doc matches whatever `computeDatasetAudit()` currently returns —
 * it cannot catch a scalar `counts.*` field silently drifting from the raw
 * dataset it's supposed to summarise (e.g. `counts.breedGuides.reviewed` set
 * to `allBreedGuides.length` instead of `publishedBreedGuides.length`),
 * because regenerating the doc after such a change still passes T9 (it is
 * self-consistent with the mutated engine, just wrong). These anchors compare
 * each `counts.*` scalar against **independently-imported raw dataset
 * exports** (not against other engine output), and additionally cross-check
 * the breed-guide count against the separately-computed `breedGuideInventory`
 * partition, so a `counts` field cannot drift from either the data or the
 * inventory without a test going red.
 */
describe("Cross-consistency anchors — engine counts vs. independently-loaded raw datasets", () => {
  const audit = computeDatasetAudit();

  it("counts.breeds.{dog,cat,total} match the raw breeds dataset exactly", () => {
    expect(audit.counts.breeds.dog).toBe(dogBreeds.length);
    expect(audit.counts.breeds.cat).toBe(catBreeds.length);
    expect(audit.counts.breeds.total).toBe(allBreeds.length);
  });

  it("counts.toxins.total matches the raw toxin dataset length", () => {
    expect(audit.counts.toxins.total).toBe(toxins.length);
  });

  it("counts.hotlineRegions matches the raw REGION_HOTLINES length", () => {
    expect(audit.counts.hotlineRegions).toBe(REGION_HOTLINES.length);
  });

  it("counts.emergencyPayloads matches the raw EMERGENCY_PAYLOADS length", () => {
    expect(audit.counts.emergencyPayloads).toBe(EMERGENCY_PAYLOADS.length);
  });

  it("counts.careTemplates.{protocolGroups,lifeStages} match the raw enum arrays", () => {
    expect(audit.counts.careTemplates.protocolGroups).toBe(PROTOCOL_GROUPS.length);
    expect(audit.counts.careTemplates.lifeStages).toBe(LIFE_STAGES.length);
  });

  it("counts.breedGuides.total matches the raw allBreedGuides length", () => {
    expect(audit.counts.breedGuides.total).toBe(allBreedGuides.length);
  });

  it("counts.breedGuides.reviewed === breedGuideInventory.reviewed.length === publishedBreedGuides.length (raw)", () => {
    expect(audit.counts.breedGuides.reviewed).toBe(publishedBreedGuides.length);
    expect(audit.counts.breedGuides.reviewed).toBe(audit.breedGuideInventory.reviewed.length);
  });

  it("counts.breedGuides.unreviewed mirrors the draft partition and the raw total-minus-published gap", () => {
    expect(audit.counts.breedGuides.unreviewed).toBe(audit.breedGuideInventory.unreviewed.length);
    expect(audit.counts.breedGuides.unreviewed).toBe(allBreedGuides.length - publishedBreedGuides.length);
    expect(audit.counts.breedGuides.total - audit.counts.breedGuides.reviewed).toBe(
      audit.breedGuideInventory.unreviewed.length,
    );
  });
});

