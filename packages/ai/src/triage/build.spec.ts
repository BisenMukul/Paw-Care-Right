import { CONFIDENCE_LEVELS, URGENCY_TIERS, type CompletedIntake } from "@pawcareright/types";

import { buildTriagePrompt } from "./build";
import type { TriagePetContext, TriagePromptInput } from "./types";
import { TRIAGE_PROMPT_REGISTRY, TRIAGE_PROMPT_VERSION } from "./version";

const PET: TriagePetContext = { name: "Bruno", species: "DOG", ageMonths: 36 };

const INTAKE: CompletedIntake = {
  category: "vomiting",
  answers: [
    { questionId: "onset", type: "duration", value: 1, unit: "days" },
    { questionId: "frequency", type: "single", value: "once" },
    { questionId: "appetite", type: "single", value: "normal" },
    { questionId: "energy", type: "scale", value: 4 },
  ],
};

const SAMPLE_INPUT: TriagePromptInput = { pet: PET, intake: INTAKE };

const TRIAGE_RESULT_FIELDS = [
  "urgency",
  "confidence",
  "summary",
  "possibleCauses",
  "redFlagsToWatch",
  "homeCare",
  "doNot",
  "vetQuestions",
  "followUpHours",
];

describe("buildTriagePrompt", () => {
  it("builds a deterministic prompt (snapshot)", () => {
    expect(buildTriagePrompt(SAMPLE_INPUT)).toMatchSnapshot();
  });

  it("sets temperature 0 and a registered prompt version", () => {
    const built = buildTriagePrompt(SAMPLE_INPUT);
    expect(built.temperature).toBe(0);
    expect(built.version).toBe(TRIAGE_PROMPT_VERSION);
    expect(Object.keys(TRIAGE_PROMPT_REGISTRY)).toContain(built.version);
  });

  it("system prompt contains every TriageResult field name and all tiers/confidence levels", () => {
    const built = buildTriagePrompt(SAMPLE_INPUT);
    TRIAGE_RESULT_FIELDS.forEach((field) => expect(built.system).toContain(field));
    URGENCY_TIERS.forEach((tier) => expect(built.system).toContain(tier));
    CONFIDENCE_LEVELS.forEach((level) => expect(built.system).toContain(level));
  });

  it("includes the JSON-only instruction and the prompt version footer", () => {
    const built = buildTriagePrompt(SAMPLE_INPUT);
    expect(built.system).toContain("Return ONLY a single JSON object");
    expect(built.system).toContain(`Prompt version: ${TRIAGE_PROMPT_VERSION}`);
  });

  it("emits no PII beyond pet context — only the pet name appears", () => {
    // TriagePetContext structurally has no email/householdId/userId/ownerName
    // field, so adding one would be a compile error (plan R9).
    const built = buildTriagePrompt(SAMPLE_INPUT);
    const wholePrompt = [built.system, ...built.messages.map((message) => message.content)].join("\n");

    expect(wholePrompt).not.toMatch(/@/);
    expect(wholePrompt.toLowerCase()).not.toMatch(/\bemail\b|household|userid|ownername/);
    expect(wholePrompt).toContain("Bruno");
  });
});
