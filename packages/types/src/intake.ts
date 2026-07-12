import { z } from "zod";

/**
 * Symptom-intake data model (T032).
 *
 * This file is the schema-driven DATA source for the dynamic symptom
 * intake flow: ~12 categories (`INTAKE_CATEGORIES`), each with a small set
 * of follow-up question definitions typed as a discriminated union
 * (`single` / `multi` / `scale` / `duration` / `photoPrompt`). Renderers
 * (mobile T044/T045) and the AI prompt builder (T033) consume this data —
 * they never hardcode categories or questions.
 *
 * All question/option copy below is user-facing prose (CLAUDE §7): it only
 * *collects* symptoms, never advises, diagnoses, or doses. Like the
 * breeds/toxins datasets in `packages/data`, this copy is externalized DATA
 * in a shared package, not a UI component — the CLAUDE §6 "no hardcoded
 * user-facing strings in components" rule targets app components, not this
 * shared schema/data source. Actual i18n is T110.
 *
 * The completed-intake validator (`parseIntake`) mirrors `parseTriage`
 * (./triage.ts) exactly: never throws, never mutates, fails closed.
 *
 * Out of scope here (see plan R1-R3): no `RedFlagSign` mapper (T042, api
 * layer — `packages/types` cannot import `packages/ai`), no `petId`/species
 * on the completed intake (pet is a path param at T042). The red-flag-
 * adjacent categories (`urinary`, `breathing`, `injury`) use stable
 * kebab-case option `value`s that the T042 mapper will rely on 1:1 — see
 * the mapping table in the plan and the "mapping-contract anchors" tests.
 */

// ---- category enum ----

export const SYMPTOM_CATEGORIES = [
  "vomiting",
  "diarrhea",
  "not-eating",
  "limping",
  "skin-itch",
  "eyes",
  "ears",
  "urinary",
  "breathing",
  "behavior",
  "injury",
  "other",
] as const;
export const symptomCategorySchema = z.enum(SYMPTOM_CATEGORIES);
export type SymptomCategory = z.infer<typeof symptomCategorySchema>;

// ---- duration units ----

export const DURATION_UNITS = ["minutes", "hours", "days", "weeks"] as const;
export const durationUnitSchema = z.enum(DURATION_UNITS);
export type DurationUnit = z.infer<typeof durationUnitSchema>;

// ---- question types ----

export const QUESTION_TYPES = ["single", "multi", "scale", "duration", "photoPrompt"] as const;

// ---- shared option shape ----

export const optionSchema = z.strictObject({
  value: z.string().min(1),
  label: z.string().min(1),
});
export type IntakeOption = z.infer<typeof optionSchema>;

// ---- question-def discriminated union ----

const questionBaseSchema = {
  id: z.string().min(1),
  prompt: z.string().min(1),
  required: z.boolean(),
  helpText: z.string().min(1).optional(),
};

const singleQuestionSchema = z.strictObject({
  ...questionBaseSchema,
  type: z.literal("single"),
  options: z.array(optionSchema).min(2),
});

const multiQuestionSchema = z.strictObject({
  ...questionBaseSchema,
  type: z.literal("multi"),
  options: z.array(optionSchema).min(2),
  maxSelections: z.number().int().positive().optional(),
});

const scaleQuestionSchema = z.strictObject({
  ...questionBaseSchema,
  type: z.literal("scale"),
  min: z.number().int(),
  max: z.number().int(),
  minLabel: z.string().min(1),
  maxLabel: z.string().min(1),
});

const durationQuestionSchema = z.strictObject({
  ...questionBaseSchema,
  type: z.literal("duration"),
  units: z.array(durationUnitSchema).min(1),
});

const photoPromptQuestionSchema = z.strictObject({
  ...questionBaseSchema,
  type: z.literal("photoPrompt"),
  maxPhotos: z.number().int().min(1).max(3),
});

export const questionDefSchema = z
  .discriminatedUnion("type", [
    singleQuestionSchema,
    multiQuestionSchema,
    scaleQuestionSchema,
    durationQuestionSchema,
    photoPromptQuestionSchema,
  ])
  .superRefine((data, ctx) => {
    // Defensive data-integrity check on the scale bounds (plan §"Interfaces").
    if (data.type === "scale" && data.max <= data.min) {
      ctx.addIssue({
        code: "custom",
        message: "scale question max must be greater than min",
        path: ["max"],
      });
    }
  });
