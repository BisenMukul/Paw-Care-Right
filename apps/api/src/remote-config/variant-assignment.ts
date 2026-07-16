/**
 * Paywall A/B variant assignment (T079 plan decision 1). Pure, dependency-
 * free, deterministic: no Nest imports, no I/O, no per-user persistence --
 * the SAME `(userId, setting)` pair always yields the SAME variant, which
 * is exactly what the "deterministic" acceptance criterion tests.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 32-bit FNV-1a hash (unsigned). A tiny, well-known non-cryptographic hash
 * -- good enough for a 2-way bucket split, with no new dependency.
 */
export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // Multiply by the FNV prime using Math.imul to stay within a signed
    // 32-bit integer (matches the reference FNV-1a algorithm), then coerce
    // back to unsigned via `>>> 0`.
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

export type PaywallVariantSetting = "A" | "B" | "AUTO";

/**
 * Override wins when `setting` is `"A"`/`"B"`. Otherwise (`"AUTO"`):
 * no `userId` -> the stable anonymous default `"A"`; with a `userId` ->
 * the hash-bucketed variant. Never throws.
 */
export function assignPaywallVariant(
  userId: string | undefined,
  setting: PaywallVariantSetting,
): "A" | "B" {
  if (setting === "A" || setting === "B") {
    return setting;
  }

  if (userId === undefined || userId.length === 0) {
    return "A";
  }

  return fnv1a32(userId) % 2 === 0 ? "A" : "B";
}
