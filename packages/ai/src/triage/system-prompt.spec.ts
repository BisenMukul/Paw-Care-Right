import { TRIAGE_SCHEMA_TEXT } from "./schema-text";
import { buildSystemPrompt } from "./system-prompt";

describe("buildSystemPrompt", () => {
  it("matches the static prompt (snapshot)", () => {
    expect(buildSystemPrompt()).toMatchSnapshot();
  });

  it("is deterministic across calls", () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt());
  });

  it("instructs never to use the words diagnosis/diagnose", () => {
    expect(buildSystemPrompt()).toMatch(/never use the words "diagnosis" or "diagnose"/i);
  });

  it("instructs never to give medication dosages or recommend/name a drug", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/never give medication dosages/i);
    expect(prompt).toMatch(/never recommend or name a drug to give/i);
    expect(prompt).toMatch(/never tell an owner to administer any human medication/i);
  });

  it("instructs fail-upward on missing/ambiguous/conflicting information", () => {
    expect(buildSystemPrompt()).toMatch(/choose the more urgent tier and lower confidence/i);
  });

  it("instructs a one-tier cat urgency bias", () => {
    expect(buildSystemPrompt()).toMatch(/treat a cat as one tier more urgent than a dog/i);
  });

  it("restricts homeCare to VET_SOON/MONITOR/REASSURE and requires it empty on emergency tiers", () => {
    expect(buildSystemPrompt()).toMatch(
      /homeCare` is allowed ONLY when urgency is VET_SOON, MONITOR, or REASSURE, and MUST be empty for EMERGENCY_NOW or VET_24H/,
    );
  });

  it("requires a low-confidence result to be at least VET_SOON", () => {
    expect(buildSystemPrompt()).toMatch(/A low-confidence result must be at least VET_SOON/);
  });

  it("embeds TRIAGE_SCHEMA_TEXT", () => {
    expect(buildSystemPrompt()).toContain(TRIAGE_SCHEMA_TEXT);
  });

  it("contains the return-only-JSON output-contract instruction", () => {
    expect(buildSystemPrompt()).toContain(
      "Return ONLY a single JSON object matching the schema below. No markdown, no code fences, no text before or after the JSON.",
    );
  });

  it('contains the literal word "diagnos" only inside the one never-use-it safety rule', () => {
    const prompt = buildSystemPrompt();
    const matches = prompt.match(/diagnos/gi) ?? [];
    // "diagnosis" + "diagnose" inside the single safety-rule bullet — 2 hits, nowhere else.
    expect(matches.length).toBe(2);
  });
});
