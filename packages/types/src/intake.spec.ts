import {
  type Answer,
  answerSchema,
  categoryDefSchema,
  type CompletedIntake,
  completedIntakeSchema,
  getCategoryDef,
  INTAKE_CATEGORIES,
  parseIntake,
  type QuestionDef,
  type SymptomCategory,
  SYMPTOM_CATEGORIES,
} from "./intake";

/**
 * Emits a schema-valid `CompletedIntake` for `categoryId`, answering every
 * question in its `CategoryDef` correctly: single -> first option value,
 * multi -> [first option value], scale -> min, duration -> {value:2,
 * unit: first offered unit}, photoPrompt -> {photoKeys: []}. Used as the
 * base fixture for both positive tests and mutate-to-negative tests.
 */
function validIntakeFor(categoryId: SymptomCategory): CompletedIntake {
  const categoryDef = getCategoryDef(categoryId);
  if (!categoryDef) {
    throw new Error(`no category def for "${categoryId}"`);
  }

  const answers: Answer[] = categoryDef.questions.map((question): Answer => {
    switch (question.type) {
      case "single": {
        const first = question.options[0];
        if (!first) throw new Error(`question "${question.id}" has no options`);
        return { questionId: question.id, type: "single", value: first.value };
      }
      case "multi": {
        const first = question.options[0];
        if (!first) throw new Error(`question "${question.id}" has no options`);
        return { questionId: question.id, type: "multi", values: [first.value] };
      }
      case "scale":
        return { questionId: question.id, type: "scale", value: question.min };
      case "duration": {
        const firstUnit = question.units[0];
        if (!firstUnit) throw new Error(`question "${question.id}" has no units`);
        return { questionId: question.id, type: "duration", value: 2, unit: firstUnit };
      }
      case "photoPrompt":
        return { questionId: question.id, type: "photoPrompt", photoKeys: [] };
    }
  });

  return { category: categoryId, answers };
}

/** Replaces the answer for `questionId` with an arbitrary (possibly invalid) shape. */
function replaceAnswer(intake: CompletedIntake, questionId: string, nextAnswer: Record<string, unknown>): unknown {
  return {
    ...intake,
    answers: intake.answers.map((answer) => (answer.questionId === questionId ? nextAnswer : answer)),
  };
}

/** Drops the answer for `questionId` entirely. */
function dropAnswer(intake: CompletedIntake, questionId: string): CompletedIntake {
  return { ...intake, answers: intake.answers.filter((answer) => answer.questionId !== questionId) };
}

function findQuestion(categoryId: SymptomCategory, questionId: string): QuestionDef {
  const categoryDef = getCategoryDef(categoryId);
  if (!categoryDef) throw new Error(`missing category "${categoryId}"`);
  const question = categoryDef.questions.find((q) => q.id === questionId);
  if (!question) throw new Error(`missing question "${questionId}" in "${categoryId}"`);
  return question;
}

describe("every category definition is well-formed", () => {
  it.each(INTAKE_CATEGORIES)("category $id parses as a valid categoryDef", (def) => {
    expect(categoryDefSchema.safeParse(def).success).toBe(true);
  });

  it.each(INTAKE_CATEGORIES)("category $id has unique question ids", (def) => {
    const ids = def.questions.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(INTAKE_CATEGORIES)("category $id has unique option values per question", (def) => {
    for (const question of def.questions) {
      if (question.type === "single" || question.type === "multi") {
        const values = question.options.map((o) => o.value);
        expect(new Set(values).size).toBe(values.length);
      }
    }
  });

  it.each(INTAKE_CATEGORIES)("category $id scale questions have max > min", (def) => {
    for (const question of def.questions) {
      if (question.type === "scale") {
        expect(question.max).toBeGreaterThan(question.min);
      }
    }
  });

  it.each(INTAKE_CATEGORIES)("category $id photoPrompt questions have maxPhotos in 1..3", (def) => {
    for (const question of def.questions) {
      if (question.type === "photoPrompt") {
        expect(question.maxPhotos).toBeGreaterThanOrEqual(1);
        expect(question.maxPhotos).toBeLessThanOrEqual(3);
      }
    }
  });

  it.each(INTAKE_CATEGORIES)("category $id duration questions have non-empty units", (def) => {
    for (const question of def.questions) {
      if (question.type === "duration") {
        expect(question.units.length).toBeGreaterThan(0);
      }
    }
  });

  it("INTAKE_CATEGORIES covers SYMPTOM_CATEGORIES exactly (no missing/extra), length 12", () => {
    expect(INTAKE_CATEGORIES.length).toBe(12);
    expect(new Set(INTAKE_CATEGORIES.map((c) => c.id))).toEqual(new Set(SYMPTOM_CATEGORIES));
  });

  it("getCategoryDef returns the def for every known id", () => {
    for (const id of SYMPTOM_CATEGORIES) {
      expect(getCategoryDef(id)?.id).toBe(id);
    }
  });

  it('getCategoryDef returns undefined for "nope"', () => {
    expect(getCategoryDef("nope")).toBeUndefined();
  });
});

describe("a completed intake validates for every category", () => {
  it.each(SYMPTOM_CATEGORIES)("category %s produces a valid completed intake", (id) => {
    const intake = validIntakeFor(id);
    expect(parseIntake(intake).ok).toBe(true);
    expect(completedIntakeSchema.safeParse(intake).success).toBe(true);
  });

  it.each(SYMPTOM_CATEGORIES)("category %s still validates with freeText set", (id) => {
    const intake = { ...validIntakeFor(id), freeText: "Extra details from the owner." };
    expect(parseIntake(intake).ok).toBe(true);
  });
});

describe("unknown category is rejected", () => {
  it("rejects a category not in the enum", () => {
    const result = parseIntake({ category: "not-a-category", answers: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "category")).toBe(true);
    }
  });

  it.each(["Vomiting", "URINARY", ""])("rejects category variant %p", (badCategory) => {
    const result = parseIntake({ category: badCategory, answers: [] });
    expect(result.ok).toBe(false);
  });
});

describe("answers referencing an unknown question are rejected", () => {
  it("rejects an answer with an unknown questionId", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "frequency", {
      questionId: "ghost",
      type: "single",
      value: "once",
    });
    const result = parseIntake(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "answers.1.questionId")).toBe(true);
    }
  });
});

