import type { z } from "zod";

/**
 * Parses `source` (defaults to `process.env`) against `schema` and returns the
 * typed, validated result. On failure, throws an `Error` whose message lists
 * every invalid/missing key (not just the first) as a readable report.
 */
export function defineEnv<Schema extends z.ZodType>(
  schema: Schema,
  source?: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(source ?? process.env);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }

  return result.data;
}
