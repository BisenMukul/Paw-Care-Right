import { z } from "zod";
import { sexSchema, speciesSchema, symptomCategorySchema, urgencySchema } from "@pawcareright/types";

import { RED_FLAG_SIGNS, SIZE_CLASSES } from "../rules";

/**
 * Zod case schema for the T036 eval harness (plan "Case schema spec"). Two
 * concrete schemas (`goldenCaseSchema`/`redteamCaseSchema`) share a common
 * `input` shape so T037 (golden set) / T038 (redteam set) need zero harness
 * changes — only more YAML files.
 */

const sizeClassSchema = z.enum(SIZE_CLASSES);
const redFlagSignSchema = z.enum(RED_FLAG_SIGNS);

/** `Partial<Record<RedFlagSign, boolean>>` — unknown sign keys are rejected by the enum key schema itself. */
const evalSignsSchema = z.partialRecord(redFlagSignSchema, z.boolean());

export const evalCaseInputSchema = z.strictObject({
  species: speciesSchema,
  sex: sexSchema.optional(),
  ageMonths: z.number().int().min(0).optional(),
  weightKg: z.number().positive().optional(),
  sizeClass: sizeClassSchema.optional(),
  petName: z.string().min(1).optional(),
  breedLabel: z.string().min(1).optional(),
  category: symptomCategorySchema.optional(),
  signs: evalSignsSchema.optional(),
  freeText: z.string().min(1).optional(),
});
export type EvalCaseInput = z.infer<typeof evalCaseInputSchema>;

const kebabIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case");

const goldenBaseSchema = z.strictObject({
  id: kebabIdSchema,
  description: z.string().min(1),
  input: evalCaseInputSchema,
  expectedTier: urgencySchema.optional(),
  acceptableTiers: z.array(urgencySchema).min(1).optional(),
  expectRedFlagRule: z.string().min(1).optional(),
  expectSource: z.enum(["rules", "ai"]).optional(),
  fakeResponse: z.string().optional(),
});

/** Golden cases require exactly one of `expectedTier`/`acceptableTiers`, non-empty & unique. */
export const goldenCaseSchema = goldenBaseSchema.superRefine((data, ctx) => {
  const hasExpectedTier = data.expectedTier !== undefined;
  const hasAcceptableTiers = data.acceptableTiers !== undefined;

  if (hasExpectedTier === hasAcceptableTiers) {
    ctx.addIssue({
      code: "custom",
      message: "exactly one of expectedTier/acceptableTiers is required",
      path: hasExpectedTier ? ["acceptableTiers"] : ["expectedTier"],
    });
  }

  if (data.acceptableTiers !== undefined) {
    const unique = new Set(data.acceptableTiers);
    if (unique.size !== data.acceptableTiers.length) {
      ctx.addIssue({ code: "custom", message: "acceptableTiers must not contain duplicates", path: ["acceptableTiers"] });
    }
  }
});
export type GoldenCase = z.infer<typeof goldenCaseSchema>;

export const redteamCaseSchema = z.strictObject({
  id: kebabIdSchema,
  description: z.string().min(1),
  input: evalCaseInputSchema,
  expectRefusal: z.boolean().default(true),
  expectedTier: urgencySchema.optional(),
  acceptableTiers: z.array(urgencySchema).min(1).optional(),
  fakeResponse: z.string().optional(),
});
export type RedteamCase = z.infer<typeof redteamCaseSchema>;

export const goldenEvalFileSchema = z.strictObject({ cases: z.array(goldenCaseSchema) });
export const redteamEvalFileSchema = z.strictObject({ cases: z.array(redteamCaseSchema) });

export type EvalFileParseResult<T> = { ok: true; cases: T[] } | { ok: false; reason: string };

/**
 * Validates a parsed-YAML value against `schema`'s `{ cases: [...] }` shape.
 * Mirrors `parseTriage`/`parseIntake`: NEVER throws, always returns a
 * machine-usable `reason` on failure so `loadCases` can aggregate errors
 * across files.
 */
export function parseEvalFile<T>(
  raw: unknown,
  schema: z.ZodType<{ cases: T[] }>,
): EvalFileParseResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, cases: parsed.data.cases };
  }

  const reason = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  return { ok: false, reason };
}
