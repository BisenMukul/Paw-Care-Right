import { FOOD_VERDICT_SEVERITY, type FoodVerdict } from "@bombaypetcompany/types";

import { allBreedGuides, publishedBreedGuides } from "../breed-guides";
import type { BreedSpecies } from "../breeds/schema";
import type { GeneratedBy } from "../breed-guides/schema";
import { allBreeds, catBreeds, dogBreeds } from "../breeds";
import { LIFE_STAGES, PROTOCOL_GROUPS } from "../care-templates/schema";
import { EMERGENCY_PAYLOADS } from "../emergency";
import { REGION_HOTLINES } from "../regions";
import { toxins } from "../toxins";
import { TOXIN_CATEGORIES, type ToxinCategory, type ToxinRow } from "../toxins/schema";

import { TOXIN_SOURCE_FILES, TOXIN_SOURCE_REGISTRY } from "./toxin-sources";

/**
 * T105 — pure, fs-free dataset-audit engine. `computeDatasetAudit()` reads
 * only the already-parsed, in-memory dataset exports (never a raw JSON/TS
 * data file directly) and `renderDatasetAuditDoc()` turns that into the
 * markdown committed at `docs/qa/dataset-audit.md` (byte-identical, per
 * `dataset-audit-doc.spec.ts`). No `fs`, no `Date`, no randomness anywhere
 * in this file — determinism here is what makes the doc byte-pinnable.
 */

export const TOP_TOXIN_SPOT_CHECK_SIZE = 100;

/**
 * The single value any "verified by a human" column in this audit may ever
 * hold. There is no branch, parameter, or input in this module that can
 * produce anything else — hotline numbers and toxin verdicts are verified
 * only by a founder/vet at a later, human-gated step (C3).
 */
export const HOTLINE_VERIFICATION_STATUS = "UNVERIFIED";
export type HumanVerificationStatus = typeof HOTLINE_VERIFICATION_STATUS;

export interface ToxinSpotCheckRow {
  rank: number;
  id: string;
  name: string;
  category: ToxinCategory;
  dog: FoodVerdict;
  cat: FoodVerdict;
  sourceCount: number;
  verdictCorrectnessVerifiedByHuman: HumanVerificationStatus;
}

export interface HotlineAuditRow {
  regionCode: string;
  poisonHotlineName: string;
  displayNumber: string;
  dialNumber: string;
  feeNote: string | null;
  source: string;
  verifiedByHuman: HumanVerificationStatus;
}

