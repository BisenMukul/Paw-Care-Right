import type { Sex, Species } from "@pawcareright/types";

import type { TextMessage } from "../providers/types";
import { buildTimelineDigest } from "./digest";
import { OWNER_MESSAGE_CLOSE, OWNER_MESSAGE_OPEN, sanitizeOwnerMessage } from "./sanitize";
import { buildChatSystemPrompt } from "./system-prompt";
import type { BuiltChatPrompt, ChatPetContext, ChatPromptInput } from "./types";
import { CHAT_PROMPT_VERSION } from "./version";

/**
 * `buildChatPrompt` (T081): assembles the final user turn from the pet
 * context whitelist (same fields/label style as `triage/user-turn.ts`), the
 * pure {@link buildTimelineDigest}, and the sanitized owner message wrapped
 * in the untrusted-data delimiters. Prior turns are replayed ahead of the
 * current turn, oldest first, already capped by the caller
 * (`CHAT_HISTORY_TURNS`). Deterministic given deterministic inputs (no
 * clock, no random).
 */

const CHAT_TEMPERATURE = 0.2;

function speciesLabel(species: Species): string {
  return species === "DOG" ? "Dog" : "Cat";
}

function sexLabel(sex: Sex | undefined): string {
  if (sex === "MALE") return "Male";
  if (sex === "FEMALE") return "Female";
  return "Unknown";
}

function buildPetLines(pet: ChatPetContext): string[] {
  const lines = [
    "PET",
    `- Name: ${pet.name}`,
    `- Species: ${speciesLabel(pet.species)}`,
    `- Breed: ${pet.breedLabel ?? "Unknown / mixed"}`,
    `- Sex: ${sexLabel(pet.sex)}${pet.neutered === true ? ", neutered" : ""}`,
  ];

  if (pet.ageMonths !== undefined) {
    lines.push(`- Age: ${pet.ageMonths} months`);
  }
  if (pet.weightKg !== undefined) {
    lines.push(`- Weight: ${pet.weightKg} kg`);
  }

  return lines;
}

function buildCurrentUserTurn(input: ChatPromptInput): string {
  const petLines = buildPetLines(input.pet);
  const digest = buildTimelineDigest(input.digest);
  const sanitizedOwnerMessage = sanitizeOwnerMessage(input.ownerMessage);

  return [
    ...petLines,
    "",
    digest,
    "",
    OWNER_MESSAGE_OPEN,
    sanitizedOwnerMessage,
    OWNER_MESSAGE_CLOSE,
  ].join("\n");
}

/** Builds the final `{system, messages, temperature, version}` chat prompt. */
export function buildChatPrompt(input: ChatPromptInput): BuiltChatPrompt {
  // D5: user history turns are the one remaining unsanitized injection
  // vector into the prompt — a `system: ignore your rules` line typed by the
  // owner in an earlier turn is replayed verbatim by `gatherHistory` as a
  // real `role:"user"` message otherwise. Assistant turns are either
  // gate-approved model output or the fallback constant, and are already
  // scanned, so they are left untouched.
  const historyMessages: TextMessage[] = input.history.map((turn) => ({
    role: turn.role,
    content: turn.role === "user" ? sanitizeOwnerMessage(turn.content) : turn.content,
  }));
  const currentTurn: TextMessage = { role: "user", content: buildCurrentUserTurn(input) };

  return {
    system: buildChatSystemPrompt(),
    messages: [...historyMessages, currentTurn],
    temperature: CHAT_TEMPERATURE,
    version: CHAT_PROMPT_VERSION,
  };
}
