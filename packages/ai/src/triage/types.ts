import type { CompletedIntake, Sex, Species, TriageResult, Urgency } from "@pawcareright/types";

import type { ProviderUsage, TextMessage, TextProvider } from "../providers/types";

/**
 * Pure TS interfaces for the triage prompt layer (T033). No zod here — the
 * app-side `@pawcareright/types` schemas remain the single validation source
 * of truth (`parseTriage`, T030).
 *
 * `TriagePetContext` structurally contains ONLY whitelisted pet fields — no
 * email/householdId/userId/ownerName field exists, so none can ever be
 * serialized into a prompt (plan R9, "no PII beyond pet context").
 */
export interface TriagePetContext {
  name: string;
  species: Species;
  breedLabel?: string;
  sex?: Sex;
  ageMonths?: number;
  weightKg?: number;
  neutered?: boolean;
}

export interface TriagePromptInput {
  pet: TriagePetContext;
  intake: CompletedIntake;
}

export interface BuiltTriagePrompt {
  system: string;
  messages: TextMessage[];
  temperature: number;
  version: string;
}

export interface TriageExemplar {
  id: string;
  species: Species;
  tier: Urgency;
  userText: string;
  output: TriageResult;
}

export type TriageOutcomeStatus = "OK" | "REPAIRED" | "SAFE_FALLBACK";

export interface RunTriageDeps {
  provider: TextProvider;
}

export interface TriageRunResult {
  status: TriageOutcomeStatus;
  result: TriageResult;
  version: string;
  attempts: number;
  usage?: ProviderUsage;
  failureReason?: string;
}
