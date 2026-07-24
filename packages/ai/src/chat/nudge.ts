import type { SymptomCategory } from "@pawcareright/types";

/**
 * Deterministic, code-only symptom nudge detector (T081 plan decision D5).
 * Fires on the OWNER's message only, before any AI text. Maps to one of the
 * 11 real `SYMPTOM_CATEGORIES` — never `"other"` — via a fixed category
 * priority order, so a multi-symptom sentence resolves deterministically to
 * the first (highest-priority) match. Pure, never throws.
 */

/** Fixed priority order (plan): breathing > urinary > injury > vomiting > diarrhea > not-eating > limping > eyes > ears > skin-itch > behavior. */
export const NUDGE_CATEGORY_PRIORITY: readonly Exclude<SymptomCategory, "other">[] = [
  "breathing",
  "urinary",
  "injury",
  "vomiting",
  "diarrhea",
  "not-eating",
  "limping",
  "eyes",
  "ears",
  "skin-itch",
  "behavior",
];

/** Exported keyword table (plan: "exported keyword table for tests"). Lowercase, word-boundary matched. */
export const NUDGE_KEYWORDS: Record<Exclude<SymptomCategory, "other">, readonly string[]> = {
  breathing: [
    "trouble breathing",
    "can't breathe",
    "cannot breathe",
    "gasping",
    "wheezing",
    "struggling to breathe",
    "breathing hard",
    "labored breathing",
    "short of breath",
  ],
  urinary: [
    "can't pee",
    "cannot urinate",
    "straining to urinate",
    "blood in urine",
    "not urinating",
    "no urine",
    "peeing blood",
    "urinary",
  ],
  injury: [
    "hit by a car",
    "hit by car",
    "bleeding",
    "open wound",
    "cut himself",
    "cut herself",
    "broken leg",
    "fell and",
    "laceration",
  ],
  vomiting: ["vomiting", "throwing up", "throwed up", "puking", "vomited", "vomits"],
  diarrhea: ["diarrhea", "loose stool", "watery stool", "runny poop", "loose stools"],
  "not-eating": ["not eating", "won't eat", "wont eat", "refusing food", "loss of appetite", "stopped eating"],
  limping: ["limping", "favoring a leg", "won't put weight on", "wont put weight on", "can't walk on"],
  eyes: ["eye is red", "eye discharge", "squinting", "cloudy eye", "swollen eye"],
  ears: ["ear infection", "shaking his head", "shaking her head", "smelly ear", "ear discharge", "scratching his ear"],
  "skin-itch": ["itchy skin", "scratching a lot", "skin rash", "hot spot", "hives"],
  behavior: ["acting strange", "hiding all day", "aggressive suddenly", "acting lethargic", "not himself", "acting off"],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKeyword(lowerMessage: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`);
  return pattern.test(lowerMessage);
}

/**
 * Returns the first (highest-priority) matching symptom category for
 * `message`, or `null` when no keyword matches. Case/punctuation
 * insensitive (lowercased before matching); empty string returns `null`.
 */
export function detectSymptomNudge(message: string): { category: Exclude<SymptomCategory, "other"> } | null {
  if (message.length === 0) {
    return null;
  }

  const lower = message.toLowerCase();

  for (const category of NUDGE_CATEGORY_PRIORITY) {
    const keywords = NUDGE_KEYWORDS[category];
    if (keywords.some((keyword) => containsKeyword(lower, keyword))) {
      return { category };
    }
  }

  return null;
}