describe("type-mismatched answers are rejected", () => {
  it("rejects a scale-typed answer in place of a single answer", () => {
    const intake = validIntakeFor("urinary");
    const index = intake.answers.findIndex((a) => a.questionId === "difficulty");
    const candidate = replaceAnswer(intake, "difficulty", {
      questionId: "difficulty",
      type: "scale",
      value: 1,
    });
    const result = parseIntake(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === `answers.${index}.type`)).toBe(true);
    }
  });
});

describe("scale answers outside min/max are rejected", () => {
  it.each([0, 6, 1.5])("rejects scale value %p for energy (min 1, max 5)", (badValue) => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "energy", {
      questionId: "energy",
      type: "scale",
      value: badValue,
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });
});

describe("single answers must use a defined option", () => {
  it("rejects a value not present in the question's options", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "frequency", {
      questionId: "frequency",
      type: "single",
      value: "made-up",
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });
});

describe("multi answers respect options and maxSelections", () => {
  it("rejects a value not present in the question's options", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "contents", {
      questionId: "contents",
      type: "multi",
      values: ["bogus"],
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });

  it("rejects duplicate values", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "contents", {
      questionId: "contents",
      type: "multi",
      values: ["food", "food"],
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });

  // N/A: no question in INTAKE_CATEGORIES currently sets `maxSelections`,
  // so there is no fixture to exercise the maxSelections-exceeded branch.
  // The refine logic (see intake.ts) enforces it whenever a question does
  // set `maxSelections`; documented per plan §"Tests to write".
});

describe("duration answers must use an offered unit", () => {
  it('rejects unit "weeks" for diarrhea onset (offers only hours/days)', () => {
    const intake = validIntakeFor("diarrhea");
    const candidate = replaceAnswer(intake, "onset", {
      questionId: "onset",
      type: "duration",
      value: 2,
      unit: "weeks",
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });

  it.each([0, -1])("rejects a non-positive duration value %p", (badValue) => {
    const intake = validIntakeFor("diarrhea");
    const candidate = replaceAnswer(intake, "onset", {
      questionId: "onset",
      type: "duration",
      value: badValue,
      unit: "hours",
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });
});

describe("photoPrompt answers respect maxPhotos", () => {
  it("rejects photoKeys longer than the question's maxPhotos", () => {
    const question = findQuestion("ears", "photo");
    if (question.type !== "photoPrompt") throw new Error("expected photoPrompt question");
    const intake = validIntakeFor("ears");
    const candidate = replaceAnswer(intake, "photo", {
      questionId: "photo",
      type: "photoPrompt",
      photoKeys: Array.from({ length: question.maxPhotos + 1 }, (_, i) => `photo-${i}`),
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });
});

describe("missing a required question is rejected", () => {
  it("rejects an intake missing a required answer", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = dropAnswer(intake, "frequency");
    const result = parseIntake(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues?.some((issue) => issue.path.join(".") === "answers")).toBe(true);
    }
  });

  it("still validates when only an optional question is dropped", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = dropAnswer(intake, "contents");
    expect(parseIntake(candidate).ok).toBe(true);
  });
});

describe("extra keys are rejected", () => {
  it("rejects an extra top-level key", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = { ...intake, foo: "x" };
    expect(parseIntake(candidate).ok).toBe(false);
  });

  it("rejects an extra key inside an answer object", () => {
    const intake = validIntakeFor("vomiting");
    const candidate = replaceAnswer(intake, "frequency", {
      questionId: "frequency",
      type: "single",
      value: "once",
      extra: 1,
    });
    expect(parseIntake(candidate).ok).toBe(false);
  });
});

describe("parseIntake accepts a JSON string and reports INVALID_JSON", () => {
  it("parses a valid serialized fixture", () => {
    const intake = validIntakeFor("eyes");
    expect(parseIntake(JSON.stringify(intake)).ok).toBe(true);
  });

  it("fails closed with INVALID_JSON reason on truncated JSON", () => {
    const result = parseIntake('{"category":');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason.startsWith("INVALID_JSON")).toBe(true);
    }
  });
});

