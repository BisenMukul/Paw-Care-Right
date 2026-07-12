import type { TextMessage } from "../providers/types";

import { EXEMPLAR_MESSAGES } from "./exemplars";
import { buildSystemPrompt } from "./system-prompt";
import type { BuiltTriagePrompt, TriagePromptInput } from "./types";
import { buildUserTurn } from "./user-turn";
import { TRIAGE_PROMPT_VERSION } from "./version";

/**
 * Assembles the full triage prompt (T033): static system prompt + few-shot
 * exemplar messages + the current user turn, at temperature 0, tagged with
 * the current prompt version.
 */
export function buildTriagePrompt(input: TriagePromptInput): BuiltTriagePrompt {
  const userMessage: TextMessage = { role: "user", content: buildUserTurn(input) };

  return {
    system: buildSystemPrompt(),
    messages: [...EXEMPLAR_MESSAGES, userMessage],
    temperature: 0,
    version: TRIAGE_PROMPT_VERSION,
  };
}
