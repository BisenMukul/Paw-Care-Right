import type { Urgency } from "@bombaypetcompany/types";

import type { TimelineDigestInput } from "./types";

/**
 * `buildTimelineDigest` (T081 plan decision D4): a PURE, deterministic
 * function that assembles a plain-text, model-facing, RECORDS-ONLY 90-day
 * timeline digest from already pet-scoped, already 90-day-windowed rows. No
 * prisma, no `Date.now()`, no clock — every date printed comes from a row's
 * own `occurredAt`/`createdAt` field. Mirrors `buildVetSummary`'s general
 * shape (fixed section order, greedy-fill char budget) but is a distinct
 * projection: by decision D6 it carries NO medication names or doses at
 * all, only a count — the single largest §7 rule-2 leakage surface for a
 * free-form text answer is removed entirely.
 *
 * Section order is fixed (high -> low priority): header, weight
 * first/latest, symptom checks (max `DIGEST_MAX_CHECKS`), notes (max
 * `DIGEST_MAX_NOTES`), then the medication COUNT line — always appended in
 * full, never itself subject to truncation (same posture as
 * `buildVetSummary`'s disclaimer footer). Empty sources render an explicit
 * "none recorded" line. The whole digest is hard-capped at
 * `DIGEST_MAX_CHARS` by dropping lowest-priority items first, then omitting
 * whole lower-priority sections once a higher one has overflowed.
 */

export const DIGEST_MAX_CHECKS = 8;
export const DIGEST_MAX_NOTES = 8;
export const DIGEST_MAX_CHARS = 1500;

const HEADER_TITLE = "TIMELINE (LAST 90 DAYS, RECORDED FACTS ONLY)";
const WEIGHT_HEADING = "Weight:";
const CHECKS_HEADING = "Symptom checks:";
const NOTES_HEADING = "Notes:";

const NO_WEIGHT_LINE = "No weight entries recorded.";
const NO_CHECKS_LINE = "No symptom checks recorded.";
const NO_NOTES_LINE = "No notes recorded.";

const AWAITING_ASSESSMENT = "awaiting assessment";

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
const OVERFLOW_MARKER = "… (older entries omitted)";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Spells out "kilograms" rather than the "kg" abbreviation deliberately: the
 * shared `scanUnsafeText` DOSING pattern matches any bare `NUMBER kg` token
 * (it cannot distinguish a body-weight record from a medication dose), and
 * this digest's own spec requires `scanUnsafeText(digest)` to be clean.
 * Spelling the unit out avoids that false positive without changing the
 * recorded fact.
 */
function formatKilograms(grams: number): string {
  return (grams / 1000).toFixed(2);
}

function buildWeightBlock(weights: TimelineDigestInput["weights"]): string {
  if (weights.length === 0) {
    return `${WEIGHT_HEADING}\n${NO_WEIGHT_LINE}`;
  }

  if (weights.length === 1) {
    const only = weights[0]!;
    return `${WEIGHT_HEADING}\nLatest: ${formatKilograms(only.grams)} kilograms on ${formatDate(only.occurredAt)}.`;
  }

  const first = weights[0]!;
  const last = weights[weights.length - 1]!;
  const deltaKg = (last.grams - first.grams) / 1000;
  const sign = deltaKg >= 0 ? "+" : "";

  return [
    WEIGHT_HEADING,
    `First: ${formatKilograms(first.grams)} kilograms on ${formatDate(first.occurredAt)}.`,
    `Latest: ${formatKilograms(last.grams)} kilograms on ${formatDate(last.occurredAt)} (${sign}${deltaKg.toFixed(2)} kilograms since first).`,
  ].join("\n");
}

function checkLine(check: TimelineDigestInput["checks"][number]): string {
  const label = check.tier !== null ? TIER_LABEL[check.tier] : AWAITING_ASSESSMENT;
  return `${formatDate(check.createdAt)}: ${label}`;
}

function noteLine(note: TimelineDigestInput["notes"][number]): string {
  const excerpt =
    note.text.length > NOTE_EXCERPT_MAX_CHARS ? `${note.text.slice(0, NOTE_EXCERPT_MAX_CHARS)}…` : note.text;
  return `${formatDate(note.occurredAt)}: ${excerpt}`;
}

/** Whether `[...parts, candidate].join(SECTION_SEPARATOR)` still fits inside `budget`. */
function fits(parts: readonly string[], candidate: string, budget: number): boolean {
  return [...parts, candidate].join(SECTION_SEPARATOR).length <= budget;
}

/**
 * Appends one bounded list section (checks/notes) to `parts` in place.
 * Returns `true` when this section overflowed (item(s) omitted) -- the
 * caller must then add NO further lower-priority section.
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
    return true;
  }

  parts.push(`${heading}\n${included.join("\n")}`);
  return false;
}

/** Builds the deterministic, records-only, model-facing 90-day timeline digest (T081). */
export function buildTimelineDigest(input: TimelineDigestInput): string {
  const parts: string[] = [HEADER_TITLE, buildWeightBlock(input.weights)];

  const medLine = `Medication doses recorded (last 90 days): ${input.medicationDoseCount}`;
  const budget = DIGEST_MAX_CHARS - medLine.length - SECTION_SEPARATOR.length;

  let overflowed = addListSection(
    parts,
    budget,
    CHECKS_HEADING,
    NO_CHECKS_LINE,
    input.checks.slice(0, DIGEST_MAX_CHECKS).map(checkLine),
  );

  if (!overflowed) {
    overflowed = addListSection(
      parts,
      budget,
      NOTES_HEADING,
      NO_NOTES_LINE,
      input.notes.slice(0, DIGEST_MAX_NOTES).map(noteLine),
    );
  }

  return `${parts.join(SECTION_SEPARATOR)}${SECTION_SEPARATOR}${medLine}`;
}