describe("parseIntake never throws on hostile input", () => {
  it("does not throw on exotic input shapes", () => {
    const withSymbolKey: Record<string | symbol, unknown> = { [Symbol("k")]: "v" };
    const deeplyNested: { a?: unknown } = {};
    let cursor = deeplyNested;
    for (let i = 0; i < 200; i += 1) {
      cursor.a = {};
      cursor = cursor.a as { a?: unknown };
    }

    const hostileInputs: unknown[] = [null, 42, [], 10n, withSymbolKey, deeplyNested];

    for (const input of hostileInputs) {
      expect(() => parseIntake(input)).not.toThrow();
      expect(parseIntake(input).ok).toBe(false);
    }
  });
});

describe("no intake copy contains diagnosis or dosing language", () => {
  const DIAGNOSIS_WORD_PATTERN = /diagnos/i;
  const DOSING_PATTERN =
    /(\bmg\b|\bml\b|\bdose|dosage|milligram|per kg|administer|tablet|ibuprofen|paracetamol|acetaminophen|aspirin|benadryl|diphenhydramine|metacam|tramadol)/i;

  function allCopyStrings(): string[] {
    const strings: string[] = [];
    for (const category of INTAKE_CATEGORIES) {
      strings.push(category.label);
      for (const question of category.questions) {
        strings.push(question.prompt);
        if (question.helpText) strings.push(question.helpText);
        if (question.type === "single" || question.type === "multi") {
          for (const option of question.options) strings.push(option.label);
        }
        if (question.type === "scale") {
          strings.push(question.minLabel, question.maxLabel);
        }
      }
    }
    return strings;
  }

  it("contains no diagnosis/diagnose language", () => {
    for (const value of allCopyStrings()) {
      expect(DIAGNOSIS_WORD_PATTERN.test(value)).toBe(false);
    }
  });

  it("contains no medication name/dosing/administration language", () => {
    for (const value of allCopyStrings()) {
      expect(DOSING_PATTERN.test(value)).toBe(false);
    }
  });
});

describe("red-flag-adjacent option values are stable (T042 mapping contract)", () => {
  function optionValues(categoryId: SymptomCategory, questionId: string): string[] {
    const question = findQuestion(categoryId, questionId);
    if (question.type !== "single" && question.type !== "multi") {
      throw new Error(`question "${questionId}" has no options`);
    }
    return question.options.map((o) => o.value);
  }

  it("urinary/difficulty has straining and cannot-urinate", () => {
    const values = optionValues("urinary", "difficulty");
    expect(values).toEqual(expect.arrayContaining(["straining", "cannot-urinate"]));
  });

  it("urinary/blood-in-urine has yes", () => {
    expect(optionValues("urinary", "blood-in-urine")).toEqual(expect.arrayContaining(["yes"]));
  });

  it("breathing/character has labored, open-mouth-cat, gasping", () => {
    const values = optionValues("breathing", "character");
    expect(values).toEqual(expect.arrayContaining(["labored", "open-mouth-cat", "gasping"]));
  });

  it("breathing/gum-color has pale-white, blue-purple", () => {
    const values = optionValues("breathing", "gum-color");
    expect(values).toEqual(expect.arrayContaining(["pale-white", "blue-purple"]));
  });

  it("injury/what has hit-by-vehicle", () => {
    expect(optionValues("injury", "what")).toEqual(expect.arrayContaining(["hit-by-vehicle"]));
  });

  it("injury/bleeding has heavy", () => {
    expect(optionValues("injury", "bleeding")).toEqual(expect.arrayContaining(["heavy"]));
  });

  it("injury/consciousness has unresponsive", () => {
    expect(optionValues("injury", "consciousness")).toEqual(expect.arrayContaining(["unresponsive"]));
  });
});

describe("answerSchema strict member shapes", () => {
  it("rejects an unknown answer type", () => {
    expect(answerSchema.safeParse({ questionId: "x", type: "bogus" }).success).toBe(false);
  });
});
