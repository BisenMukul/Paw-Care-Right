import { toxins } from "@pawcareright/data";

/**
 * Single-sourced drug-name token list feeding the T038 `DRUG_RECOMMENDATION`
 * detector rule (plan "Drug-name list source decision"). Human-med
 * names/aliases are derived from `@pawcareright/data` (auto-tracks T035
 * edits); `VET_DRUG_NAMES` is a small curated supplement for vet drugs a bad
 * output might recommend that are NOT ingestion toxins, so are absent from
 * the toxin dataset by design.
 */

const SINGLE_WORD_PATTERN = /^[a-z][a-z-]*$/;

/** Vet drugs a bad output might recommend that are NOT human-med toxins (plan verbatim). */
const VET_DRUG_NAMES: readonly string[] = [
  "carprofen",
  "rimadyl",
  "meloxicam",
  "metacam",
  "deracoxib",
  "firocoxib",
  "previcox",
  "galliprant",
  "grapiprant",
  "gabapentin",
  "tramadol",
  "codeine",
  "prednisone",
  "prednisolone",
  "dexamethasone",
  "apoquel",
  "oclacitinib",
];

/** Lowercases `raw` and returns it only if it is a single alphabetic word (`/^[a-z][a-z-]*$/`). */
function singleWordToken(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  return SINGLE_WORD_PATTERN.test(lower) ? lower : null;
}

/** Every single-word `name`/`alias` across `toxins` rows in the `human-med` category. */
function deriveHumanMedTokens(): string[] {
  const tokens: string[] = [];

  for (const toxin of toxins) {
    if (toxin.category !== "human-med") continue;

    const nameToken = singleWordToken(toxin.name);
    if (nameToken !== null) tokens.push(nameToken);

    for (const alias of toxin.aliases) {
      const aliasToken = singleWordToken(alias);
      if (aliasToken !== null) tokens.push(aliasToken);
    }
  }

  return tokens;
}

/** Lowercased, de-duped, frozen single-word drug-name tokens (human-med data + `VET_DRUG_NAMES`). */
export const DRUG_NAME_TOKENS: readonly string[] = Object.freeze(
  Array.from(new Set([...deriveHumanMedTokens(), ...VET_DRUG_NAMES])).sort(),
);

function escapeRegExp(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-bounded, case-insensitive matcher over every known drug-name token.
 * Global flag required for `String.prototype.matchAll`. **Stateful**: like
 * any `g`-flagged `RegExp`, this single exported instance's `lastIndex`
 * persists across `.test()`/`matchAll()` calls made directly on it — repeat
 * callers (e.g. a detector scanning many field strings) MUST construct a
 * fresh regex per scan (`new RegExp(DRUG_NAME_RE.source, DRUG_NAME_RE.flags)`)
 * rather than reusing this exported object, to avoid `lastIndex` bugs.
 */
export const DRUG_NAME_RE: RegExp = new RegExp(`\\b(${DRUG_NAME_TOKENS.map(escapeRegExp).join("|")})\\b`, "gi");
