import type { SymptomCategory } from "@pawcareright/types";

/**
 * Emoji glyphs for the symptom-intake category grid (T044 plan §3). These
 * are presentation glyphs, not translatable copy — the category `label`
 * shown alongside each icon comes from `INTAKE_CATEGORIES` in
 * `@pawcareright/types` (CLAUDE §7 schema data), never from this file.
 *
 * Deliberately `Partial<Record<...>>` with a default fallback: a category
 * added to `packages/types` renders (with the fallback icon) with ZERO
 * mobile change.
 */
export const CATEGORY_ICONS: Partial<Record<SymptomCategory, string>> = {
  vomiting: "🤢",
  diarrhea: "💩",
  "not-eating": "🍽️",
  limping: "🦴",
  "skin-itch": "🐾",
  eyes: "👁️",
  ears: "👂",
  urinary: "🚻",
  breathing: "🫁",
  behavior: "🧠",
  injury: "🩹",
  other: "❓",
};

export const DEFAULT_CATEGORY_ICON = "❓";

export function getCategoryIcon(id: string): string {
  return CATEGORY_ICONS[id as SymptomCategory] ?? DEFAULT_CATEGORY_ICON;
}