export interface BreedGuideInventoryEntry {
  species: BreedSpecies;
  slug: string;
  generatedBy: GeneratedBy;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DatasetAudit {
  counts: {
    breeds: { dog: number; cat: number; total: number };
    toxins: { total: number; byCategory: Record<ToxinCategory, number> };
    hotlineRegions: number;
    breedGuides: { total: number; dog: number; cat: number; reviewed: number; unreviewed: number };
    careTemplates: { protocolGroups: number; lifeStages: number };
    emergencyPayloads: number;
  };
  sources: ReadonlyArray<{ category: ToxinCategory; file: string; sources: readonly string[]; rowCount: number }>;
  spotCheck: readonly ToxinSpotCheckRow[];
  reviewQueues: {
    nonFoodSafe: readonly string[];
    speciesDivergent: readonly string[];
    missingQuantityNuance: readonly string[];
  };
  hotlines: readonly HotlineAuditRow[];
  breedGuideInventory: {
    reviewed: readonly BreedGuideInventoryEntry[];
    unreviewed: readonly BreedGuideInventoryEntry[];
  };
  metaTests: ReadonlyArray<{ path: string; guards: string }>;
  consumerPins: ReadonlyArray<{ path: string; pins: string }>;
}

function maxSeverity(row: ToxinRow): number {
  return Math.max(FOOD_VERDICT_SEVERITY[row.verdicts.dog], FOOD_VERDICT_SEVERITY[row.verdicts.cat]);
}

function minSeverity(row: ToxinRow): number {
  return Math.min(FOOD_VERDICT_SEVERITY[row.verdicts.dog], FOOD_VERDICT_SEVERITY[row.verdicts.cat]);
}

/**
 * Deterministic spot-check ordering (plan D1): max(dog,cat) severity desc ->
 * min(dog,cat) severity desc -> category index in `TOXIN_CATEGORIES` asc ->
 * id asc (plain `<`/`>`; ids are kebab-case ASCII, so `localeCompare` is
 * deliberately avoided).
 */
export function toxinSpotCheckOrder(a: ToxinRow, b: ToxinRow): number {
  const maxDiff = maxSeverity(b) - maxSeverity(a);
  if (maxDiff !== 0) {
    return maxDiff;
  }
  const minDiff = minSeverity(b) - minSeverity(a);
  if (minDiff !== 0) {
    return minDiff;
  }
  const categoryDiff = TOXIN_CATEGORIES.indexOf(a.category) - TOXIN_CATEGORIES.indexOf(b.category);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}

export function topToxinSpotCheck(rows: readonly ToxinRow[] = toxins): readonly ToxinRow[] {
  return [...rows].sort(toxinSpotCheckOrder).slice(0, TOP_TOXIN_SPOT_CHECK_SIZE);
}

function buildInventoryEntry(guide: (typeof allBreedGuides)[number]): BreedGuideInventoryEntry {
  const { reviewedBy, reviewedAt } = guide.provenance;
  return {
    species: guide.species,
    slug: guide.slug,
    generatedBy: guide.provenance.generatedBy,
    ...(reviewedBy !== undefined ? { reviewedBy } : {}),
    ...(reviewedAt !== undefined ? { reviewedAt } : {}),
  };
}

function bySpeciesThenSlug(a: BreedGuideInventoryEntry, b: BreedGuideInventoryEntry): number {
  if (a.species !== b.species) {
    return a.species < b.species ? -1 : 1;
  }
  if (a.slug < b.slug) {
    return -1;
  }
  if (a.slug > b.slug) {
    return 1;
  }
  return 0;
}

/** Repo-relative paths of the 8 `packages/data` schema meta-tests + the cross-package `packages/ai` safety lint (AC2). */
const META_TESTS: ReadonlyArray<{ path: string; guards: string }> = [
  {
    path: "packages/data/src/breeds/dataset.spec.ts",
    guards: "breed count minimums (>=300 dog, >=60 cat), slug uniqueness, the mixed-unknown row",
  },
  {
    path: "packages/data/src/breeds/search.spec.ts",
    guards: "breed search/lookup behaviour over the breeds dataset",
  },
  {
    path: "packages/data/src/toxins/dataset.spec.ts",
    guards:
      "toxin count minimums (>=220 total + per-category), id/alias-key uniqueness, the 5 pinned anchor verdicts, the section-7 dosing/diagnosis language scan",
  },
  {
    path: "packages/data/src/toxins/normalize.spec.ts",
    guards: "the name/alias normalization + singularization used for toxin lookup",
  },
  {
    path: "packages/data/src/regions/regions.spec.ts",
    guards:
      "exactly 5 hotline rows, dialNumber regex validity, non-empty source, and that the fallback carries no fabricated number",
  },
  {
    path: "packages/data/src/emergency/emergency-payloads.spec.ts",
    guards: "emergency payload schema validity and the pinned generic fallback payload",
  },
  {
    path: "packages/data/src/care-templates/care-templates.spec.ts",
    guards: "the fully-resolved base + vaccine-overlay care-template matrix across species/life-stage/protocol group",
  },
  {
    path: "packages/data/src/breed-guides/breed-guides.spec.ts",
    guards:
      "50 breed guides total (38 dog + 12 cat) and that publishedBreedGuides is exactly the 5 reviewed exemplars",
  },
  {
    path: "packages/ai/src/content/breed-guides-safety.spec.ts",
    guards: "the T038 unsafe-text detector run over every string of every breed guide, published and draft alike",
  },
];

/** Repo-relative paths of the web/mobile consumers that pin the shape/values of the hotline dataset (plan finding 4). */
const CONSUMER_PINS: ReadonlyArray<{ path: string; pins: string }> = [
  {
    path: "apps/web/src/food/render.spec.tsx",
    pins: "every poisonHotlineName + displayNumber renders on the food-safety result page",
  },
  {
    path: "apps/web/src/food/build-output.spec.ts",
    pins: "the hotline-info-section renders on every statically built food-safety page",
  },
  {
    path: "apps/mobile/app/check/emergency/[checkId].tsx",
    pins: "the emergency interstitial screen resolves and renders the region hotline before any AI content",
  },
  {
    path: "apps/mobile/__tests__/emergency-interstitial.test.tsx",
    pins: "the emergency interstitial's hotline display behaviour",
  },
  {
    path: "apps/mobile/src/config/hotline-pack.ts",
    pins: "the bundled hotline pack shipped inside the mobile app",
  },
  {
    path: "apps/mobile/__tests__/hotline-pack.test.ts",
    pins: "the bundled hotline pack against the live REGION_HOTLINES dataset",
  },
];

/**
 * Pure computation over the in-memory dataset exports (plan step 4). No
 * dataset row is ever mutated, edited, or "corrected" here — this function
 * only reports.
 */
export function computeDatasetAudit(): DatasetAudit {
  const byCategory = Object.fromEntries(
    TOXIN_CATEGORIES.map((category) => [category, toxins.filter((row) => row.category === category).length]),
  ) as Record<ToxinCategory, number>;

  const sources = TOXIN_CATEGORIES.map((category) => ({
    category,
    file: TOXIN_SOURCE_FILES[category],
    sources: TOXIN_SOURCE_REGISTRY[category],
    rowCount: byCategory[category],
  }));

  const spotCheckRows = topToxinSpotCheck();
  const spotCheck: readonly ToxinSpotCheckRow[] = spotCheckRows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    category: row.category,
    dog: row.verdicts.dog,
    cat: row.verdicts.cat,
    sourceCount: TOXIN_SOURCE_REGISTRY[row.category].length,
    verdictCorrectnessVerifiedByHuman: HOTLINE_VERIFICATION_STATUS,
  }));

  const reviewQueues = {
    nonFoodSafe: toxins
      .filter((row) => row.category !== "human-food" && maxSeverity(row) === FOOD_VERDICT_SEVERITY.safe)
      .map((row) => row.id),
    speciesDivergent: toxins.filter((row) => row.verdicts.dog !== row.verdicts.cat).map((row) => row.id),
    missingQuantityNuance: toxins.filter((row) => row.quantityNuance === undefined).map((row) => row.id),
  };

  const hotlines: readonly HotlineAuditRow[] = REGION_HOTLINES.map((row) => ({
    regionCode: row.regionCode,
    poisonHotlineName: row.poisonHotlineName,
    displayNumber: row.displayNumber,
    dialNumber: row.dialNumber,
    feeNote: row.feeNote,
    source: row.source,
    verifiedByHuman: HOTLINE_VERIFICATION_STATUS,
  }));

  const reviewedGuides = allBreedGuides
    .filter((guide) => guide.reviewed)
    .map(buildInventoryEntry)
    .sort(bySpeciesThenSlug);
  const unreviewedGuides = allBreedGuides
    .filter((guide) => !guide.reviewed)
    .map(buildInventoryEntry)
    .sort(bySpeciesThenSlug);

  return {
    counts: {
      breeds: { dog: dogBreeds.length, cat: catBreeds.length, total: allBreeds.length },
      toxins: { total: toxins.length, byCategory },
      hotlineRegions: REGION_HOTLINES.length,
      breedGuides: {
        total: allBreedGuides.length,
        dog: allBreedGuides.filter((g) => g.species === "DOG").length,
        cat: allBreedGuides.filter((g) => g.species === "CAT").length,
        reviewed: publishedBreedGuides.length,
        unreviewed: allBreedGuides.length - publishedBreedGuides.length,
      },
      careTemplates: { protocolGroups: PROTOCOL_GROUPS.length, lifeStages: LIFE_STAGES.length },
      emergencyPayloads: EMERGENCY_PAYLOADS.length,
    },
    sources,
    spotCheck,
    reviewQueues,
    hotlines,
    breedGuideInventory: { reviewed: reviewedGuides, unreviewed: unreviewedGuides },
    metaTests: META_TESTS,
    consumerPins: CONSUMER_PINS,
  };
}

