import { getCategoryDef, parseIntake } from "@pawcareright/types";
import type { Answer, CategoryDef } from "@pawcareright/types";

import { buildIntakeCandidate, describeAnswer } from "../src/checks/intake";

// Pure-helper tests (T045 plan §"Pure-helper tests").

describe("buildIntakeCandidate", () => {
  it("assembles answers in schema order, omitting unanswered questions", () => {
    const categoryDef = getCategoryDef("vomiting") as CategoryDef;
    const answers: Record<string, Answer> = {
      appetite: { type: "single", questionId: "appetite", value: "normal" },
      onset: { type: "duration", questionId: "onset", value: 2, unit: "days" },
    };

    const candidate = buildIntakeCandidate(categoryDef, answers, "");

    expect(candidate.category).toBe("vomiting");
    expect(candidate.answers.map((a) => a.questionId)).toEqual(["onset", "appetite"]);
    expect(candidate.freeText).toBeUndefined();
  });

  it("omits empty/whitespace freeText and includes trimmed non-empty freeText", () => {
    const categoryDef = getCategoryDef("other") as CategoryDef;

    const withWhitespace = buildIntakeCandidate(categoryDef, {}, "   ");
    expect(withWhitespace.freeText).toBeUndefined();

    const withText = buildIntakeCandidate(categoryDef, {}, "  extra detail  ");
    expect(withText.freeText).toBe("extra detail");
  });

  it("produces a candidate that passes parseIntake when all required answered", () => {
    const categoryDef = getCategoryDef("other") as CategoryDef;
    const answers: Record<string, Answer> = {
      onset: { type: "duration", questionId: "onset", value: 3, unit: "days" },
      severity: { type: "scale", questionId: "severity", value: 2 },
    };

    const candidate = buildIntakeCandidate(categoryDef, answers, "notes");
    const result = parseIntake(candidate);

    expect(result.ok).toBe(true);
  });
});

describe("describeAnswer", () => {
  const categoryDef = getCategoryDef("vomiting") as CategoryDef;
  const questionById = new Map(categoryDef.questions.map((q) => [q.id, q]));

  it("single -> option label", () => {
    const question = questionById.get("appetite")!;
    const answer: Answer = { type: "single", questionId: "appetite", value: "reduced" };
    expect(describeAnswer(question, answer)).toBe("Reduced");
  });

  it("multi -> labels joined", () => {
    const question = questionById.get("contents")!;
    const answer: Answer = {
      type: "multi",
      questionId: "contents",
      values: ["food", "blood"],
    };
    expect(describeAnswer(question, answer)).toBe("Food, Blood");
  });

  it("scale -> numeric", () => {
    const question = questionById.get("energy")!;
    const answer: Answer = { type: "scale", questionId: "energy", value: 3 };
    expect(describeAnswer(question, answer)).toBe("3 / 5");
  });

  it("duration -> value + unit", () => {
    const question = questionById.get("onset")!;
    const answer: Answer = { type: "duration", questionId: "onset", value: 2, unit: "days" };
    expect(describeAnswer(question, answer)).toBe("2 days");
  });
});
