/**
 * Static triage prompt version registry (T033). No `Date.now`/random — every
 * value here is fixed data, embedded verbatim in the system prompt footer
 * and returned as `BuiltTriagePrompt.version`.
 */

export const TRIAGE_PROMPT_VERSION = "triage-v1";

export interface TriagePromptVersionEntry {
  version: string;
  notes: string;
}

export const TRIAGE_PROMPT_REGISTRY: Record<string, TriagePromptVersionEntry> = {
  "triage-v1": {
    version: "triage-v1",
    notes:
      "Initial triage prompt: static safety system prompt, 8 few-shot exemplars spanning all tiers and both species, JSON-only output contract, temperature 0.",
  },
};
