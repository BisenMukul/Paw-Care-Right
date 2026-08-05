import { SAFETY_RULES_SECTION, UNTRUSTED_INPUT_RULE } from "../safety/policy";
import { CHAT_PROMPT_VERSION } from "./version";
import { buildChatSystemPrompt } from "./system-prompt";

describe("buildChatSystemPrompt", () => {
  it("is deterministic across calls", () => {
    expect(buildChatSystemPrompt()).toBe(buildChatSystemPrompt());
  });

  it("embeds the shared SAFETY_RULES_SECTION verbatim (anti-fork assertion)", () => {
    expect(buildChatSystemPrompt().includes(SAFETY_RULES_SECTION)).toBe(true);
  });

  it("contains the untrusted-input rule", () => {
    expect(buildChatSystemPrompt()).toContain(UNTRUSTED_INPUT_RULE);
  });

  it("contains the version footer", () => {
    expect(buildChatSystemPrompt()).toContain(`Prompt version: ${CHAT_PROMPT_VERSION}`);
  });

  it("contains no pet data", () => {
    const prompt = buildChatSystemPrompt();
    expect(prompt).not.toMatch(/PET\n/);
    expect(prompt).not.toMatch(/Species:/);
  });

  it("instructs plain-language prose with no JSON", () => {
    expect(buildChatSystemPrompt()).toMatch(/Never output JSON or code fences/i);
  });

  it("instructs redirecting symptom talk to the structured Symptom Check", () => {
    expect(buildChatSystemPrompt()).toMatch(/structured Symptom Check/i);
  });

  it("instructs escalating life-threatening signs to an emergency vet now", () => {
    expect(buildChatSystemPrompt()).toMatch(/contact an emergency vet right now/i);
  });
});
