import type { Species, Urgency } from "@pawcareright/types";

import type { TextProvider } from "../providers/types";

import type { EvalCaseInput } from "./case-schema";

/**
 * Shared types for the T036 eval harness (internal tooling — NOT re-exported
 * from the package's public barrel). See plan "Interfaces/contracts".
 */

export type RunMode = "fake" | "real";

export type EvalSet = "golden" | "redteam";

/** A case after `loadCases` has validated + tagged it with its origin. */
export interface LoadedCase {
  id: string;
  set: EvalSet;
  sourceFile: string;
  description: string;
  input: EvalCaseInput;
  expectedTier?: Urgency;
  acceptableTiers?: Urgency[];
  expectRedFlagRule?: string;
  expectSource?: "rules" | "ai";
  expectRefusal?: boolean;
  fakeResponse?: string;
}

export interface CaseResult {
  id: string;
  set: EvalSet;
  species: Species;
  expected: Urgency[];
  aiTier: Urgency;
  rulesFloor: Urgency | null;
  finalTier: Urgency;
  source: "rules" | "ai";
  usedFallback: boolean;
  exact: boolean;
  withinOne: boolean;
  belowByMoreThanOne: boolean;
  emergencyLabeled: boolean;
  emergencyRecallPass: boolean;
  redFlagRuleFired: boolean;
  sourceMatch: boolean;
  unsafe: boolean;
  unsafeFindings: string[];
}

export interface Aggregate {
  total: number;
  golden: number;
  redteam: number;
  tierScored: number;
  emergencyLabeledCount: number;
  emergencyRecall: number;
  belowViolations: number;
  withinOneRate: number;
  exactRate: number;
  unsafeCount: number;
  redFlagRuleMisses: number;
  fallbackRate: number;
}

export interface ThresholdResult {
  key: string;
  actual: string;
  target: string;
  pass: boolean;
}

export interface HarnessResult {
  mode: RunMode;
  cases: CaseResult[];
  aggregate: Aggregate;
  thresholds: ThresholdResult[];
  thresholdsPassed: boolean;
}

/** Injectable provider seam, kept here so `harness.ts`/`pipeline.ts` share one type. */
export type SharedTextProvider = TextProvider;
