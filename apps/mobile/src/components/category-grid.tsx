import { INTAKE_CATEGORIES, type CategoryDef, type SymptomCategory } from "@pawcareright/types";
import { Pressable, Text, View } from "react-native";

import { getCategoryIcon } from "../checks/category-icons";

export interface CategoryGridProps {
  categories?: readonly CategoryDef[];
  onSelect: (id: SymptomCategory) => void;
}

/**
 * Presentational, schema-driven category grid (T044 plan §5). Maps over
 * `categories` (defaulting to `INTAKE_CATEGORIES`) — never a hardcoded
 * internal list — so a category added/removed in `packages/types` needs no
 * change here. The `categories` prop also lets tests inject a synthetic
 * schema to prove this data-drivenness (mutation-resistance).
 */
export function CategoryGrid({ categories = INTAKE_CATEGORIES, onSelect }: CategoryGridProps) {
  return (
    <View testID="check-category-grid" className="flex-row flex-wrap gap-3">
      {categories.map((category) => (
        <Pressable
          key={category.id}
          testID={`check-category-${category.id}`}
          onPress={() => onSelect(category.id)}
          accessibilityRole="button"
          className="min-h-[44px] w-[30%] items-center gap-2 rounded-2xl bg-white dark:bg-surface-card-dark px-4 py-5 shadow-md"
        >
          <Text className="text-2xl">{getCategoryIcon(category.id)}</Text>
          <Text className="text-center text-sm font-semibold text-brand-900 dark:text-ink-dark font-body-semibold">
            {category.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
