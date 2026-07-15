import { VET_SUMMARY_DISCLAIMER, VET_SUMMARY_MAX_CHARS, type Urgency } from "@pawcareright/types";

/**
 * `buildVetSummary` (T068 plan decision 6): a PURE, deterministic function
 * that assembles a plain-text vet-visit-prep RECORD digest from already
 * pet-scoped, already 90-day-windowed rows. No prisma, no `Date.now()`, no
 * clock of any kind -- every date printed comes from a row's own
 * `occurredAt`/`createdAt` (plan decision 3/4), so the output is a pure
 * function of `input` and the golden-file test is fully deterministic.
 *
 * Section order is fixed (plan decision 1, high -> low priority):
 * `[header, weight trend, symptom checks, medications given, notes]`, then
 * the `VET_SUMMARY_DISCLAIMER` footer. The header and weight-trend blocks
 * are intrinsically bounded/tiny (one pet, first/latest weight only) so
 * they are always emitted in full, never subject to the char budget. The
 * three list sections are appended in that fixed order via a greedy
 * keep-order fill against `budget = VET_SUMMARY_MAX_CHARS - footer.length -
 * SECTION_SEPARATOR.length`: newest-first items are added while they fit;
 * the moment an item would overflow, a single deterministic truncation
 * marker is emitted (only if the marker itself fits) and NO further
 * lower-priority section is added at all (plan decision 2). This guarantees
 * `output.length <= VET_SUMMARY_MAX_CHARS` and `output.endsWith(footer)` in
 * every case -- the footer is appended last, unconditionally, and is never
 * itself subject to truncation.
 *
 * Tier labels and section headings are local, server-only copy (no drift
 * risk -- the golden test imports this module directly); only the
 * disclaimer footer is promoted to `@pawcareright/types` (plan decision 6).
 */

export interface VetSummaryInput {
  pet: { name: string; species: string; ageEstimateMonths: number | null; birthDate: Date | null };
  /** Ascending (oldest first) -- only the first/latest points are used. */
  weights: Array<{ occurredAt: Date; grams: number }>;
  /** Newest-first. */
  checks: Array<{ createdAt: Date; tier: Urgency | null }>;
  /** Newest-first. */
  medsGiven: Array<{ occurredAt: Date; nameAsEntered: string | null; doseAsEntered: string | null }>;
  /** Newest-first. */
  notes: Array<{ occurredAt: Date; text: string }>;
}

const HEADER_TITLE = "Health record summary — last 90 days";
const WEIGHT_HEADING = "Weight trend:";
const CHECKS_HEADING = "Symptom checks:";
const MEDS_HEADING = "Medications given:";
const NOTES_HEADING = "Notes:";

const NO_WEIGHT_LINE = "No weight entries.";
const NO_CHECKS_LINE = "No symptom checks.";
const NO_MEDS_LINE = "No medications recorded.";
const NO_NOTES_LINE = "No notes.";

const AWAITING_ASSESSMENT = "awaiting assessment";
const MED_GIVEN_FALLBACK = "Medication given";

/** Neutral, record-framed tier labels (CLAUDE §7 -- recorded assessments, not new guidance). */
const TIER_LABEL: Record<Urgency, string> = {
  EMERGENCY_NOW: "emergency now",
  VET_24H: "vet within 24 hours",
  VET_SOON: "vet soon",
  MONITOR: "monitor at home",
  REASSURE: "reassurance",
};

const NOTE_EXCERPT_MAX_CHARS = 120;
const SECTION_SEPARATOR = "\n\n";
const OVERFLOW_MARKER = "… (older entries omitted to keep this summary short)";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatKg(grams: number): string {
  return (grams / 1000).toFixed(2);
}

function ageClause(pet: VetSummaryInput["pet"]): string | null {
  if (pet.ageEstimateMonths !== null) {
    return `~${pet.ageEstimateMonths} months`;
  }
  if (pet.birthDate !== null) {
    return `born ${formatDate(pet.birthDate)}`;
  }
  return null;
}

function buildHeaderBlock(pet: VetSummaryInput["pet"]): string {
  const clause = ageClause(pet);
  const petLine = `Pet: ${pet.name} (${pet.species}${clause !== null ? `, ${clause}` : ""})`;
  return [HEADER_TITLE, petLine].join("\n");
}