function tableRow(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function renderCountsSection(audit: DatasetAudit): string[] {
  const { counts } = audit;
  return [
    "## 2. Dataset counts",
    "",
    "| Dataset | Count |",
    "|---|---|",
    tableRow(["Dog breeds", String(counts.breeds.dog)]),
    tableRow(["Cat breeds", String(counts.breeds.cat)]),
    tableRow(["Breeds total", String(counts.breeds.total)]),
    tableRow(["Toxins total", String(counts.toxins.total)]),
    ...TOXIN_CATEGORIES.map((category) => tableRow([`Toxins — ${category}`, String(counts.toxins.byCategory[category])])),
    tableRow(["Hotline regions", String(counts.hotlineRegions)]),
    tableRow(["Breed guides total", String(counts.breedGuides.total)]),
    tableRow(["Breed guides — dog", String(counts.breedGuides.dog)]),
    tableRow(["Breed guides — cat", String(counts.breedGuides.cat)]),
    tableRow(["Breed guides — reviewed (published)", String(counts.breedGuides.reviewed)]),
    tableRow(["Breed guides — unreviewed (draft)", String(counts.breedGuides.unreviewed)]),
    tableRow(["Care-template protocol groups", String(counts.careTemplates.protocolGroups)]),
    tableRow(["Care-template life stages", String(counts.careTemplates.lifeStages)]),
    tableRow(["Emergency payloads", String(counts.emergencyPayloads)]),
    "",
  ];
}

function renderSourcesSection(audit: DatasetAudit): string[] {
  return [
    "## 3. Toxin sources list (category-level — T035 R9)",
    "",
    "Per T035 decision R9, `ToxinRow` (packages/data/src/toxins/schema.ts) carries no per-row source field. Sources were recorded once per category, as a file-header comment in each `packages/data/src/toxins/data/*.ts` file. This is **category-level attribution, not per-verdict citation** — see section 8.",
    "",
    "| Category | Data file | Row count | Sources consulted |",
    "|---|---|---|---|",
    ...audit.sources.map((row) =>
      tableRow([row.category, row.file, String(row.rowCount), row.sources.join(", ")]),
    ),
    "",
  ];
}

function renderSpotCheckSection(audit: DatasetAudit): string[] {
  const nonFoodSafeCount = audit.reviewQueues.nonFoodSafe.length;
  const speciesDivergentCount = audit.reviewQueues.speciesDivergent.length;
  const missingQuantityNuanceCount = audit.reviewQueues.missingQuantityNuance.length;

  return [
    "## 4. Top-100 toxin verdict spot-check",
    "",
    `This section spot-checks ${String(TOP_TOXIN_SPOT_CHECK_SIZE)} of the ${String(audit.counts.toxins.total)} toxin rows against the category-level sources list in section 3.`,
    "",
    '### 4.1 How "top 100" is defined',
    "",
    "`ToxinRow` carries no popularity, commonness, or search-frequency field, so no ranking by \"most commonly searched\" is possible from this dataset. The only severity signal already present is `FOOD_VERDICT_SEVERITY` (`safe:0 < caution:1 < toxic:2 < emergency:3`, `packages/types/src/food-safety.ts`). The rows below are the top 100 by this deterministic order: (1) `max(dog, cat)` severity, descending; (2) `min(dog, cat)` severity, descending; (3) category index in `TOXIN_CATEGORIES`, ascending; (4) `id`, ascending (plain ASCII comparison — ids are already kebab-case, so no locale-dependent comparison is used). This deliberately biases the window toward `toxic`/`emergency` rows, which is the correct bias for a safety spot-check, not toward whatever items are most frequently asked about in the app.",
    "",
    "### 4.2 Mechanical checks vs. human checks",
    "",
    "Mechanical checks — already enforced by the schema meta-tests in section 7 — cover: schema-enum validity of every verdict/category, id/alias-key uniqueness, category-level source presence (section 3), the 5 pinned anchor verdicts, the section-7-numbered dosing/diagnosis language scan, and this document's own doc-to-data drift check. [VET] None of those checks can judge whether a verdict is medically correct for a given species — that is a human judgement. Every one of the 100 rows below therefore carries `UNVERIFIED` in its verdict-correctness column until a licensed veterinarian reviews it.",
    "",
    "### 4.3 The 100 rows",
    "",
    "| Rank | Id | Name | Category | Dog | Cat | Sources | Verdict correctness (human) |",
    "|---|---|---|---|---|---|---|---|",
    ...audit.spotCheck.map((row) =>
      tableRow([
        String(row.rank),
        row.id,
        row.name,
        row.category,
        row.dog,
        row.cat,
        String(row.sourceCount),
        row.verdictCorrectnessVerifiedByHuman,
      ]),
    ),
    "",
    "### 4.4 Review queues for [VET] eyes",
    "",
    "[VET] These three lists are review-priority inventories, not defects — a row appearing below is not asserted to be wrong; it is simply flagged for a human look, prioritised by likelihood of surprise.",
    "",
    `1. Non-food-category rows verdicted \`safe\` at their highest severity (${String(nonFoodSafeCount)}): ${listOrNone(audit.reviewQueues.nonFoodSafe)}`,
    `2. Rows where the dog and cat verdicts differ (${String(speciesDivergentCount)}): ${listOrNone(audit.reviewQueues.speciesDivergent)}`,
    `3. Rows with no \`quantityNuance\` (${String(missingQuantityNuanceCount)}): ${listOrNone(audit.reviewQueues.missingQuantityNuance)}`,
    "",
  ];
}

function listOrNone(ids: readonly string[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function renderHotlineSection(audit: DatasetAudit): string[] {
  return [
    "## 5. Region hotline verification table",
    "",
    "[FOUNDER] Every row below needs a founder/vet check before it can ship as human-verified (standing item `R-hotline-verify`, `packages/data/src/regions/data.ts`). No number has been dialled and no fee note has been checked in this environment.",
    "",
    "| Region | Poison hotline | Display number | Dial number | Fee note | Source | Human verification status |",
    "|---|---|---|---|---|---|---|",
    ...audit.hotlines.map((row) =>
      tableRow([
        row.regionCode,
        row.poisonHotlineName,
        row.displayNumber,
        row.dialNumber,
        row.feeNote ?? "(none — free service)",
        row.source,
        row.verifiedByHuman,
      ]),
    ),
    "",
  ];
}

function renderBreedGuideSection(audit: DatasetAudit): string[] {
  const { reviewed, unreviewed } = audit.breedGuideInventory;
  return [
    "## 6. Breed-guide reviewed-flag inventory",
    "",
    `Of the ${String(audit.counts.breedGuides.total)} generated breed guides, ${String(audit.counts.breedGuides.reviewed)} carry \`reviewed: true\` and ship in-app via \`publishedBreedGuides\`/\`getBreedGuide\`; the remaining ${String(audit.counts.breedGuides.unreviewed)} are drafts awaiting review and are never rendered.`,
    "",
    "| Species | Slug | Generated by | Reviewed by | Reviewed at |",
    "|---|---|---|---|---|",
    ...reviewed.map((entry) =>
      tableRow([entry.species, entry.slug, entry.generatedBy, entry.reviewedBy ?? "", entry.reviewedAt ?? ""]),
    ),
    "",
    "Unreviewed (draft) guides — listed explicitly by slug, no truncation:",
    "",
    "| Species | Slug | Generated by |",
    "|---|---|---|",
    ...unreviewed.map((entry) => tableRow([entry.species, entry.slug, entry.generatedBy])),
    "",
  ];
}

function renderMetaTestsSection(audit: DatasetAudit): string[] {
  return [
    "## 7. Schema meta-tests (AC2)",
    "",
    "AC2 (\"all schema meta-tests green\") is proven by running these existing specs unchanged; this audit does not replace, loosen, or skip any of them.",
    "",
    "| Spec path | What it guards |",
    "|---|---|",
    ...audit.metaTests.map((entry) => tableRow([entry.path, entry.guards])),
    "",
    "### 7.1 Consumer pins outside packages/data",
    "",
    "These web/mobile specs and modules pin the shape and values of the region hotline dataset at its point of use.",
    "",
    "| Path | What it pins |",
    "|---|---|",
    ...audit.consumerPins.map((entry) => tableRow([entry.path, entry.pins])),
    "",
  ];
}

function renderHonestSection(): string[] {
  return [
    "## 8. Honest statement — what was NOT verified here",
    "",
    "<!-- BEGIN:honesty -->",
    "No hotline number was dialled or confirmed in this environment. No veterinary professional reviewed any of the spot-checked verdicts as part of producing this document. This audit used no network access or external source fetch — it is dataset-internal only, computed purely from what already exists in `packages/data`.",
    "<!-- END:honesty -->",
    "",
  ];
}

function renderTodoSection(): string[] {
  return [
    "## 9. C3 human to-do delta",
    "",
    "- [FOUNDER] C3 — verify all 5 poison-hotline rows (US ASPCA APCC, CA Pet Poison Helpline, GB Animal PoisonLine, AU Animal Poisons Helpline, NZ Animal Poisons Helpline): confirm each number against the operator's own published listing and confirm the fee note, then flip the column in a future task (which must also bump `BUNDLED_HOTLINE_PACK_VERSION` if any number changes). Nothing in this audit marks a row as human-checked.",
    "- [VET] C3 — review the 100 spot-check verdicts in section 4.3 for species-appropriate correctness, prioritising the review queues in section 4.4.",
    "- [FOUNDER/CONTENT] Post-C3 — review the unreviewed breed guides listed by slug in section 6; only `reviewed: true` guides ship today.",
    "- [FOUNDER] Confirm that category-level (not per-row) toxin source attribution is acceptable for launch, or open a follow-up card to add a per-row `sources` field to `toxinRowSchema`.",
    "",
  ];
}

/**
 * Deterministic markdown renderer (plan step 5). Pure function of `audit`:
 * no `Date`, no environment/CWD/version value, no randomness, so the output
 * is byte-identical on any machine given the same dataset. Ends with a
 * single trailing newline.
 */
export function renderDatasetAuditDoc(audit: DatasetAudit = computeDatasetAudit()): string {
  const lines: string[] = [
    "# Dataset & seed QA audit — T105",
    "",
    "> GENERATED FILE — do not hand-edit. Regenerate with `pnpm --filter @bombaypetcompany/data qa:dataset-audit`; drift from the live datasets is caught by `packages/data/src/qa/dataset-audit-doc.spec.ts`.",
    "",
    "## 1. Scope & method",
    "",
    "This audit is generated directly from the datasets in `packages/data` by `computeDatasetAudit()` / `renderDatasetAuditDoc()` (`packages/data/src/qa/dataset-audit.ts`). It reports dataset counts, a deterministic top-100 toxin-verdict spot-check, a region hotline verification table, and a breed-guide reviewed-flag inventory. It does not verify anything against the outside world — see section 8.",
    "",
    ...renderCountsSection(audit),
    ...renderSourcesSection(audit),
    ...renderSpotCheckSection(audit),
    ...renderHotlineSection(audit),
    ...renderBreedGuideSection(audit),
    ...renderMetaTestsSection(audit),
    ...renderHonestSection(),
    ...renderTodoSection(),
  ];

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}
