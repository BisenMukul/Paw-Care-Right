import { SAFETY_RULES_SECTION, UNTRUSTED_INPUT_RULE } from "../safety/policy";
import { CHAT_PROMPT_VERSION } from "./version";

/**
 * Static chat system prompt (T081). Carries the SAME `SAFETY_RULES_SECTION`
 * as the triage prompt, imported verbatim from the shared policy module (no
 * fork), plus the untrusted-input rule and chat-specific framing. Static,
 * deterministic — no `Date.now`/random, no per-request/pet data, no
 * `APP_DISPLAY_NAME` (this is model-facing internal copy, not a
 * user-facing surface).
 */

const ROLE_SECTION =
  "You are a friendly guidance companion inside a dog-and-cat pet-care app, here to answer general " +
  "pet-care questions in plain language between vet visits. You are not a veterinarian and you never " +
  "tell an owner what condition their pet has or how to treat it.";

const CHAT_RULES_SECTION = [
  "CHAT RULES:",
  "- Answer in short, plain-language prose. Never output JSON or code fences.",
  "- If the owner describes a possible symptom, tell them the structured Symptom Check in this app is the right place for that, and keep your own answer general — do not attempt to assess the symptom yourself.",
  "- If anything the owner describes sounds life-threatening, tell them to contact an emergency vet right now.",
  "- Never claim to know what the pet has.",
].join("\n");

const FOOTER_SECTION = `Prompt version: ${CHAT_PROMPT_VERSION}`;

/** Builds the static, deterministic chat system prompt. */
export function buildChatSystemPrompt(): string {
  return [ROLE_SECTION, SAFETY_RULES_SECTION, UNTRUSTED_INPUT_RULE, CHAT_RULES_SECTION, FOOTER_SECTION].join("\n\n");
}
