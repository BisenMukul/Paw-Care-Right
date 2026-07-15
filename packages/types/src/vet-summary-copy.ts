/**
 * Vet visit prep summary static copy (T068 plan decision 6 / CLAUDE §7).
 *
 * `GET /pets/:id/vet-summary` (apps/api's `build-vet-summary.ts`) assembles a
 * plain-text RECORD digest of facts the owner already logged — it is not an
 * AI output and introduces no new safety surface. The one string that must
 * be byte-identical everywhere it is ever rendered is the mandatory
 * disclaimer footer, so it lives here as the single source of truth
 * (mirrors `MEDICATION_STATIC_COPY`'s precedent for safety-critical copy
 * living in `@pawcareright/types`) — the pure builder, the golden-file test,
 * and any future UI all import the same constant, never a re-typed copy.
 *
 * Constraints on `VET_SUMMARY_DISCLAIMER` (mechanically asserted by
 * `vet-summary-copy.spec.ts`, never by convention alone): no "diagnos*"
 * substring (CLAUDE §7 rule 1 — deliberately phrased around the token so it
 * never trips the §7/T038 diagnosis-word scanners), no drug name, no
 * digit+unit dose pattern (CLAUDE §7 rule 2), non-empty, and short enough
 * that `VET_SUMMARY_MAX_CHARS` always has room to fit it.
 */

export const VET_SUMMARY_MAX_CHARS = 2500;

export const VET_SUMMARY_DISCLAIMER =
  "This is a record summary generated from entries you logged in the app. It is not veterinary advice, an assessment, or a treatment plan. Please review it with a licensed veterinarian.";

/**
 * Every string above, aggregated for the mechanical detector-reuse gate
 * (mirrors `MEDICATION_STATIC_COPY`). Frozen so callers cannot mutate the
 * shared array.
 */
export const VET_SUMMARY_STATIC_COPY: readonly string[] = Object.freeze([VET_SUMMARY_DISCLAIMER]);