export type QuestionDef = z.infer<typeof questionDefSchema>;

// ---- category def ----

export const categoryDefSchema = z.strictObject({
  id: symptomCategorySchema,
  label: z.string().min(1),
  questions: z.array(questionDefSchema).min(1),
});
export type CategoryDef = z.infer<typeof categoryDefSchema>;

/**
 * Category & question inventory — transcribed verbatim from the plan.
 * Every `label`/`prompt`/`helpText`/option `label`/scale label below is
 * user-facing prose and must stay CLAUDE §7 clean (no diagnosis language,
 * no medication names/dosing/administration instructions). See the
 * "no intake copy contains diagnosis or dosing language" test.
 */
export const INTAKE_CATEGORIES: readonly CategoryDef[] = [
  {
    id: "vomiting",
    label: "Vomiting",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has the vomiting been happening?",
        required: true,
        units: ["minutes", "hours", "days"],
      },
      {
        id: "frequency",
        type: "single",
        prompt: "How many times?",
        required: true,
        options: [
          { value: "once", label: "Once" },
          { value: "two-to-three", label: "Two to three times" },
          { value: "four-plus", label: "Four or more times" },
          { value: "continuous", label: "Continuous / can't stop" },
        ],
      },
      {
        id: "contents",
        type: "multi",
        prompt: "What do you see in the vomit?",
        required: false,
        options: [
          { value: "food", label: "Food" },
          { value: "yellow-bile", label: "Yellow bile" },
          { value: "white-foam", label: "White foam" },
          { value: "blood", label: "Blood" },
          { value: "foreign-object", label: "A foreign object" },
          { value: "not-sure", label: "Not sure" },
        ],
      },
      {
        id: "appetite",
        type: "single",
        prompt: "Is your pet eating and drinking?",
        required: true,
        options: [
          { value: "normal", label: "Normal" },
          { value: "reduced", label: "Reduced" },
          { value: "refusing-all", label: "Refusing food and water" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "diarrhea",
    label: "Diarrhea",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has the diarrhea lasted?",
        required: true,
        units: ["hours", "days"],
      },
      {
        id: "frequency",
        type: "single",
        prompt: "How often?",
        required: true,
        options: [
          { value: "once", label: "Once" },
          { value: "a-few-times", label: "A few times" },
          { value: "very-frequent", label: "Very frequent" },
          { value: "continuous", label: "Continuous" },
        ],
      },
      {
        id: "appearance",
        type: "multi",
        prompt: "What does it look like?",
        required: false,
        options: [
          { value: "watery", label: "Watery" },
          { value: "soft", label: "Soft" },
          { value: "mucus", label: "Mucus" },
          { value: "red-blood", label: "Red blood" },
          { value: "black-tarry", label: "Black and tarry" },
          { value: "normal-color", label: "Normal color" },
        ],
      },
      {
        id: "appetite",
        type: "single",
        prompt: "Is your pet eating and drinking?",
        required: true,
        options: [
          { value: "normal", label: "Normal" },
          { value: "reduced", label: "Reduced" },
          { value: "refusing-all", label: "Refusing food and water" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "not-eating",
    label: "Not eating / loss of appetite",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long since your pet last ate normally?",
        required: true,
        units: ["hours", "days"],
      },
      {
        id: "water",
        type: "single",
        prompt: "Is your pet drinking water?",
        required: true,
        options: [
          { value: "drinking-normally", label: "Drinking normally" },
          { value: "drinking-less", label: "Drinking less than usual" },
          { value: "not-drinking", label: "Not drinking at all" },
        ],
      },
      {
        id: "other-signs",
        type: "multi",
        prompt: "Any other signs?",
        required: false,
        options: [
          { value: "vomiting", label: "Vomiting" },
          { value: "lethargy", label: "Lethargy" },
          { value: "hiding", label: "Hiding" },
          { value: "weight-loss", label: "Weight loss" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "limping",
    label: "Limping / trouble moving",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has the limping been present?",
        required: true,
        units: ["hours", "days", "weeks"],
      },
      {
        id: "legs",
        type: "multi",
        prompt: "Which leg(s)?",
        required: true,
        options: [
          { value: "front-left", label: "Front left" },
          { value: "front-right", label: "Front right" },
          { value: "back-left", label: "Back left" },
          { value: "back-right", label: "Back right" },
          { value: "shifting-between-legs", label: "Shifting between legs" },
        ],
      },
      {
        id: "weight-bearing",
        type: "single",
        prompt: "Can your pet put weight on it?",
        required: true,
        options: [
          { value: "fully", label: "Fully" },
          { value: "partially", label: "Partially" },
          { value: "not-at-all", label: "Not at all" },
        ],
      },
      {
        id: "visible",
        type: "single",
        prompt: "Any visible problem?",
        required: false,
        options: [
          { value: "none", label: "None" },
          { value: "swelling", label: "Swelling" },
          { value: "open-wound", label: "Open wound" },
          { value: "bone-looks-abnormal", label: "Bone looks abnormal" },
        ],
      },
      {
        id: "pain",
        type: "scale",
        prompt: "Pain level",
        required: true,
        min: 1,
        max: 5,
        minLabel: "No pain signs",
        maxLabel: "Severe — cries or won't move",
      },
    ],
  },
  {
    id: "skin-itch",
    label: "Skin / itching",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has this been going on?",
        required: true,
        units: ["days", "weeks"],
      },
      {
        id: "signs",
        type: "multi",
        prompt: "What do you see?",
        required: true,
        options: [
          { value: "redness", label: "Redness" },
          { value: "hair-loss", label: "Hair loss" },
          { value: "scabs", label: "Scabs" },
          { value: "rash", label: "Rash" },
          { value: "swelling", label: "Swelling" },
          { value: "bad-odor", label: "Bad odor" },
        ],
      },
      {
        id: "location",
        type: "multi",
        prompt: "Where on the body?",
        required: false,
        options: [
          { value: "ears", label: "Ears" },
          { value: "paws", label: "Paws" },
          { value: "belly", label: "Belly" },
          { value: "back", label: "Back" },
          { value: "face", label: "Face" },
          { value: "all-over", label: "All over" },
        ],
      },
      {
        id: "itch",
        type: "scale",
        prompt: "How itchy is your pet?",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Not itchy",
        maxLabel: "Constant intense itching",
      },
      {
        id: "photo",
        type: "photoPrompt",
        prompt: "Add a photo of the affected area",
        required: false,
        maxPhotos: 3,
      },
    ],
  },
  {
    id: "eyes",
    label: "Eyes",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has this been present?",
        required: true,
        units: ["hours", "days"],
      },
      {
        id: "signs",
        type: "multi",
        prompt: "What do you notice?",
        required: true,
        options: [
          { value: "redness", label: "Redness" },
          { value: "discharge", label: "Discharge" },
          { value: "squinting", label: "Squinting" },
          { value: "cloudiness", label: "Cloudiness" },
          { value: "swelling", label: "Swelling" },
          { value: "bulging", label: "Bulging" },
        ],
      },
      {
        id: "which",
        type: "single",
        prompt: "Which eye?",
        required: true,
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "both", label: "Both" },
        ],
      },
      {
        id: "photo",
        type: "photoPrompt",
        prompt: "Add a photo of the eye",
        required: false,
        maxPhotos: 3,
      },
    ],
  },
  {
    id: "ears",
    label: "Ears",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has this been going on?",
        required: true,
        units: ["days", "weeks"],
      },
      {
        id: "signs",
        type: "multi",
        prompt: "What do you notice?",
        required: true,
        options: [
          { value: "scratching", label: "Scratching" },
          { value: "head-shaking", label: "Head shaking" },
          { value: "discharge", label: "Discharge" },
          { value: "bad-odor", label: "Bad odor" },
          { value: "redness", label: "Redness" },
          { value: "swelling", label: "Swelling" },
        ],
      },
      {
        id: "which",
        type: "single",
        prompt: "Which ear?",
        required: true,
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "both", label: "Both" },
        ],
      },
      {
        id: "photo",
        type: "photoPrompt",
        prompt: "Add a photo of the ear",
        required: false,
        maxPhotos: 2,
      },
    ],
  },
  {
    id: "urinary",
    label: "Urinary / peeing problems",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has this been happening?",
        required: true,
        units: ["hours", "days"],
      },
      {
        id: "difficulty",
        type: "single",
        prompt: "How is your pet passing urine?",
        required: true,
        options: [
          { value: "normal", label: "Normal" },
          { value: "straining", label: "Straining, little comes out" },
          { value: "frequent-small", label: "Going often, small amounts" },
          { value: "cannot-urinate", label: "Trying but nothing comes out" },
        ],
      },
      {
        id: "blood-in-urine",
        type: "single",
        prompt: "Any blood in the urine?",
        required: true,
        options: [
          { value: "no", label: "No" },
          { value: "yes", label: "Yes" },
          { value: "not-sure", label: "Not sure" },
        ],
      },
      {
        id: "signs",
        type: "multi",
        prompt: "Any of these?",
        required: false,
        options: [
          { value: "crying-when-peeing", label: "Crying when peeing" },
          { value: "licking-genitals", label: "Licking genitals" },
          { value: "accidents-indoors", label: "Accidents indoors" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "breathing",
    label: "Breathing",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has the breathing seemed off?",
        required: true,
        units: ["minutes", "hours", "days"],
      },
      {
        id: "character",
        type: "single",
        prompt: "How is the breathing?",
        required: true,
        options: [
          { value: "normal", label: "Normal" },
          { value: "fast", label: "Fast" },
          { value: "labored", label: "Labored / heavy effort" },
          { value: "open-mouth-cat", label: "Cat breathing with mouth open" },
          { value: "gasping", label: "Gasping" },
        ],
      },
      {
        id: "gum-color",
        type: "single",
        prompt: "What color are the gums?",
        required: true,
        options: [
          { value: "pink", label: "Pink — normal" },
          { value: "pale-white", label: "Pale white" },
          { value: "blue-purple", label: "Blue or purple" },
          { value: "not-sure", label: "Not sure" },
        ],
      },
      {
        id: "signs",
        type: "multi",
        prompt: "Any of these?",
        required: false,
        options: [
          { value: "coughing", label: "Coughing" },
          { value: "wheezing", label: "Wheezing" },
          { value: "noisy-breathing", label: "Noisy breathing" },
          { value: "cant-settle", label: "Can't settle" },
          { value: "none", label: "None of these" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "behavior",
    label: "Behavior change",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has the behavior been different?",
        required: true,
        units: ["hours", "days", "weeks"],
      },
      {
        id: "changes",
        type: "multi",
        prompt: "What changed?",
        required: true,
        options: [
          { value: "hiding", label: "Hiding" },
          { value: "aggression", label: "Aggression" },
          { value: "restlessness", label: "Restlessness" },
          { value: "disorientation", label: "Disorientation" },
          { value: "excessive-vocalizing", label: "Excessive vocalizing" },
          { value: "unusually-quiet", label: "Unusually quiet" },
        ],
      },
      {
        id: "appetite",
        type: "single",
        prompt: "Is your pet eating and drinking?",
        required: true,
        options: [
          { value: "normal", label: "Normal" },
          { value: "reduced", label: "Reduced" },
          { value: "refusing-all", label: "Refusing food and water" },
        ],
      },
      {
        id: "energy",
        type: "scale",
        prompt: "Energy level right now",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Very weak / collapsed",
        maxLabel: "Normal and playful",
      },
    ],
  },
  {
    id: "injury",
    label: "Injury",
    questions: [
      {
        id: "what",
        type: "single",
        prompt: "What happened?",
        required: true,
        options: [
          { value: "cut-or-wound", label: "Cut or wound" },
          { value: "fall", label: "Fall" },
          { value: "hit-by-vehicle", label: "Hit by a vehicle" },
          { value: "animal-bite", label: "Animal bite" },
          { value: "burn", label: "Burn" },
          { value: "not-sure", label: "Not sure" },
        ],
      },
      {
        id: "bleeding",
        type: "single",
        prompt: "Is there bleeding?",
        required: true,
        options: [
          { value: "none", label: "None" },
          { value: "stopped", label: "Bled but stopped" },
          { value: "oozing", label: "Still oozing a little" },
          { value: "heavy", label: "Heavy — won't stop" },
        ],
      },
      {
        id: "location",
        type: "multi",
        prompt: "Where is the injury?",
        required: true,
        options: [
          { value: "head", label: "Head" },
          { value: "body-torso", label: "Body / torso" },
          { value: "leg", label: "Leg" },
          { value: "paw", label: "Paw" },
          { value: "tail", label: "Tail" },
          { value: "mouth", label: "Mouth" },
        ],
      },
      {
        id: "consciousness",
        type: "single",
        prompt: "How alert is your pet?",
        required: true,
        options: [
          { value: "alert", label: "Alert and normal" },
          { value: "dazed", label: "Dazed" },
          { value: "unresponsive", label: "Unresponsive" },
        ],
      },
      {
        id: "photo",
        type: "photoPrompt",
        prompt: "Add a photo of the injury",
        required: false,
        maxPhotos: 3,
      },
    ],
  },
  {
    id: "other",
    label: "Something else",
    questions: [
      {
        id: "onset",
        type: "duration",
        prompt: "How long has this been going on?",
        required: true,
        units: ["hours", "days", "weeks"],
      },
      {
        id: "severity",
        type: "scale",
        prompt: "How serious does it seem?",
        required: true,
        min: 1,
        max: 5,
        minLabel: "Mild",
        maxLabel: "Severe / emergency-like",
      },
    ],
  },
];

/** Looks up a category definition by id; `undefined` if unknown. */
export function getCategoryDef(id: string): CategoryDef | undefined {
  return INTAKE_CATEGORIES.find((category) => category.id === id);
}

// ---- completed intake answers (discriminated union mirroring questionDefSchema on `type`) ----

const answerBaseSchema = {
  questionId: z.string().min(1),
};

const singleAnswerSchema = z.strictObject({
  ...answerBaseSchema,
  type: z.literal("single"),
  value: z.string().min(1),
});

const multiAnswerSchema = z.strictObject({
  ...answerBaseSchema,
  type: z.literal("multi"),
  values: z.array(z.string().min(1)).min(1),
});

const scaleAnswerSchema = z.strictObject({
  ...answerBaseSchema,
  type: z.literal("scale"),
  value: z.number().int(),
});

const durationAnswerSchema = z.strictObject({
  ...answerBaseSchema,
  type: z.literal("duration"),
  value: z.number().positive(),
  unit: durationUnitSchema,
});

const photoPromptAnswerSchema = z.strictObject({
  ...answerBaseSchema,
  type: z.literal("photoPrompt"),
  photoKeys: z.array(z.string().min(1)).max(3),
});

export const answerSchema = z.discriminatedUnion("type", [
  singleAnswerSchema,
  multiAnswerSchema,
  scaleAnswerSchema,
  durationAnswerSchema,
  photoPromptAnswerSchema,
]);
export type Answer = z.infer<typeof answerSchema>;

/**
 * Cross-field, category-aware validation for a completed intake (plan
 * "Validation semantics"). References the static `INTAKE_CATEGORIES` data.
 * Never mutates `data` — only adds issues via `ctx.addIssue`.
 */
function validateCompletedIntake(
  data: { category: SymptomCategory; answers: Answer[]; freeText?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  const categoryDef = getCategoryDef(data.category);
  if (!categoryDef) {
    // Defensive — the enum already guards this, but INTAKE_CATEGORIES is a
    // hand-maintained dataset so we never trust it silently.
    ctx.addIssue({
      code: "custom",
      message: `unknown category: ${data.category}`,
      path: ["category"],
    });
    return;
  }

  const questionById = new Map<string, QuestionDef>();
  for (const question of categoryDef.questions) {
    questionById.set(question.id, question);
  }

  const seenQuestionIds = new Set<string>();

  data.answers.forEach((answer, index) => {
    if (seenQuestionIds.has(answer.questionId)) {
      ctx.addIssue({
        code: "custom",
        message: `question "${answer.questionId}" is answered more than once`,
        path: ["answers", index, "questionId"],
      });
    }
    seenQuestionIds.add(answer.questionId);

    const question = questionById.get(answer.questionId);
    if (!question) {
      ctx.addIssue({
        code: "custom",
        message: `"${answer.questionId}" is not a question in category "${data.category}"`,
        path: ["answers", index, "questionId"],
      });
      return;
    }

    if (question.type !== answer.type) {
      ctx.addIssue({
        code: "custom",
        message: `answer type "${answer.type}" does not match question type "${question.type}" for "${answer.questionId}"`,
        path: ["answers", index, "type"],
      });
      return;
    }

    if (answer.type === "single") {
      if (question.type !== "single") return;
      const validValues = new Set(question.options.map((option) => option.value));
      if (!validValues.has(answer.value)) {
        ctx.addIssue({
          code: "custom",
          message: `"${answer.value}" is not a valid option for question "${question.id}"`,
          path: ["answers", index, "value"],
        });
      }
      return;
    }

    if (answer.type === "multi") {
      if (question.type !== "multi") return;
      const validValues = new Set(question.options.map((option) => option.value));
      const seenValues = new Set<string>();
      let hasInvalidOrDuplicate = false;
      for (const value of answer.values) {
        if (!validValues.has(value) || seenValues.has(value)) {
          hasInvalidOrDuplicate = true;
        }
        seenValues.add(value);
      }
      if (hasInvalidOrDuplicate) {
        ctx.addIssue({
          code: "custom",
          message: `values for question "${question.id}" must be valid, unique options`,
          path: ["answers", index, "values"],
        });
      }
      if (question.maxSelections !== undefined && answer.values.length > question.maxSelections) {
        ctx.addIssue({
          code: "custom",
          message: `question "${question.id}" allows at most ${question.maxSelections} selections`,
          path: ["answers", index, "values"],
        });
      }
      return;
    }

    if (answer.type === "scale") {
      if (question.type !== "scale") return;
      if (answer.value < question.min || answer.value > question.max) {
        ctx.addIssue({
          code: "custom",
          message: `value for question "${question.id}" must be between ${question.min} and ${question.max}`,
          path: ["answers", index, "value"],
        });
      }
      return;
    }

    if (answer.type === "duration") {
      if (question.type !== "duration") return;
      if (!question.units.includes(answer.unit)) {
        ctx.addIssue({
          code: "custom",
          message: `unit "${answer.unit}" is not offered for question "${question.id}"`,
          path: ["answers", index, "unit"],
        });
      }
      return;
    }

    if (answer.type === "photoPrompt") {
      if (question.type !== "photoPrompt") return;
      if (answer.photoKeys.length > question.maxPhotos) {
        ctx.addIssue({
          code: "custom",
          message: `question "${question.id}" allows at most ${question.maxPhotos} photos`,
          path: ["answers", index, "photoKeys"],
        });
      }
    }
  });

  for (const question of categoryDef.questions) {
    if (!question.required) continue;
    const isAnswered = data.answers.some((answer) => answer.questionId === question.id);
    if (!isAnswered) {
      ctx.addIssue({
        code: "custom",
        message: `required question "${question.id}" is missing an answer`,
        path: ["answers"],
      });
    }
  }
}

export const completedIntakeSchema = z
  .strictObject({
    category: symptomCategorySchema,
    answers: z.array(answerSchema),
    freeText: z.string().min(1).max(2000).optional(),
  })
  .superRefine(validateCompletedIntake);
export type CompletedIntake = z.infer<typeof completedIntakeSchema>;

export type ParseIntakeResult =
  | { ok: true; value: CompletedIntake }
  | { ok: false; reason: string; issues?: z.core.$ZodIssue[] };

/**
 * Pure validate-or-reject gate for a completed intake, mirroring
 * `parseTriage` exactly. Accepts either an already-parsed `unknown` value
 * or a JSON string. NEVER throws and NEVER mutates the input.
 */
export function parseIntake(raw: unknown): ParseIntakeResult {
  let candidate: unknown = raw;

  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: `INVALID_JSON: ${message}` };
    }
  }

  const parsed = completedIntakeSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { ok: false, reason, issues: parsed.error.issues };
}
