import { z } from "zod";

/**
 * Opaque keyset cursor for the merged health-timeline list (T064 plan
 * decision D1): `{ o: occurredAt ISO, s: sourceRank (0|1), i: id }`.
 * `sourceRank` is fixed and arbitrary (HealthLog rows = 0, projected
 * MED_GIVEN events = 1) -- it exists purely to make ties on `occurredAt`
 * across the two merged sources deterministic (plan §6 "comes-after-cursor"
 * predicate table).
 *
 * The cursor is base64url(JSON), decoded + Zod-validated on the way back
 * in. `z.object` (not `z.strictObject`) is used deliberately so a future
 * cursor carrying an extra field this version doesn't know about still
 * round-trips (forward-compat unknown-field tolerance, plan §7).
 */

const timelineCursorSchema = z.object({
  o: z.string().min(1),
  s: z.union([z.literal(0), z.literal(1)]),
  i: z.string().min(1),
});

export type TimelineCursor = z.infer<typeof timelineCursorSchema>;

/** Thrown by `decodeCursor` on any malformed input; the service maps this to a `400`. */
export class InvalidCursorError extends Error {
  constructor(message = "Invalid or corrupted cursor.") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

export function encodeCursor(cursor: TimelineCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): TimelineCursor {
  let json: string;
  try {
    json = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new InvalidCursorError();
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch {
    throw new InvalidCursorError();
  }

  const parsed = timelineCursorSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new InvalidCursorError();
  }

  return parsed.data;
}