function buildWeightBlock(weights: VetSummaryInput["weights"]): string {
  if (weights.length === 0) {
    return `${WEIGHT_HEADING}\n${NO_WEIGHT_LINE}`;
  }

  if (weights.length === 1) {
    const only = weights[0]!;
    return `${WEIGHT_HEADING}\nLatest: ${formatKg(only.grams)} kg on ${formatDate(only.occurredAt)}.`;
  }

  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  const deltaKg = (last.grams - first.grams) / 1000;
  const sign = deltaKg >= 0 ? "+" : "";

  return [
    WEIGHT_HEADING,
    `First: ${formatKg(first.grams)} kg on ${formatDate(first.occurredAt)}.`,
    `Latest: ${formatKg(last.grams)} kg on ${formatDate(last.occurredAt)} (${sign}${deltaKg.toFixed(2)} kg since first).`,
  ].join("\n");
}

function checkLine(check: VetSummaryInput["checks"][number]): string {
  const label = check.tier !== null ? TIER_LABEL[check.tier] : AWAITING_ASSESSMENT;
  return `${formatDate(check.createdAt)}: ${label}`;
}

function medLine(med: VetSummaryInput["medsGiven"][number]): string {
  const date = formatDate(med.occurredAt);
  if (med.nameAsEntered !== null && med.doseAsEntered !== null) {
    return `${date}: ${med.nameAsEntered} — ${med.doseAsEntered}`;
  }
  if (med.nameAsEntered !== null) {
    return `${date}: ${med.nameAsEntered}`;
  }
  if (med.doseAsEntered !== null) {
    return `${date}: ${MED_GIVEN_FALLBACK} — ${med.doseAsEntered}`;
  }
  return `${date}: ${MED_GIVEN_FALLBACK}`;
}

function noteLine(note: VetSummaryInput["notes"][number]): string {
  const excerpt =
    note.text.length > NOTE_EXCERPT_MAX_CHARS ? `${note.text.slice(0, NOTE_EXCERPT_MAX_CHARS)}…` : note.text;
  return `${formatDate(note.occurredAt)}: ${excerpt}`;
}

/** Whether `[...parts, candidate].join(SECTION_SEPARATOR)` still fits inside `budget`. */
function fits(parts: readonly string[], candidate: string, budget: number): boolean {
  return [...parts, candidate].join(SECTION_SEPARATOR).length <= budget;
}

/**
 * Appends one bounded list section (checks/meds/notes) to `parts` in place.
 * Returns `true` when this section overflowed (item(s) omitted) -- the
 * caller must then add NO further lower-priority section (plan decision 2).
 */
function addListSection(
  parts: string[],
  budget: number,
  heading: string,
  emptyLine: string,
  itemLines: readonly string[],
): boolean {
  if (itemLines.length === 0) {
    const candidate = `${heading}\n${emptyLine}`;
    if (fits(parts, candidate, budget)) {
      parts.push(candidate);
    }
    return false;
  }

  const included: string[] = [];
  for (const line of itemLines) {
    const candidateBlock = `${heading}\n${[...included, line].join("\n")}`;
    if (fits(parts, candidateBlock, budget)) {
      included.push(line);
      continue;
    }

    const markerBlock = `${heading}\n${[...included, OVERFLOW_MARKER].join("\n")}`;
    if (fits(parts, markerBlock, budget)) {
      parts.push(markerBlock);
    } else if (included.length > 0) {
      parts.push(`${heading}\n${included.join("\n")}`);
    }
    // else: nothing for this section fits at all -- it is omitted entirely.
    return true;
  }

  parts.push(`${heading}\n${included.join("\n")}`);
  return false;
}

export function buildVetSummary(input: VetSummaryInput): string {
  const parts: string[] = [buildHeaderBlock(input.pet), buildWeightBlock(input.weights)];
  const footer = VET_SUMMARY_DISCLAIMER;
  const budget = VET_SUMMARY_MAX_CHARS - footer.length - SECTION_SEPARATOR.length;

  let overflowed = addListSection(parts, budget, CHECKS_HEADING, NO_CHECKS_LINE, input.checks.map(checkLine));

  if (!overflowed) {
    overflowed = addListSection(
      parts,
      budget,
      MEDS_HEADING,
      NO_MEDS_LINE,
      input.medsGiven.map(medLine),
    );
  }

  if (!overflowed) {
    addListSection(parts, budget, NOTES_HEADING, NO_NOTES_LINE, input.notes.map(noteLine));
  }

  return `${parts.join(SECTION_SEPARATOR)}${SECTION_SEPARATOR}${footer}`;
}
