import type { Sex, Species, SymptomCategory, Urgency } from "@pawcareright/types";

import type { TextMessage } from "../providers/types";

/**
 * Pure TS interfaces for the chat prompt layer (T081). `ChatPetContext`
 * structurally contains ONLY the same whitelisted pet fields as
 * `TriagePetContext` — no email/householdId/userId/ownerName field exists,
 * so none can ever be serialized into a prompt.
 */
export interface ChatPetContext {
  name: string;
  species: Species;
  breedLabel?: string;
  sex?: Sex;
  neutered?: boolean;
  ageMonths?: number;
  weightKg?: number;
}

/**
 * Already-90d-windowed rows handed to the PURE {@link buildTimelineDigest}
 * (T081 plan decision D4) — mirrors `VetSummaryInput`'s shape but is a
 * distinct, records-only, no-med-names projection (D6).
 */
export interface TimelineDigestInput {
  /** Ascending (oldest first) — only first/latest are used. */
  weights: Array<{ occurredAt: Date; grams: number }>;
  /** Newest-first. */
  checks: Array<{ createdAt: Date; tier: Urgency | null }>;
  /** Newest-first. */
  notes: Array<{ occurredAt: Date; text: string }>;
  /** COUNT ONLY (D6) — no medication names or doses ever enter the digest. */
  medicationDoseCount: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatPromptInput {
  pet: ChatPetContext;
  digest: TimelineDigestInput;
  /** Prior turns, already capped by the caller (`CHAT_HISTORY_TURNS`), oldest first. */
  history: ChatTurn[];
  /** Raw owner message text — sanitized inside `buildChatPrompt`. */
  ownerMessage: string;
}

export interface BuiltChatPrompt {
  system: string;
  messages: TextMessage[];
  temperature: number;
  version: string;
}

/** Re-exported for chat module consumers that need the category type. */
export type { SymptomCategory };
