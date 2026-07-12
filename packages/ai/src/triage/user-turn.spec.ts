import type { CompletedIntake } from "@pawcareright/types";

import type { TriagePetContext, TriagePromptInput } from "./types";
import { buildUserTurn } from "./user-turn";

const PET: TriagePetContext = {
  name: "Bruno",
  species: "DOG",
  breedLabel: "Labrador Retriever",
  sex: "MALE",
  neutered: true,
  ageMonths: 36,
  weightKg: 28,
};

const INTAKE: CompletedIntake = {
  category: "vomiting",
  answers: [
    { questionId: "onset", type: "duration", value: 2, unit: "days" },
    { questionId: "frequency", type: "single", value: "four-plus" },
    { questionId: "contents", type: "multi", values: ["blood", "yellow-bile"] },
    { questionId: "appetite", type: "single", value: "reduced" },
    { questionId: "energy", type: "scale", value: 2 },
    { questionId: "photo", type: "photoPrompt", photoKeys: ["k1", "k2"] },
  ],
  freeText: "He seems uncomfortable after eating.",
};

const INTAKE_NO_FREE_TEXT: CompletedIntake = {
  category: "vomiting",
  answers: [
    { questionId: "onset", type: "duration", value: 2, unit: "days" },
    { questionId: "frequency", type: "single", value: "four-plus" },
    { questionId: "energy", type: "scale", value: 2 },
  ],
};

describe("buildUserTurn", () => {
  const input: TriagePromptInput = { pet: PET, intake: INTAKE };

  it("matches the deterministic serialization (snapshot)", () => {
    expect(buildUserTurn(input)).toMatchSnapshot();
  });

  it("renders single-answer option labels, not raw values", () => {
    const text = buildUserTurn(input);
    expect(text).toContain("Four or more times");
    expect(text).not.toContain("four-plus");
  });

  it("renders multi-answer option labels joined by commas, not raw values", () => {
    const text = buildUserTurn(input);
    expect(text).toContain("Blood, Yellow bile");
    expect(text).not.toContain("yellow-bile");
  });

  it("renders the scale answer as `value of max (min = minLabel, max = maxLabel)`", () => {
    expect(buildUserTurn(input)).toContain("2 of 5 (1 = Very weak / collapsed, 5 = Normal and playful)");
  });

  it("renders the duration answer as `value unit`", () => {
    expect(buildUserTurn(input)).toContain("2 days");
  });

  it("does not list a line for photoPrompt answers, but counts photos", () => {
    const text = buildUserTurn(input);
    expect(text).toContain("PHOTOS ATTACHED: 2");
  });

  it("omits Age/Weight lines when undefined", () => {
    const minimalPet: TriagePetContext = { name: "Mittens", species: "CAT" };
    const text = buildUserTurn({ pet: minimalPet, intake: INTAKE });
    expect(text).not.toMatch(/- Age:/);
    expect(text).not.toMatch(/- Weight:/);
    expect(text).toContain("Unknown / mixed");
  });

  it("omits the OWNER'S DESCRIPTION line when freeText is undefined", () => {
    const text = buildUserTurn({ pet: PET, intake: INTAKE_NO_FREE_TEXT });
    expect(text).not.toMatch(/OWNER'S DESCRIPTION/);
    expect(text).toContain("PHOTOS ATTACHED: 0");
  });

  it("emits no PII beyond the pet name", () => {
    const text = buildUserTurn(input);
    expect(text).not.toMatch(/@/);
    expect(text.toLowerCase()).not.toMatch(/email|household|userid|ownername/);
    expect(text).toContain("Bruno");
  });
});
