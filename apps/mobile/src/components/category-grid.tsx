import { Ionicons } from "@expo/vector-icons";
import { INTAKE_CATEGORIES, type CategoryDef, type SymptomCategory } from "@pawcareright/types";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { useLayoutBucket } from "../hooks/use-layout-bucket";

export interface CategoryGridProps {
  categories?: readonly CategoryDef[];
  onSelect: (id: SymptomCategory) => void;
}

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * Colorful rounded-square icon-tile treatment (FIDELITY-2 plan §C): the
 * mockup's signature tile is a colored rounded-square fill with a WHITE
 * stroke icon, label BELOW in dark ink. Both maps below are presentational
 * and keyed on `category.id` (never a hardcoded internal category list), so
 * an `INTAKE_CATEGORIES` addition/removal needs no change here -- same
 * data-driven contract the grid already had (T044 plan §5). Colors cycle
 * through the existing decorative accent/category tokens (design-system.md
 * §1.1a); the fill is decorative (icon-on-fill, AA-exempt per the card +
 * design-system §4.6) -- the label below carries the essential info in the
 * already-verified `brand-900`/`ink-dark` pair.
 */
const CATEGORY_TILE_ICON: Record<SymptomCategory, IconName> = {
  vomiting: "sad-outline",
  diarrhea: "warning-outline",
  "not-eating": "restaurant-outline",
  limping: "walk-outline",
  "skin-itch": "paw-outline",
  eyes: "eye-outline",
  ears: "ear-outline",
  urinary: "water-outline",
  breathing: "fitness-outline",
  behavior: "happy-outline",
  injury: "bandage-outline",
  other: "help-circle-outline",
};

const CATEGORY_TILE_COLOR: Record<SymptomCategory, string> = {
  vomiting: "bg-accent-bright",
  diarrhea: "bg-category-sky",
  "not-eating": "bg-accent-warm",
  limping: "bg-category-amber",
  "skin-itch": "bg-category-lilac",
  eyes: "bg-accent-dark",
  ears: "bg-surface-raised-dark",
  urinary: "bg-accent-bright",
  breathing: "bg-category-sky",
  behavior: "bg-accent-warm",
  injury: "bg-category-amber",
  other: "bg-category-lilac",
};

/**
 * Presentational, schema-driven category grid (T044 plan §5). Maps over
 * `categories` (defaulting to `INTAKE_CATEGORIES`) — never a hardcoded
 * internal list — so a category added/removed in `packages/types` needs no
 * change here. The `categories` prop also lets tests inject a synthetic
 * schema to prove this data-drivenness (mutation-resistance).
 */
export function CategoryGrid({ categories = INTAKE_CATEGORIES, onSelect }: CategoryGridProps) {
  const bucket = useLayoutBucket();
  const tileWidthClass = bucket === "wide" ? "w-[18%]" : "w-[30%]";

  return (
    <View testID="check-category-grid" className="flex-row flex-wrap gap-3">
      {categories.map((category) => (
        <Pressable
          key={category.id}
          testID={`check-category-${category.id}`}
          onPress={() => onSelect(category.id)}
          accessibilityRole="button"
          className={`min-h-[44px] ${tileWidthClass} items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-5 shadow-md`}
        >
          <View
            testID={`check-category-${category.id}-tile`}
            className={`h-12 w-12 items-center justify-center rounded-2xl ${CATEGORY_TILE_COLOR[category.id]}`}
          >
            <Ionicons name={CATEGORY_TILE_ICON[category.id]} size={22} color="#ffffff" />
          </View>
          <Text className="text-center text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {category.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
