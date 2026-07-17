import type { HealthLogKind } from "@pawcareright/types";

/**
 * Presentation-only glyph + badge-color map for the timeline (T067 plan
 * "Create" list). Mirrors `checks/category-icons.ts`'s header rationale:
 * emoji glyphs and NativeWind classes are never translatable copy — the
 * kind LABEL shown alongside each icon comes from `strings.timeline.kindLabel`,
 * never from this file.
 */
export interface KindDisplay {
  icon: string;
  colorClass: string;
}

export const KIND_DISPLAY: Record<HealthLogKind, KindDisplay> = {
  WEIGHT: { icon: "⚖️", colorClass: "bg-blue-100" },
  MEAL: { icon: "🍽️", colorClass: "bg-amber-100" },
  NOTE: { icon: "📝", colorClass: "bg-brand-100" },
  VET_VISIT: { icon: "🏥", colorClass: "bg-purple-100" },
  MED_GIVEN: { icon: "💊", colorClass: "bg-green-100" },
  CHECK_REF: { icon: "🩺", colorClass: "bg-orange-100" },
  ACTIVITY: { icon: "🐾", colorClass: "bg-teal-100" },
};

export const DEFAULT_KIND_DISPLAY: KindDisplay = { icon: "❓", colorClass: "bg-brand-100" };

/** Never throws — an unrecognized kind falls back to the default glyph/color. */
export function getKindDisplay(kind: string): KindDisplay {
  return (KIND_DISPLAY as Record<string, KindDisplay | undefined>)[kind] ?? DEFAULT_KIND_DISPLAY;
}
