import { parseTriage, SAFE_FALLBACK } from "@pawcareright/types";

import type { TextMessage } from "../providers/types";

import { buildTriagePrompt } from "./build";
import { extractJsonCandidate } from "./extract-json";
import { buildRepairPrompt } from "./repair";
import type { RunTriageDeps, TriagePromptInput, TriageRunResult } from "./types";
import { TRIAGE_PROMPT_VERSION } from "./version";

/**
 * Provider-injected triage orchestration (T033): build -> provider -> extract
 * -> `parseTriage` -> one repair retry -> frozen `SAFE_FALLBACK`. NEVER
 * throws (Decision R6) and NEVER returns unvalidated data — the returned
 * `result` is always either a `parseTriage`-validated `TriageResult` or the
 * exact `SAFE_FALLBACK` constant (plan R5, §5 rule 2 / CLAUDE §7 rule 5).
 * No BullMQ/api/vision wiring here — that is layered by T043.
 */
export async function runTriage(input: TriagePromptInput, deps: RunTriageDeps): Promise<TriageRunResult> {
  const built = buildTriagePrompt(input);
  let attempts = 0;

  try {
    attempts = 1;
    const res1 = await deps.provider.generate({
      system: built.system,
      messages: built.messages,
      temperature: 0,
    });

    const parsed1 = parseTriage(extractJsonCandidate(res1.text));
    if (parsed1.ok) {
      return {
        status: "OK",
        result: parsed1.result,
        version: TRIAGE_PROMPT_VERSION,
        attempts,
        usage: res1.usage,
      };
    }

    const messages2: TextMessage[] = [
      ...built.messages,
      { role: "assistant", content: res1.text },
      { role: "user", content: buildRepairPrompt(parsed1.reason) },
    ];

    attempts = 2;
    const res2 = await deps.provider.generate({
      system: built.system,
      messages: messages2,
      temperature: 0,
    });

    const parsed2 = parseTriage(extractJsonCandidate(res2.text));
    if (parsed2.ok) {
      return {
        status: "REPAIRED",
        result: parsed2.result,
        version: TRIAGE_PROMPT_VERSION,
        attempts,
        usage: res2.usage,
      };
    }

    return {
      status: "SAFE_FALLBACK",
      result: SAFE_FALLBACK,
      version: TRIAGE_PROMPT_VERSION,
      attempts,
      failureReason: parsed2.reason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "SAFE_FALLBACK",
      result: SAFE_FALLBACK,
      version: TRIAGE_PROMPT_VERSION,
      attempts,
      failureReason: message,
    };
  }
}
