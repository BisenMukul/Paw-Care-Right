import type { Sex, Species, Urgency } from "@pawcareright/types";

/**
 * The deterministic red-flag rules engine (SPEC §5 rule 3 — "the red-flag
 * rules table is code, not AI"). This module declares the data-driven types
 * consumed by `rules-table.ts` and `engine.ts`. Zero provider imports, zero
 * zod (the intake here is trusted, produced upstream by T032 — plan R2).
 */

export const SIZE_CLASSES = ["TOY", "SMALL", "MEDIUM", "LARGE", "GIANT"] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

/**
 * Structured-sign vocabulary the app collects via checkboxes. T032's richer
 * intake maps INTO this vocabulary (plan R2/contract) — this is the single
 * exported source of truth for the sign names.
 */
export const RED_FLAG_SIGNS = [
  "toxin_ingestion",
  "chocolate_ingestion",
  "xylitol_ingestion",
  "rodenticide_exposure",
  "retching_unproductive",
  "distended_abdomen",
  "straining_to_urinate",
  "blood_in_urine",
  "seizure_prolonged_or_repeated",
  "collapse_unresponsive",
  "abnormal_gum_color",
  "breathing_difficulty",
  "uncontrolled_bleeding",
  "heatstroke",
  "envenomation",
  "major_trauma",
  "ocular_emergency",
  "unable_to_stand",
  "linear_foreign_body",
  "open_fracture_or_deep_wound",
  "birthing_distress",
  "neonatal_collapse",
] as const;
export type RedFlagSign = (typeof RED_FLAG_SIGNS)[number];

/**
 * Minimal input shape the engine operates on. T032 will map its richer
 * intake into this shape. Every field except `species` is optional.
 */
export interface RedFlagIntake {
  species: Species; // always present
  sex?: Sex; // MALE | FEMALE | UNKNOWN
  ageMonths?: number;
  weightKg?: number;
  sizeClass?: SizeClass;
  signs?: Partial<Record<RedFlagSign, boolean>>; // structured checkboxes
  freeText?: string; // owner's typed description
}

// ---- Predicate / matcher DSL (data-driven for auditability — plan R3) ----

export type IntakePredicate =
  | { field: "species"; op: "eq"; value: Species }
  | { field: "species"; op: "in"; value: readonly Species[] }
  | { field: "sex"; op: "in"; value: readonly Sex[] } // undefined sex ⇒ MATCH (fail-upward, plan R6)
  | { field: "ageMonths"; op: "lte" | "gte"; value: number } // undefined ⇒ no match
  | { field: "weightKg"; op: "lte" | "gte"; value: number } // undefined ⇒ no match
  | { field: "sign"; sign: RedFlagSign }; // matches iff signs[sign] === true

/** Matches iff normalizedText contains ANY of the stored (pre-normalized) phrases. */
export interface KeywordLeaf {
  kw: readonly string[];
}

export type Matcher =
  | IntakePredicate
  | KeywordLeaf
  | { allOf: readonly Matcher[] }
  | { anyOf: readonly Matcher[] };

export interface RedFlagRule {
  id: string; // kebab-case, unique
  species: Species | "ANY";
  tierFloor: Urgency; // v1: all EMERGENCY_NOW (field future-proofs VET_24H — plan R7)
  emergencyPayloadKey: string; // stable key T036 consumes for interstitial content
  label: string; // neutral internal descriptor for logs/evals (§7-clean)
  sourceRef: string; // "SPEC §6.2: <verbatim>" or "extra: <justification>" (audit trail)
  match: Matcher;
}

export interface RedFlagMatch {
  ruleId: string;
  species: Species | "ANY";
  tierFloor: Urgency;
  emergencyPayloadKey: string;
  label: string;
}

export interface RedFlagEvaluation {
  matched: RedFlagMatch[]; // all matches, sorted most-urgent first
  highest: RedFlagMatch | null; // matched[0] ?? null
}
