import { SAFE_FALLBACK, type CompletedIntake, type TriageResult } from "@pawcareright/types";

import { FakeTextProvider } from "../providers/fake";
import type { TextResult } from "../providers/types";

import { runTriage } from "./run";
import type { TriagePetContext, TriagePromptInput } from "./types";

const PET: TriagePetContext = { name: "Bruno", species: "DOG" };

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

const VALID_RESULT: TriageResult = {
  urgency: "MONITOR",
  confidence: "medium",
  summary: "A single vomit in an otherwise playful dog can usually be watched at home for now.",
  possibleCauses: [
    {
      name: "Mild stomach upset",
      whyItFits: "One vomit with normal energy and appetite usually means minor irritation.",
    },
  ],
  redFlagsToWatch: ["More vomiting", "Low energy"],
  homeCare: ["Offer a small, plain meal after a short rest"],
  doNot: ["Do not give any human medications"],
  vetQuestions: ["When should I be concerned if it happens again?"],
  followUpHours: 24,
};

function textResult(text: string): TextResult {
  return { text, model: "fake-text-model", usage: { latencyMs: 1 } };
}

describe("runTriage", () => {
  it("parses a valid fake-provider response", async () => {
    const provider = new FakeTextProvider({ canned: textResult(JSON.stringify(VALID_RESULT)) });
    const generateSpy = jest.spyOn(provider, "generate");

    const result = await runTriage(SAMPLE_INPUT, { provider });

    expect(result.status).toBe("OK");
    expect(result.attempts).toBe(1);
    expect(result.result).toEqual(VALID_RESULT);
    expect(result.failureReason).toBeUndefined();
    expect(generateSpy).toHaveBeenCalledWith(expect.objectContaining({ cacheable: true }));
  });

  it("extracts fenced/BOM-wrapped valid output", async () => {
    const wrapped = "\uFEFF```json\n" + JSON.stringify(VALID_RESULT) + "\n```";
    const provider = new FakeTextProvider({ canned: textResult(wrapped) });

    const result = await runTriage(SAMPLE_INPUT, { provider });

    expect(result.status).toBe("OK");
    expect(result.result).toEqual(VALID_RESULT);
  });

  it("repairs after one malformed response", async () => {
    const provider = new FakeTextProvider({
      script: [textResult("not json at all"), textResult(JSON.stringify(VALID_RESULT))],
    });
    const generateSpy = jest.spyOn(provider, "generate");

    const result = await runTriage(SAMPLE_INPUT, { provider });

    expect(result.status).toBe("REPAIRED");
    expect(result.attempts).toBe(2);
    expect(result.result).toEqual(VALID_RESULT);
    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(generateSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ cacheable: true }));
    expect(generateSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ cacheable: true }));
  });

  it("falls back to SAFE_FALLBACK after repair also fails", async () => {
    const provider = new FakeTextProvider({
      script: [textResult("still not json"), textResult("also not json")],
    });

    const result = await runTriage(SAMPLE_INPUT, { provider });

    expect(result.status).toBe("SAFE_FALLBACK");
    expect(result.result).toEqual(SAFE_FALLBACK);
    expect(result.attempts).toBe(2);
    expect(result.failureReason).toBeDefined();
  });

  it("fails upward on provider error (never throws)", async () => {
    const provider = new FakeTextProvider({ script: [] });

    await expect(runTriage(SAMPLE_INPUT, { provider })).resolves.toMatchObject({
      status: "SAFE_FALLBACK",
      result: SAFE_FALLBACK,
      attempts: 1,
    });
  });
});
