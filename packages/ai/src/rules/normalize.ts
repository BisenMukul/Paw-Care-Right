/**
 * Hand-rolled text normalization for the red-flag keyword matcher (CLAUDE §2
 * rule 7 — no stemming/NLP dependency). NFKD decompose → strip combining
 * diacritical marks → lowercase → punctuation/whitespace → single space →
 * collapse → trim. Pure, no deps.
 */
export function normalizeText(raw: string): string {
  return String(raw)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Apostrophes (straight + curly) are removed entirely, not turned into a
    // space, so contractions collapse into the single-token form the
    // keyword groups store (e.g. "can't" -> "cant", not "can t").
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True iff `normalizedText` contains `phrase` (also expected pre-normalized) as a substring. */
export function containsPhrase(normalizedText: string, phrase: string): boolean {
  return normalizedText.length > 0 && normalizedText.includes(phrase);
}

/** True iff `normalizedText` contains ANY of `phrases` as a substring. */
export function containsAnyPhrase(normalizedText: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => containsPhrase(normalizedText, phrase));
}

/** Alias used by the engine's keyword-leaf evaluation (semantic name at the call site). */
export function matchesKeywordLeaf(normalizedText: string, phrases: readonly string[]): boolean {
  return containsAnyPhrase(normalizedText, phrases);
}
